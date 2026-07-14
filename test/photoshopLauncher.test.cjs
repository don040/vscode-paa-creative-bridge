const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPhotoshopLaunchSpec,
} = require("../dist/photoshopLauncher.js");

test("passes a PAA path as one separate argument without a command shell", () => {
  const spec = createPhotoshopLaunchSpec(
    "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe",
    "P:\\Textures & Sources\\vest diffuse.paa",
  );

  assert.equal(
    spec.executablePath,
    "C:\\Program Files\\Adobe\\Adobe Photoshop 2026\\Photoshop.exe",
  );
  assert.deepEqual(spec.arguments, ["P:\\Textures & Sources\\vest diffuse.paa"]);
  assert.equal(spec.options.shell, false);
  assert.equal(spec.options.detached, true);
  assert.equal(spec.options.stdio, "ignore");
  assert.equal(Object.isFrozen(spec), true);
  assert.equal(Object.isFrozen(spec.arguments), true);
  assert.equal(Object.isFrozen(spec.options), true);
});

test("rejects relative, non-Photoshop, and non-PAA paths", () => {
  assert.throws(
    () => createPhotoshopLaunchSpec("relative\\Photoshop.exe", "P:\\x.paa"),
    /executable path is invalid/,
  );
  assert.throws(
    () => createPhotoshopLaunchSpec("C:\\Windows\\notepad.exe", "P:\\x.paa"),
    /executable path is invalid/,
  );
  assert.throws(
    () => createPhotoshopLaunchSpec("C:\\Adobe\\Photoshop.exe", "P:\\x.png"),
    /PAA path is invalid/,
  );
});
