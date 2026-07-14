const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseAdobeApplicationPathRegistryOutput,
  parseAppPathsRegistryOutput,
  parseRegistryRecords,
  parseUninstallRegistryOutput,
  resolvePhotoshop,
} = require("../dist/photoshopDiscovery.js");

function appPathsOutput(executablePath, defaultName = "(Default)") {
  return [
    "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\Photoshop.exe",
    `    ${defaultName}    REG_SZ    ${executablePath}`,
    "",
  ].join("\r\n");
}

function windowsEnvironment(overrides = {}) {
  return {
    platform: "win32",
    environmentVariables: {},
    programFilesRoots: [],
    queryRegistry: async () => "",
    fileExists: async () => false,
    readDirectory: async () => [],
    ...overrides,
  };
}

test("pure registry record parser handles string values and NUL-padded output", () => {
  const output = [
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\Photoshop\\200.0",
    "    ApplicationPath    REG_EXPAND_SZ    %ProgramFiles%\\Adobe\\Adobe Photoshop 2026",
    "    Unsupported    REG_DWORD    0x1",
    "",
  ].join("\u0000\r\u0000\n\u0000");

  const records = parseRegistryRecords(output);
  assert.equal(records.length, 1);
  assert.equal(records[0].key, "HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\Photoshop\\200.0");
  assert.equal(
    records[0].values.get("applicationpath"),
    "%ProgramFiles%\\Adobe\\Adobe Photoshop 2026",
  );
  assert.equal(records[0].values.has("unsupported"), false);
});

test("App Paths parser does not depend on the localized default value label", () => {
  assert.deepEqual(
    parseAppPathsRegistryOutput(appPathsOutput('"C:\\Adobe\\Photoshop.exe"')),
    ["C:\\Adobe\\Photoshop.exe"],
  );
  assert.deepEqual(
    parseAppPathsRegistryOutput(appPathsOutput("D:\\Adobe\\Photoshop.exe", "(Standard)")),
    ["D:\\Adobe\\Photoshop.exe"],
  );
  assert.deepEqual(
    parseAppPathsRegistryOutput(appPathsOutput("E:\\Adobe\\Photoshop.exe", "(Predeterminado)")),
    ["E:\\Adobe\\Photoshop.exe"],
  );
});

test("Adobe ApplicationPath parser returns the newest registered version first", () => {
  const output = [
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\Photoshop\\999.0",
    "    ApplicationPath    REG_SZ    C:\\Program Files\\Adobe\\Adobe Photoshop 2025",
    "",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Adobe\\Photoshop\\100.0",
    "    ApplicationPath    REG_SZ    C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\",
    "",
  ].join("\r\n");

  assert.deepEqual(parseAdobeApplicationPathRegistryOutput(output), [
    "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe",
    "C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe",
  ]);
});

test("uninstall parser filters unrelated Adobe products and sorts Photoshop versions", () => {
  const output = [
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Lightroom",
    "    DisplayName    REG_SZ    Adobe Lightroom",
    "    InstallLocation    REG_SZ    C:\\Adobe\\Lightroom",
    "",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Photoshop25",
    "    DisplayName    REG_SZ    Adobe Photoshop 2025",
    "    DisplayVersion    REG_SZ    26.11.0",
    "    InstallLocation    REG_SZ    C:\\Adobe\\Adobe Photoshop 2025",
    "",
    "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Photoshop26",
    "    DisplayName    REG_SZ    Adobe Photoshop 2026",
    "    DisplayVersion    REG_SZ    27.4.0",
    "    InstallLocation    REG_SZ    D:\\Adobe\\Adobe Photoshop 2026",
    "",
  ].join("\r\n");

  assert.deepEqual(parseUninstallRegistryOutput(output), [
    "D:\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe",
    "C:\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe",
  ]);
});

test("configured executable is checked first and stops discovery when valid", async () => {
  const queried = [];
  const configuredPath = "D:\\Apps\\Adobe Photoshop 2026\\Photoshop.exe";
  const result = await resolvePhotoshop(
    configuredPath,
    windowsEnvironment({
      queryRegistry: async (query) => {
        queried.push(query);
        throw new Error("registry must not be queried after a valid configured path");
      },
      fileExists: async (candidate) => candidate === configuredPath,
    }),
  );

  assert.equal(result.path, configuredPath);
  assert.equal(result.source, "configured");
  assert.deepEqual(result.checked, [{ path: configuredPath, source: "configured", valid: true }]);
  assert.deepEqual(queried, []);
});

