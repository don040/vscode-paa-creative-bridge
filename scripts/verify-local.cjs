const assert = require("node:assert/strict");
const fs = require("node:fs");

const { resolvePhotoshop } = require("../dist/photoshopDiscovery.js");

(async () => {
  assert.equal(process.platform, "win32", "Local verification requires Windows.");
  const resolution = await resolvePhotoshop();
  assert.ok(resolution.path, "Adobe Photoshop was not discovered.");
  assert.equal(
    resolution.path.toLowerCase().endsWith("\\photoshop.exe"),
    true,
    "The discovered executable is not Photoshop.exe.",
  );
  assert.equal(fs.statSync(resolution.path).isFile(), true);
  process.stdout.write(
    JSON.stringify(
      {
        path: resolution.path,
        source: resolution.source,
        checked: resolution.checked,
      },
      null,
      2,
    ) + "\n",
  );
})().catch((error) => {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
