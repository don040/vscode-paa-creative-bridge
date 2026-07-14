import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path = require("node:path");

export type PhotoshopDiscoverySource =
  | "configured"
  | "appPathsCurrentUser"
  | "appPathsLocalMachine"
  | "adobeRegistry"
  | "uninstallRegistry"
  | "standardDirectory";

export interface PhotoshopCandidateCheck {
  readonly path: string;
  readonly source: PhotoshopDiscoverySource;
  readonly valid: boolean;
}

export interface PhotoshopDiscoveryResult {
  readonly path?: string;
  readonly source?: PhotoshopDiscoverySource;
  readonly checked: readonly PhotoshopCandidateCheck[];
}

/** Backward-friendly name used by the extension controller. */
export type PhotoshopResolution = PhotoshopDiscoveryResult;

export type RegistryHive = "HKCU" | "HKLM";
export type RegistryView = "64" | "32";

export interface RegistryQuery {
  readonly key: string;
  readonly view: RegistryView;
  readonly recursive?: boolean;
  readonly valueName?: string;
  readonly defaultValue?: boolean;
}

export interface PhotoshopDiscoveryEnvironment {
  /** Defaults to process.platform. Override this in platform-independent tests. */
  readonly platform?: NodeJS.Platform;
  /** Defaults to process.env and is used for path expansion and Program Files roots. */
  readonly environmentVariables?: NodeJS.ProcessEnv;
  /** Overrides all inferred Program Files roots when provided. */
  readonly programFilesRoots?: readonly string[];
  /** Returns true only for an existing regular file. */
  readonly fileExists?: (filePath: string) => Promise<boolean>;
  /** Returns direct child names. Discovery never recursively walks these directories. */
  readonly readDirectory?: (directoryPath: string) => Promise<readonly string[]>;
  /** Registry seam for tests. The default invokes reg.exe directly without a shell. */
  readonly queryRegistry?: (query: RegistryQuery) => Promise<string>;
}

interface RegistryRecord {
  readonly key: string;
  readonly values: ReadonlyMap<string, string>;
  readonly order: number;
}

interface Candidate {
  readonly path: string;
  readonly source: PhotoshopDiscoverySource;
}

const APP_PATHS_KEY =
  "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Photoshop.exe";
const ADOBE_PHOTOSHOP_KEY = "SOFTWARE\\Adobe\\Photoshop";
const UNINSTALL_KEY = "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
const PHOTOSHOP_EXECUTABLE = "Photoshop.exe";
const MAX_PROGRAM_FILES_ROOTS = 8;
const MAX_DIRECTORIES_PER_SCAN = 128;
const REGISTRY_MAX_BUFFER = 8 * 1024 * 1024;

/**
 * Parses REG_SZ and REG_EXPAND_SZ values into key-scoped records. It is pure and
 * intentionally ignores all other registry value types.
 */
