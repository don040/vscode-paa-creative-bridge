const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);

test("publishes a separate UI companion with the required base extension", () => {
  assert.equal(
    manifest.publisher + "." + manifest.name,
    "chrisczopnik.dayz-paa-creative-bridge",
  );
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.extensionKind, ["ui"]);
  assert.deepEqual(manifest.extensionDependencies, [
    "chrisczopnik.dayz-paa-preview",
  ]);
  assert.ok(
    manifest.activationEvents.includes(
      "onCustomEditor:chrisczopnik.dayzPaaPreview",
    ),
  );
});

test("contributes Photoshop commands, a local PAA context action, and a machine path", () => {
  const openCommand = "dayzPaaCreativeBridge.openInPhotoshop";
  const selectCommand = "dayzPaaCreativeBridge.selectPhotoshop";
  assert.ok(
    manifest.contributes.commands.some((entry) => entry.command === openCommand),
  );
  assert.ok(
    manifest.contributes.commands.some((entry) => entry.command === selectCommand),
  );
  assert.ok(
    manifest.contributes.menus["explorer/context"].some(
      (entry) =>
        entry.command === openCommand &&
        entry.when === "resourceExtname == .paa || resourceExtname == .PAA",
    ),
  );
  assert.deepEqual(
    manifest.contributes.configuration.properties[
      "dayzPaaCreativeBridge.photoshopPath"
    ],
    {
      type: "string",
      scope: "machine",
      default: "",
      markdownDescription: "%configuration.photoshopPath%",
    },
  );
});

test("ships a 256 by 256 neutral PNG icon", () => {
  assert.equal(manifest.icon, "media/icon.png");
  const png = fs.readFileSync(path.join(root, manifest.icon));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
});

test("provides complete English and German manifest localization", () => {
  for (const fileName of ["package.nls.json", "package.nls.de.json"]) {
    const localized = JSON.parse(
      fs.readFileSync(path.join(root, fileName), "utf8"),
    );
    for (const key of [
      "extension.displayName",
      "extension.description",
      "command.openInPhotoshop",
      "command.selectPhotoshop",
      "configuration.title",
      "configuration.photoshopPath",
    ]) {
      assert.equal(typeof localized[key], "string");
      assert.ok(localized[key].trim());
    }
  }
});

test("registers the toolbar action through API version 1", () => {
  const source = fs.readFileSync(path.join(root, "src", "extension.ts"), "utf8");
  assert.match(source, /api\?\.apiVersion === 1/);
  assert.match(source, /registerPreviewAction\(\{/);
  assert.match(source, /"Open in Adobe Photoshop"/);
  assert.match(source, /icon: "imageEditor"/);
  assert.match(source, /order: 200/);
  assert.match(source, /!result\.path/);
  assert.match(source, /child\.once\("error"[\s\S]*this\.invalidate\(\)/);
});
