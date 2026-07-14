# Security

## Supported versions

Security fixes are provided for the latest published version.

## Reporting

Use GitHub private vulnerability reporting in the final public source repository. If private reporting is unavailable, contact the verified publisher through the Visual Studio Marketplace before public disclosure. Do not include private PAA assets, Adobe credentials, tokens, licensed plug-ins, or internal paths in a report.

## Security model

- The extension accepts only local `file:` resources with a `.paa` extension.
- It launches only a locally discovered or explicitly selected `Photoshop.exe`.
- Executable and PAA paths are passed as separate process arguments without a command shell.
- Source PAA files are not modified by this extension.
- The extension sends no telemetry and performs no network requests.
- Virtual, remote, and untrusted workspaces are unsupported.

Adobe Photoshop and the separately installed third-party PAA format plug-in execute outside this extension's security boundary. Users are responsible for obtaining them from trusted sources, keeping them updated, and complying with their licenses.
