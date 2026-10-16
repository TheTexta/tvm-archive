import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("the published Construct asset contains one TV and no furniture or baked frames", () => {
  const asset = readFileSync(
    new URL("../public/models/construct-tv.glb", import.meta.url),
  );
  assert.equal(asset.toString("ascii", 0, 4), "glTF");
  assert.equal(asset.readUInt32LE(4), 2);
  assert.ok(asset.length < 8 * 1024 * 1024, "Ship a TV, not the source scene");

  const jsonLength = asset.readUInt32LE(12);
  const scene = JSON.parse(asset.toString("utf8", 20, 20 + jsonLength));
  const names = scene.nodes.map((node) => node.name ?? "");
  assert.equal(names.filter((name) => name === "PlaybackScreen").length, 1);
  assert.ok(names.some((name) => name === "TV Case"));
  assert.ok(!names.some((name) => /chair|table|TV.Screen/i.test(name)));
  assert.ok(!scene.images.some((image) => /Square_/i.test(image.name ?? "")));
  assert.equal(
    scene.images.filter((image) => image.name === "Radiola_normal").length,
    1,
    "Identical normal-map pixels should not be shipped twice",
  );

  const screen = scene.nodes.find((node) => node.name === "PlaybackScreen");
  assert.ok(screen && Number.isInteger(screen.mesh));
  assert.ok(
    scene.meshes[screen.mesh].primitives[0].attributes.TEXCOORD_0 !== undefined,
  );
});

test("the optional Radiola atlas retains its original resolution", () => {
  const jpeg = readFileSync(
    new URL("../public/models/construct-tv-color-2k.jpg", import.meta.url),
  );
  assert.equal(jpeg.readUInt16BE(0), 0xffd8);
  assert.ok(jpeg.length < 3 * 1024 * 1024);
  for (let i = 2; i < jpeg.length;) {
    if (jpeg[i++] !== 0xff) continue;
    const marker = jpeg[i++];
    if (marker === 0xc0 || marker === 0xc2) {
      assert.equal(jpeg.readUInt16BE(i + 3), 2048);
      assert.equal(jpeg.readUInt16BE(i + 5), 2048);
      return;
    }
    if (marker === 0xda || marker === 0xd9) break;
    i += jpeg.readUInt16BE(i);
  }
  assert.fail("JPEG dimensions not found");
});
