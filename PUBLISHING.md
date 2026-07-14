# Publishing

The extension manifest currently uses:

- publisher: `chrisczopnik`
- extension name: `dayz-paa-creative-bridge`
- public ID: `chrisczopnik.dayz-paa-creative-bridge`
- required extension: `chrisczopnik.dayz-paa-preview`

Before the first Marketplace release, confirm that `chrisczopnik` is the publisher ID you own. If the publisher ID changes, update both `publisher` and `extensionDependencies` as needed before publishing version 1.0.0.

Publish the compatible DayZ PAA Preview version before publishing this companion so Marketplace dependency installation can resolve `chrisczopnik.dayz-paa-preview`.

Add the final public source repository URL to `package.json` before publishing so Marketplace documentation links and source metadata resolve correctly. Do not invent or publish a placeholder URL.

## Adobe references and artwork

- Keep the product name **DayZ PAA Creative Bridge**; do not put Adobe or Photoshop in the extension product name.
- Use only neutral, original image-editor artwork. Do not use or imitate the Adobe Photoshop application icon or Adobe logos.
- State prominently that Adobe Photoshop and a compatible third-party PAA format plug-in are required, installed separately, and not bundled.
- Retain the unofficial/no-affiliation statement in the Marketplace README.
- Do not bundle Adobe software, Adobe assets, third-party PAA plug-ins, or proprietary test textures.

## Release checklist

1. Update `version` in `package.json` and add release notes to `CHANGELOG.md`.
2. Confirm the dependency version exposes the supported DayZ PAA Preview companion-action API.
3. Run `npm ci`.
4. Run `npm test`.
5. Run `npm run package` to produce the `win32-x64` VSIX.
6. Inspect packaged files with `npx vsce ls --no-dependencies`.
7. Install both VSIX files into a clean VS Code profile.
8. Verify the toolbar button, Explorer command, automatic discovery, manual executable selection, and error handling without Photoshop.
9. With properly licensed software, perform one real launch using Adobe Photoshop and a compatible third-party PAA format plug-in.
10. Publish the tested platform build with `npx vsce publish --target win32-x64`, or upload the verified VSIX in the Marketplace publisher portal.

Never commit Marketplace credentials, Adobe credentials, tokens, private signing material, proprietary plug-ins, or private PAA assets.

Official guide: [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