test("App Paths order is HKCU 64/32 followed by HKLM 64/32 and candidates are deduplicated", async () => {
  const queries = [];
  const missingConfiguredPath = "C:\\Missing\\Photoshop.exe";
  const foundPath = "D:\\Adobe\\Photoshop.exe";
  const result = await resolvePhotoshop(
    missingConfiguredPath,
    windowsEnvironment({
      queryRegistry: async (query) => {
        queries.push(query);
        if (query.key.startsWith("HKCU") && query.view === "64") {
          return appPathsOutput("c:\\missing\\PHOTOSHOP.EXE");
        }
        if (query.key.startsWith("HKLM") && query.view === "64") {
          return appPathsOutput(foundPath);
        }
        return "";
      },
      fileExists: async (candidate) => candidate.toLowerCase() === foundPath.toLowerCase(),
    }),
  );

  assert.equal(result.path, foundPath);
  assert.equal(result.source, "appPathsLocalMachine");
  assert.deepEqual(
    queries.map((query) => [query.key.slice(0, 4), query.view]),
    [
      ["HKCU", "64"],
      ["HKCU", "32"],
      ["HKLM", "64"],
    ],
  );
  assert.deepEqual(result.checked, [
    { path: missingConfiguredPath, source: "configured", valid: false },
    { path: foundPath, source: "appPathsLocalMachine", valid: true },
  ]);
});

test("Adobe registry is considered only after all App Paths views", async () => {
  const queries = [];
  const foundPath = "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe";
  const result = await resolvePhotoshop(
    undefined,
    windowsEnvironment({
      queryRegistry: async (query) => {
        queries.push(query);
        if (query.key.includes("Adobe\\Photoshop") && query.view === "64") {
          return [
            "HKEY_CURRENT_USER\\SOFTWARE\\Adobe\\Photoshop\\200.0",
            "    ApplicationPath    REG_SZ    C:\\Program Files\\Adobe\\Adobe Photoshop 2026",
          ].join("\r\n");
        }
        return "";
      },
      fileExists: async (candidate) => candidate === foundPath,
    }),
  );

  assert.equal(result.path, foundPath);
  assert.equal(result.source, "adobeRegistry");
  assert.deepEqual(
    queries.slice(0, 4).map((query) => [query.key.slice(0, 4), query.view, query.defaultValue]),
    [
      ["HKCU", "64", true],
      ["HKCU", "32", true],
      ["HKLM", "64", true],
      ["HKLM", "32", true],
    ],
  );
  assert.equal(queries[4].key, "HKCU\\SOFTWARE\\Adobe\\Photoshop");
  assert.equal(queries[4].valueName, "ApplicationPath");
});

test("uninstall InstallLocation is used after Adobe ApplicationPath keys", async () => {
  const foundPath = "E:\\Adobe\\Adobe Photoshop 2024\\Photoshop.exe";
  const result = await resolvePhotoshop(
    undefined,
    windowsEnvironment({
      queryRegistry: async (query) => {
        if (query.key.includes("CurrentVersion\\Uninstall") && query.key.startsWith("HKCU")) {
          return [
            "HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PS2024",
            "    DisplayName    REG_SZ    Adobe Photoshop 2024",
            "    InstallLocation    REG_SZ    E:\\Adobe\\Adobe Photoshop 2024",
          ].join("\r\n");
        }
        return "";
      },
      fileExists: async (candidate) => candidate === foundPath,
    }),
  );

  assert.equal(result.path, foundPath);
  assert.equal(result.source, "uninstallRegistry");
});

test("bounded Program Files fallback checks direct Adobe Photoshop directories newest first", async () => {
  const readDirectories = [];
  const foundPath = "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe";
  const result = await resolvePhotoshop(
    undefined,
    windowsEnvironment({
      programFilesRoots: ["C:\\Program Files"],
      readDirectory: async (directoryPath) => {
        readDirectories.push(directoryPath);
        if (directoryPath === "C:\\Program Files\\Adobe") {
          return ["Acrobat", "Adobe Photoshop 2024", "Adobe Photoshop 2026"];
        }
        return [];
      },
      fileExists: async (candidate) => candidate === foundPath,
    }),
  );

  assert.equal(result.path, foundPath);
  assert.equal(result.source, "standardDirectory");
  assert.deepEqual(readDirectories, ["C:\\Program Files\\Adobe"]);
  assert.deepEqual(result.checked, [{ path: foundPath, source: "standardDirectory", valid: true }]);
});

test("invalid configured paths are reported but never accepted", async () => {
  const result = await resolvePhotoshop(
    "relative\\NotPhotoshop.exe",
    windowsEnvironment({ fileExists: async () => true }),
  );

  assert.equal(result.path, undefined);
  assert.equal(result.source, undefined);
  assert.deepEqual(result.checked, [
    { path: "relative\\NotPhotoshop.exe", source: "configured", valid: false },
  ]);
});

test("non-Windows hosts do not touch injected filesystem or registry seams", async () => {
  let touched = false;
  const result = await resolvePhotoshop("C:\\Adobe\\Photoshop.exe", {
    platform: "linux",
    queryRegistry: async () => {
      touched = true;
      return "";
    },
    fileExists: async () => {
      touched = true;
      return true;
    },
  });

  assert.deepEqual(result, { checked: [] });
  assert.equal(touched, false);
});