export function parseRegistryRecords(output: string): readonly RegistryRecord[] {
  const records: Array<{ key: string; values: Map<string, string>; order: number }> = [];
  let current: { key: string; values: Map<string, string>; order: number } | undefined;

  for (const rawLine of output.replaceAll("\u0000", "").split(/\r?\n/u)) {
    const trimmed = rawLine.trim();
    if (/^(?:HKEY_|HKCU\\|HKLM\\)/iu.test(trimmed)) {
      current = { key: trimmed, values: new Map<string, string>(), order: records.length };
      records.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const valueMatch = rawLine.match(
      /^\s*(.*?)\s+REG_(?:EXPAND_SZ|SZ)\s+(.+?)\s*$/iu,
    );
    if (!valueMatch) {
      continue;
    }

    current.values.set(valueMatch[1].trim().toLocaleLowerCase("en-US"), valueMatch[2].trim());
  }

  return records;
}

/** Parses the default Photoshop.exe value returned from an App Paths query. */
export function parseAppPathsRegistryOutput(output: string): readonly string[] {
  const results: string[] = [];

  for (const record of parseRegistryRecords(output)) {
    // The query uses /ve, so its single string value is the default value. The
    // display label is localized by reg.exe and must not be used as an ID.
    for (const value of record.values.values()) {
      const candidate = cleanRegistryPath(value);
      if (candidate) {
        results.push(candidate);
      }
    }
  }

  return results;
}

/**
 * Parses Adobe Photoshop version keys and returns executable candidates newest
 * first. ApplicationPath values are install directories in Adobe's registry.
 */
export function parseAdobeApplicationPathRegistryOutput(output: string): readonly string[] {
  return parseRegistryRecords(output)
    .filter((record) => record.values.has("applicationpath"))
    .sort(compareRegistryRecordsNewestFirst)
    .map((record) => installLocationToExecutable(record.values.get("applicationpath") ?? ""))
    .filter((candidate) => candidate.length > 0);
}

/**
 * Parses Windows uninstall records for Adobe Photoshop installations and
 * returns their Photoshop.exe candidates newest first.
 */
export function parseUninstallRegistryOutput(output: string): readonly string[] {
  return parseRegistryRecords(output)
    .filter((record) => isPhotoshopDisplayName(record.values.get("displayname") ?? ""))
    .filter((record) => record.values.has("installlocation"))
    .sort(compareRegistryRecordsNewestFirst)
    .map((record) => installLocationToExecutable(record.values.get("installlocation") ?? ""))
    .filter((candidate) => candidate.length > 0);
}

/**
 * Resolves Photoshop in deterministic precedence order. Every executable must
 * be an existing absolute path whose final component is exactly Photoshop.exe
 * (case-insensitive). Duplicate candidates are checked only once.
 */
export async function resolvePhotoshop(
  configuredPath?: string,
  injectedEnvironment: PhotoshopDiscoveryEnvironment = {},
): Promise<PhotoshopDiscoveryResult> {
  const checked: PhotoshopCandidateCheck[] = [];
  if ((injectedEnvironment.platform ?? process.platform) !== "win32") {
    return { checked };
  }

  const environmentVariables = injectedEnvironment.environmentVariables ?? process.env;
  const fileExists = injectedEnvironment.fileExists ?? defaultFileExists;
  const queryRegistry = injectedEnvironment.queryRegistry ?? queryRegistryWithRegExe;
  const readDirectory = injectedEnvironment.readDirectory ?? defaultReadDirectory;
  const seen = new Set<string>();

  const tryCandidates = async (
    candidates: readonly Candidate[],
  ): Promise<PhotoshopDiscoveryResult | undefined> => {
    for (const candidate of candidates) {
      const expanded = expandEnvironmentVariables(cleanRegistryPath(candidate.path), environmentVariables);
      if (!expanded) {
        continue;
      }

      const normalized = path.win32.normalize(expanded.replaceAll("/", "\\"));
      const identity = normalized.toLocaleLowerCase("en-US");
      if (seen.has(identity)) {
        continue;
      }
      seen.add(identity);

      const structurallyValid =
        path.win32.isAbsolute(normalized) &&
        path.win32.basename(normalized).toLocaleLowerCase("en-US") ===
          PHOTOSHOP_EXECUTABLE.toLocaleLowerCase("en-US");
      const valid = structurallyValid && (await safelyCheckFile(fileExists, normalized));
      checked.push({ path: normalized, source: candidate.source, valid });

      if (valid) {
        return { path: normalized, source: candidate.source, checked };
      }
    }

    return undefined;
  };

  if (configuredPath?.trim()) {
    const result = await tryCandidates([{ path: configuredPath, source: "configured" }]);
    if (result) {
      return result;
    }
  }

  const orderedRegistryGroups: ReadonlyArray<{
    readonly source: PhotoshopDiscoverySource;
    readonly queries: readonly RegistryQuery[];
    readonly parse: (output: string) => readonly string[];
  }> = [
    {
      source: "appPathsCurrentUser",
      queries: registryViews("HKCU", APP_PATHS_KEY, { defaultValue: true }),
      parse: parseAppPathsRegistryOutput,
    },
    {
      source: "appPathsLocalMachine",
      queries: registryViews("HKLM", APP_PATHS_KEY, { defaultValue: true }),
      parse: parseAppPathsRegistryOutput,
    },
    {
      source: "adobeRegistry",
      queries: [
        ...registryViews("HKCU", ADOBE_PHOTOSHOP_KEY, {
          recursive: true,
          valueName: "ApplicationPath",
        }),
        ...registryViews("HKLM", ADOBE_PHOTOSHOP_KEY, {
          recursive: true,
          valueName: "ApplicationPath",
        }),
      ],
      parse: parseAdobeApplicationPathRegistryOutput,
    },
    {
      source: "uninstallRegistry",
      queries: [
        ...registryViews("HKCU", UNINSTALL_KEY, { recursive: true }),
        ...registryViews("HKLM", UNINSTALL_KEY, { recursive: true }),
      ],
      parse: parseUninstallRegistryOutput,
    },
  ];

  for (const group of orderedRegistryGroups) {
    for (const query of group.queries) {
      const output = await safelyQueryRegistry(queryRegistry, query);
      const result = await tryCandidates(
        group.parse(output).map((candidatePath) => ({ path: candidatePath, source: group.source })),
      );
      if (result) {
        return result;
      }
    }
  }

  const programFilesRoots = getProgramFilesRoots(injectedEnvironment, environmentVariables);
  for (const root of programFilesRoots.slice(0, MAX_PROGRAM_FILES_ROOTS)) {
    for (const searchDirectory of [path.win32.join(root, "Adobe"), root]) {
      const children = await safelyReadDirectory(readDirectory, searchDirectory);
      const matchingDirectories = children
        .filter((name) => /^Adobe Photoshop(?:\s|$)/iu.test(name.trim()))
        .sort(compareProductNamesNewestFirst)
        .slice(0, MAX_DIRECTORIES_PER_SCAN);
      const result = await tryCandidates(
        matchingDirectories.map((name) => ({
          path: path.win32.join(searchDirectory, name, PHOTOSHOP_EXECUTABLE),
          source: "standardDirectory",
        })),
      );
      if (result) {
        return result;
      }
    }
  }

  return { checked };
}

function registryViews(
  hive: RegistryHive,
  key: string,
  options: Pick<RegistryQuery, "defaultValue" | "recursive" | "valueName">,
): readonly RegistryQuery[] {
  return (["64", "32"] as const).map((view) => ({
    key: `${hive}\\${key}`,
    view,
    ...options,
  }));
}

function isPhotoshopDisplayName(displayName: string): boolean {
  return /^Adobe Photoshop(?:\s|$)/iu.test(displayName.trim());
}

function cleanRegistryPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const quoted = trimmed.match(/^"([^"]+)"/u);
  if (quoted) {
    return quoted[1].trim();
  }

  const executableEnd = trimmed.toLocaleLowerCase("en-US").indexOf("photoshop.exe");
  if (executableEnd >= 0) {
    return trimmed.slice(0, executableEnd + PHOTOSHOP_EXECUTABLE.length).trim();
  }

  return trimmed.replace(/^"|"$/gu, "").trim();
}

