# DayZ PAA Creative Bridge

> Windows companion extension for Arma/DayZ PAA Image Preview. A German version is available in [README.de.md](README.de.md).

Open a local Arma or DayZ `.paa` texture in Adobe Photoshop directly from [Arma/DayZ PAA Image Preview](https://marketplace.visualstudio.com/items?itemName=chrisczopnik.dayz-paa-preview).

This companion extension adds **Open in Adobe Photoshop** between the export and TexView actions in the PAA preview toolbar. The same action is available from the Explorer context menu and Command Palette.

## Requirements

- 64-bit Windows (x64)
- Visual Studio Code 1.85 or newer
- `chrisczopnik.dayz-paa-preview`, installed as a separate extension dependency
- Adobe Photoshop, installed separately
- a compatible third-party PAA file-format plug-in for Adobe Photoshop, installed and configured separately. [Like this one by Gruppe Adler](https://github.com/gruppe-adler/PaaPhotoshopPlugin)

Adobe Photoshop does not natively guarantee support for DayZ PAA files. This extension only passes the selected local `.paa` path to Photoshop. It does not include, install, configure, license, or provide support for Adobe software or any PAA format plug-in.

## Usage

1. Install Arma/DayZ PAA Image Preview and this companion extension.
2. Open a local `.paa` file with **Arma/DayZ PAA Image Preview**.
3. Select **Open in Adobe Photoshop** in the preview toolbar.

You can also right-click a `.paa` in the VS Code Explorer and select **PAA: Open in Adobe Photoshop**.

The source PAA is passed directly to the detected Photoshop executable. No temporary PNG export is created by this action, and the source file is not modified by the extension.

## Photoshop discovery

Leave `dayzPaaCreativeBridge.photoshopPath` empty for automatic discovery. If the detected installation is not the one you want, run **PAA: Select Adobe Photoshop executable** and choose `Photoshop.exe`. The setting is machine-scoped because it identifies software installed on the current computer.

## Commands

- `PAA: Open in Adobe Photoshop`
- `PAA: Select Adobe Photoshop executable`

Manifest commands and settings are localized in English and German.

## Security and privacy

- No telemetry and no network requests.
- No PAA data leaves the machine through this extension.
- Photoshop is launched without a command shell and the PAA path is passed as a separate argument.
- Only local `file:` resources are accepted.
- Virtual, remote, and untrusted workspaces are intentionally unsupported in version 1.

Adobe Photoshop and the installed third-party PAA plug-in run outside this extension and have their own security, privacy, and licensing terms.

## Branding and affiliation

The extension uses neutral image-editor artwork and does not bundle or reproduce the Adobe Photoshop product icon. Adobe and Photoshop are trademarks or registered trademarks of Adobe in the United States and/or other countries.

This is an unofficial community extension. It is not affiliated with, sponsored by, or endorsed by Adobe, Bohemia Interactive, or the author of any third-party PAA plug-in.

## Development

```powershell
npm install
npm test
npm run package
```

The source distribution also includes `CONTRIBUTING.md`, `PUBLISHING.md`, and `SECURITY.md`.

## License

MIT. No Adobe, Bohemia Interactive, or third-party plug-in software or assets are included.
