import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ShaderChunk, ShaderLib } from "three";
import {
  excludeScreenAreaLight,
  screenFilmSize,
  screenLightBlend,
  screenRegionColors,
} from "../lib/screen-light-sampling.ts";

test("screen emission retains the position and colour of each video quadrant", () => {
  const rgba = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  assert.deepEqual(screenRegionColors(rgba, 2), [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 1, 1],
  ]);
  assert.deepEqual(screenRegionColors(new Uint8ClampedArray(16), 2), [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);
});

test("emission averages in linear light and includes black letterbox pixels", () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4);
  // One bright row in each region; the remaining rows are black.
  for (const y of [1, 2]) {
    for (let x = 0; x < 4; x++)
      rgba.fill(255, (y * 4 + x) * 4, (y * 4 + x) * 4 + 4);
  }
  for (const color of screenRegionColors(rgba, 4))
    assert.deepEqual(color, [0.5, 0.5, 0.5]);
  const grey = new Uint8ClampedArray(16).fill(128);
  for (const color of screenRegionColors(grey, 2))
    assert.ok(Math.abs(color[0] - 0.21586) < 0.00001);
  assert.throws(() => screenRegionColors(new Uint8ClampedArray(16), 3));
});

test("light sampling uses the same contain proportions as the playback screen", () => {
  const aperture = 0.52 / 0.442;
  assert.deepEqual(screenFilmSize(aperture, aperture), [1, 1]);
  const [wideWidth, wideHeight] = screenFilmSize(16 / 9, aperture);
  assert.equal(wideWidth, 1);
  assert.ok(Math.abs(wideHeight - aperture / (16 / 9)) < 1e-10);
  const [portraitWidth, portraitHeight] = screenFilmSize(9 / 16, aperture);
  assert.equal(portraitHeight, 1);
  assert.ok(portraitWidth < 1);
});

test("emission smoothing is frame-rate independent and bounds background-tab gaps", () => {
  const step = screenLightBlend(16);
  assert.ok(Math.abs((1 - step) ** 2 - (1 - screenLightBlend(32))) < 1e-12);
  assert.equal(screenLightBlend(0), 0);
  assert.equal(screenLightBlend(-10), 0);
  assert.equal(screenLightBlend(1000), screenLightBlend(100));
  assert.ok(step > 0 && step < 0.1);
});

test("cabinet material isolation targets the installed Three.js area-light hook only", () => {
  const shader = excludeScreenAreaLight(ShaderLib.standard.fragmentShader);
  assert.match(
    shader,
    /#undef RE_Direct_RectArea\n#include <lights_fragment_begin>/,
  );
  assert.match(
    ShaderChunk.lights_fragment_begin,
    /defined\( RE_Direct_RectArea \)/,
  );
  assert.match(
    ShaderChunk.lights_physical_pars_fragment,
    /#define RE_Direct_RectArea\s+RE_Direct_RectArea_Physical/,
  );
  assert.match(shader, /#include <lights_physical_pars_fragment>/);
  assert.throws(() => excludeScreenAreaLight("changed shader"));
});

test("the shipped Radiola has a separate recessed inner bezel for light isolation", () => {
  const asset = readFileSync(
    new URL("../public/models/construct-tv.glb", import.meta.url),
  );
  const jsonLength = asset.readUInt32LE(12);
  const scene = JSON.parse(asset.toString("utf8", 20, 20 + jsonLength));
  const bezel = scene.nodes.filter((node) => node.name === "Screen_LowB");
  assert.equal(bezel.length, 1);
  const mesh = scene.nodes[bezel[0].children[0]].mesh;
  const primitive = scene.meshes[mesh].primitives[0];
  const bounds = scene.accessors[primitive.attributes.POSITION];
  assert.ok(
    bounds.max[2] - bounds.min[2] > 0.03,
    "Retain the actual sloping bezel geometry",
  );
  assert.equal(scene.materials[primitive.material].name, "Radiola.001");
});