function installLocationToExecutable(value: string): string {
  const cleaned = cleanRegistryPath(value);
  if (!cleaned) {
    return "";
  }

  if (
    path.win32.basename(cleaned).toLocaleLowerCase("en-US") ===
    PHOTOSHOP_EXECUTABLE.toLocaleLowerCase("en-US")
  ) {
    return cleaned;
  }

  return path.win32.join(cleaned, PHOTOSHOP_EXECUTABLE);
}

function expandEnvironmentVariables(value: string, variables: NodeJS.ProcessEnv): string {
  const caseInsensitiveVariables = new Map<string, string>();
  for (const [name, variableValue] of Object.entries(variables)) {
    if (variableValue !== undefined) {
      caseInsensitiveVariables.set(name.toLocaleLowerCase("en-US"), variableValue);
    }
  }

  return value.replace(/%([^%]+)%/gu, (match, name: string) => {
    return caseInsensitiveVariables.get(name.toLocaleLowerCase("en-US")) ?? match;
  });
}

function compareRegistryRecordsNewestFirst(left: RegistryRecord, right: RegistryRecord): number {
  const leftVersion = extractVersionParts(
    left.values.get("applicationpath") ?? "",
    left.values.get("displayversion") ?? "",
    left.values.get("displayname") ?? "",
    left.key,
  );
  const rightVersion = extractVersionParts(
    right.values.get("applicationpath") ?? "",
    right.values.get("displayversion") ?? "",
    right.values.get("displayname") ?? "",
    right.key,
  );
  const versionOrder = compareVersionParts(rightVersion, leftVersion);
  return versionOrder === 0 ? left.order - right.order : versionOrder;
}

