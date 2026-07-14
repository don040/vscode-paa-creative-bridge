import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { tr } from "./localize";
import {
  resolvePhotoshop,
  type PhotoshopResolution,
} from "./photoshopDiscovery";
import { createPhotoshopLaunchSpec } from "./photoshopLauncher";

const BASE_EXTENSION_ID = "chrisczopnik.dayz-paa-preview";
const OPEN_COMMAND = "dayzPaaCreativeBridge.openInPhotoshop";
const SELECT_COMMAND = "dayzPaaCreativeBridge.selectPhotoshop";
const TOOLBAR_ACTION_ID =
  "chrisczopnik.dayz-paa-creative-bridge.openInPhotoshop";

interface PreviewAction {
  readonly id: string;
  readonly label: string;
  readonly command: string;
  readonly icon: "imageEditor";
  readonly order?: number;
}

interface PaaPreviewApi {
  readonly apiVersion: number;
  getActiveUri(candidate?: unknown): vscode.Uri | undefined;
  registerPreviewAction(action: PreviewAction): vscode.Disposable;
}

function isLocalPaa(value: unknown): value is vscode.Uri {
  return Boolean(
    value instanceof vscode.Uri &&
    value.scheme === "file" &&
    path.extname(value.fsPath).toLocaleLowerCase("en-US") === ".paa",
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PhotoshopController {
  private resolution?: Promise<PhotoshopResolution>;

  private getConfiguredPath(): string | undefined {
    return vscode.workspace
      .getConfiguration("dayzPaaCreativeBridge")
      .get<string>("photoshopPath");
  }

  private async getResolution(): Promise<PhotoshopResolution> {
    const pending = this.resolution ??= resolvePhotoshop(this.getConfiguredPath());
    try {
      const result = await pending;
      if (this.resolution === pending && !result.path) {
        this.resolution = undefined;
      }
      return result;
    } catch (error) {
      if (this.resolution === pending) {
        this.resolution = undefined;
      }
      throw error;
    }
  }

  public invalidate(): void {
    this.resolution = undefined;
  }

  public async open(uri: vscode.Uri): Promise<void> {
    if (!isLocalPaa(uri)) {
      void vscode.window.showErrorMessage(
        tr("Select a local .paa file.", "Bitte eine lokale .paa-Datei auswählen."),
      );
      return;
    }
    if (process.platform !== "win32") {
      void vscode.window.showErrorMessage(
        tr(
          "DayZ PAA Creative Bridge requires Windows.",
          "DayZ PAA Creative Bridge benötigt Windows.",
        ),
      );
      return;
    }

    const resolution = await this.getResolution();
    if (!resolution.path) {
      const action = await vscode.window.showErrorMessage(
        tr(
          "Adobe Photoshop was not found. Install it or select Photoshop.exe.",
          "Adobe Photoshop wurde nicht gefunden. Bitte installieren oder Photoshop.exe auswählen.",
        ),
        tr("Select Photoshop.exe", "Photoshop.exe auswählen"),
      );
      if (action) {
        await this.selectExecutable();
      }
      return;
    }

    try {
      const launch = createPhotoshopLaunchSpec(resolution.path, uri.fsPath);
      const child = spawn(
        launch.executablePath,
        [...launch.arguments],
        launch.options,
      );
      child.once("error", (error) => {
        this.invalidate();
        void vscode.window.showErrorMessage(
          tr(
            "Adobe Photoshop could not be started: ",
            "Adobe Photoshop konnte nicht gestartet werden: ",
          ) + error.message,
        );
      });
      child.unref();
    } catch (error) {
      this.invalidate();
      void vscode.window.showErrorMessage(
        tr(
          "Adobe Photoshop could not be started: ",
          "Adobe Photoshop konnte nicht gestartet werden: ",
        ) + errorMessage(error),
      );
    }
  }

  public async selectExecutable(): Promise<void> {
    const current = await this.getResolution();
    const defaultDirectory = current.path
      ? path.dirname(current.path)
      : path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Adobe");
    const selected = await vscode.window.showOpenDialog({
      title: tr(
        "Select Adobe Photoshop executable",
        "Adobe-Photoshop-Programm auswählen",
      ),
      defaultUri: vscode.Uri.file(defaultDirectory),
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: { "Photoshop.exe": ["exe"] },
    });
    if (!selected?.[0]) {
      return;
    }

    const selectedPath = selected[0].fsPath;
    if (
      path.basename(selectedPath).toLocaleLowerCase("en-US") !==
      "photoshop.exe"
    ) {
      void vscode.window.showErrorMessage(
        tr(
          "Select Photoshop.exe, not another program.",
          "Bitte Photoshop.exe auswählen, kein anderes Programm.",
        ),
      );
      return;
    }
    try {
      const stat = await fs.stat(selectedPath);
      if (!stat.isFile()) {
        throw new Error("The selected path is not a file.");
      }
    } catch (error) {
      void vscode.window.showErrorMessage(
        tr(
          "The selected Photoshop.exe is not accessible: ",
          "Die ausgewählte Photoshop.exe ist nicht erreichbar: ",
        ) + errorMessage(error),
      );
      return;
    }

    await vscode.workspace
      .getConfiguration("dayzPaaCreativeBridge")
      .update(
        "photoshopPath",
        selectedPath,
        vscode.ConfigurationTarget.Global,
      );
    this.invalidate();
    void vscode.window.showInformationMessage(
      tr(
        "Adobe Photoshop executable was saved.",
        "Das Adobe-Photoshop-Programm wurde gespeichert.",
      ),
    );
  }
}

async function activateBaseApi(): Promise<PaaPreviewApi | undefined> {
  const base = vscode.extensions.getExtension<PaaPreviewApi>(BASE_EXTENSION_ID);
  if (!base) {
    return undefined;
  }
  const api = base.isActive ? base.exports : await base.activate();
  return api?.apiVersion === 1 &&
    typeof api.getActiveUri === "function" &&
    typeof api.registerPreviewAction === "function"
    ? api
    : undefined;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const controller = new PhotoshopController();
  const baseApi = await activateBaseApi();

  const resolveTarget = (candidate?: unknown): vscode.Uri | undefined => {
    if (isLocalPaa(candidate)) {
      return candidate;
    }
    const fromBase = baseApi?.getActiveUri(candidate);
    if (isLocalPaa(fromBase)) {
      return fromBase;
    }
    const fromTextEditor = vscode.window.activeTextEditor?.document.uri;
    return isLocalPaa(fromTextEditor) ? fromTextEditor : undefined;
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(OPEN_COMMAND, async (candidate?: unknown) => {
      const uri = resolveTarget(candidate);
      if (!uri) {
        void vscode.window.showErrorMessage(
          tr("Select a local .paa file.", "Bitte eine lokale .paa-Datei auswählen."),
        );
        return;
      }
      await controller.open(uri);
    }),
    vscode.commands.registerCommand(
      SELECT_COMMAND,
      () => controller.selectExecutable(),
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("dayzPaaCreativeBridge.photoshopPath")) {
        controller.invalidate();
      }
    }),
  );

  if (!baseApi) {
    void vscode.window.showErrorMessage(
      tr(
        "Arma/DayZ PAA Image Preview must be updated before the Creative Bridge toolbar action can be added.",
        "Arma/DayZ PAA Image Preview muss aktualisiert werden, bevor die Creative-Bridge-Aktion hinzugefügt werden kann.",
      ),
    );
    return;
  }

  context.subscriptions.push(
    baseApi.registerPreviewAction({
      id: TOOLBAR_ACTION_ID,
      label: tr(
        "Open in Adobe Photoshop",
        "In Adobe Photoshop öffnen",
      ),
      command: OPEN_COMMAND,
      icon: "imageEditor",
      order: 200,
    }),
  );
}

export function deactivate(): void {
  // Disposables are owned by the extension context.
}
