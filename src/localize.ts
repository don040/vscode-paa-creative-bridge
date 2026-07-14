import * as vscode from "vscode";

export const isGerman = vscode.env.language
  .toLocaleLowerCase("en-US")
  .startsWith("de");

export function tr(english: string, german: string): string {
  return isGerman ? german : english;
}