function compareProductNamesNewestFirst(left: string, right: string): number {
  const versionOrder = compareVersionParts(extractVersionParts(right), extractVersionParts(left));
  return versionOrder === 0 ? left.localeCompare(right, "en-US") : versionOrder;
}

function extractVersionParts(...values: readonly string[]): readonly number[] {
  for (const value of values) {
    const matches = value.match(/\d+(?:\.\d+)*/gu);
    if (matches?.length) {
      const selected = matches[matches.length - 1];
      return selected.split(".").map((part) => Number.parseInt(part, 10));
    }
  }
  return [];
}

function compareVersionParts(left: readonly number[], right: readonly number[]): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function getProgramFilesRoots(
  environment: PhotoshopDiscoveryEnvironment,
  variables: NodeJS.ProcessEnv,
): string[] {
  const suppliedRoots = environment.programFilesRoots;
  const rawRoots = suppliedRoots
    ? [...suppliedRoots]
    : [
        getEnvironmentVariable(variables, "ProgramW6432"),
        getEnvironmentVariable(variables, "ProgramFiles"),
        getEnvironmentVariable(variables, "ProgramFiles(x86)"),
      ];

  if (!suppliedRoots && rawRoots.every((root) => !root)) {
    const systemDrive = getEnvironmentVariable(variables, "SystemDrive") || "C:";
    rawRoots.push(`${systemDrive}\\Program Files`, `${systemDrive}\\Program Files (x86)`);
  }

  const seen = new Set<string>();
  const roots: string[] = [];
  for (const rawRoot of rawRoots) {
    if (!rawRoot) {
      continue;
    }
    const expanded = expandEnvironmentVariables(cleanRegistryPath(rawRoot), variables);
    const normalized = path.win32.normalize(expanded.replaceAll("/", "\\"));
    if (!path.win32.isAbsolute(normalized)) {
      continue;
    }
    const identity = normalized.toLocaleLowerCase("en-US");
    if (!seen.has(identity)) {
      seen.add(identity);
      roots.push(normalized);
    }
  }
  return roots;
}

function getEnvironmentVariable(variables: NodeJS.ProcessEnv, requestedName: string): string {
  const entry = Object.entries(variables).find(
    ([name]) => name.toLocaleLowerCase("en-US") === requestedName.toLocaleLowerCase("en-US"),
  );
  return entry?.[1] ?? "";
}

async function defaultFileExists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function defaultReadDirectory(directoryPath: string): Promise<readonly string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function safelyCheckFile(
  fileExists: (filePath: string) => Promise<boolean>,
  filePath: string,
): Promise<boolean> {
  try {
    return await fileExists(filePath);
  } catch {
    return false;
  }
}

async function safelyReadDirectory(
  readDirectory: (directoryPath: string) => Promise<readonly string[]>,
  directoryPath: string,
): Promise<readonly string[]> {
  try {
    return await readDirectory(directoryPath);
  } catch {
    return [];
  }
}

async function safelyQueryRegistry(
  queryRegistry: (query: RegistryQuery) => Promise<string>,
  query: RegistryQuery,
): Promise<string> {
  try {
    return await queryRegistry(query);
  } catch {
    return "";
  }
}

function queryRegistryWithRegExe(query: RegistryQuery): Promise<string> {
  const argumentsList = ["query", query.key];
  if (query.recursive) {
    argumentsList.push("/s");
  }
  if (query.valueName) {
    argumentsList.push("/v", query.valueName);
  } else if (query.defaultValue) {
    argumentsList.push("/ve");
  }
  argumentsList.push(`/reg:${query.view}`);

  return new Promise<string>((resolve) => {
    execFile(
      "reg.exe",
      argumentsList,
      {
        encoding: "utf8",
        maxBuffer: REGISTRY_MAX_BUFFER,
        shell: false,
        windowsHide: true,
      },
      (_error, stdout) => {
        resolve(typeof stdout === "string" ? stdout : "");
      },
    );
  });
}
