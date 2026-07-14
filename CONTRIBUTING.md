# Contributing

## Local setup

```powershell
npm ci
npm test
```

The extension depends on `chrisczopnik.dayz-paa-preview`. Tests should cover the companion-action API contract without requiring proprietary software. Real end-to-end launch testing requires separately licensed Adobe Photoshop and a separately obtained compatible PAA format plug-in.

## Pull requests

- Keep changes focused.
- Preserve the public command IDs and machine-scoped configuration key unless a breaking release is intentional.
- Add or update automated tests for discovery, executable validation, URI validation, and companion API registration.
- Run `npm test` and `npm run package`.
- Describe any manual Windows and real-application verification performed.
- Do not bundle Adobe programs, logos, application icons, plug-ins, credentials, or proprietary PAA assets.
- Keep extension artwork original and visually neutral.

## Architecture

The extension activates alongside the `chrisczopnik.dayzPaaPreview` custom editor, obtains the public API exported by `chrisczopnik.dayz-paa-preview`, and registers one preview action. The same local-file launch behavior is exposed through the Explorer context menu and Command Palette. Native processes must be started with `shell: false` and separate argument values.

This project is unofficial and has no affiliation with Adobe, Bohemia Interactive, or third-party PAA plug-in authors.
