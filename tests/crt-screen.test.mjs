import assert from "node:assert/strict";
import { test } from "node:test";
import {
  crtFragmentShader,
  crtRaster,
  crtVertexShader,
} from "../lib/crt-screen.ts";

test("CRT sampling preserves recording proportions without upsampling small sources", () => {
  assert.deepEqual(crtRaster(640, 480), [320, 240]);
  assert.deepEqual(crtRaster(1920, 1080), [427, 240]);
  assert.deepEqual(crtRaster(240, 180), [240, 180]);
  assert.deepEqual(crtRaster(480, 640), [180, 240]);
});

test("CRT sampling has a safe raster before video metadata is available", () => {
  for (const [width, height] of [
    [0, 0],
    [640, 0],
    [-1, 480],
    [NaN, 480],
    [640, Infinity],
  ]) {
    assert.deepEqual(crtRaster(width, height), [320, 240]);
  }
});

test("screen shader keeps its mask local and filters subpixel patterns", () => {
  assert.match(crtVertexShader, /screenUv = uv/);
  const code = crtFragmentShader.replace(/\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /gl_FragCoord|uniform float.*[Tt]ime/);
  assert.match(crtFragmentShader, /fwidth\(filmUv\)/);
  assert.match(crtFragmentShader, /fwidth\(maskUv.x\)/);
  assert.match(crtFragmentShader, /if \(tvCrt > 0.0\)/);
});

test("screen shader explicitly decodes video and encodes output only once", () => {
  assert.match(
    crtFragmentShader,
    /sRGBTransferEOTF\(texture2D\(tvVideo, uv\)\)/,
  );
  assert.equal(
    crtFragmentShader.match(/#include <colorspace_fragment>/g)?.length,
    1,
  );
  assert.doesNotMatch(crtFragmentShader, /tonemapping_fragment/);
  assert.match(crtFragmentShader, /vec3 color = vec3\(0.0\)/);
  assert.match(
    crtFragmentShader,
    /lessThanEqual\(abs\(uv - 0.5\), filmSize \* 0.5\)/,
  );
});
