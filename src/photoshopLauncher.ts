import type { SpawnOptions } from "node:child_process";
import path = require("node:path");

export interface PhotoshopLaunchSpec {
  readonly executablePath: string;
  readonly arguments: readonly [string];
  readonly options: SpawnOptions;
}

export function createPhotoshopLaunchSpec(
  executablePath: string,
  paaPath: string,
): PhotoshopLaunchSpec {
  const normalizedExecutable = path.win32.normalize(executablePath);
  const normalizedPaa = path.win32.normalize(paaPath);

  if (
    !path.win32.isAbsolute(normalizedExecutable) ||
    path.win32.basename(normalizedExecutable).toLocaleLowerCase("en-US") !==
      "photoshop.exe"
  ) {
    throw new Error("The Photoshop executable path is invalid.");
  }
  if (
    !path.win32.isAbsolute(normalizedPaa) ||
    path.win32.extname(normalizedPaa).toLocaleLowerCase("en-US") !== ".paa"
  ) {
    throw new Error("The PAA path is invalid.");
  }

  return Object.freeze({
    executablePath: normalizedExecutable,
    arguments: Object.freeze([normalizedPaa]) as readonly [string],
    options: Object.freeze({
      detached: true,
      shell: false,
      stdio: "ignore",
      windowsHide: false,
    }),
  });
}
