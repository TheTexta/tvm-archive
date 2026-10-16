import assert from "node:assert/strict";
import { test } from "node:test";
import { MeshStandardMaterial, ShaderLib } from "three";
import {
  configureMaterialLightProcessing,
  processMaterialFragment,
  referenceToneMap,
} from "../lib/material-light-processing.ts";
import { excludeScreenAreaLight } from "../lib/screen-light-sampling.ts";

test("reference tone curve preserves black and rolls highlights off without clipping", () => {
  assert.equal(referenceToneMap(0), 0);
  assert.equal(referenceToneMap(-1), 0);
  assert.ok(Math.abs(referenceToneMap(0.18) - 0.1843) < 0.001);
  assert.ok(referenceToneMap(4) > referenceToneMap(1));
  assert.ok(referenceToneMap(4) < 1);
  assert.ok(Number.isFinite(referenceToneMap(Infinity)));
  let previous = 0;
  for (let i = 0; i < 1000; i++) {
    const value = referenceToneMap(i / 10);
    assert.ok(value >= previous && value < 1);
    previous = value;
  }
});

test("material processing keeps PBR/AO and output encoding, without a temporal post pass", () => {
  const shader = processMaterialFragment(ShaderLib.standard.fragmentShader);
  assert.match(
    shader,
    /inverseTransformDirection\(geometryNormal, viewMatrix\)/,
  );
  assert.match(shader, /#include <aomap_fragment>/);
  assert.match(shader, /#include <lights_physical_pars_fragment>/);
  assert.equal(shader.match(/#include <colorspace_fragment>/g).length, 1);
  assert.doesNotMatch(shader, /#include <tonemapping_fragment>/);
  assert.equal(
    shader.match(/sampler2D/g)?.length,
    ShaderLib.standard.fragmentShader.match(/sampler2D/g)?.length,
  );
  assert.doesNotMatch(shader, /[Vv]ignett|motionBlur|history/);
  assert.match(excludeScreenAreaLight(shader), /#undef RE_Direct_RectArea/);
  assert.throws(() => processMaterialFragment("changed shader"));
});

test("material callbacks compose with existing hooks and use an independent program key", () => {
  const material = new MeshStandardMaterial();
  let called = false;
  material.onBeforeCompile = () => {
    called = true;
  };
  const oldKey = material.customProgramCacheKey();
  configureMaterialLightProcessing(material);
  const shader = { fragmentShader: ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader, {});
  assert.equal(called, true);
  assert.match(material.customProgramCacheKey(), /meta-crt-light-response/);
  assert.notEqual(material.customProgramCacheKey(), oldKey);
  assert.match(shader.fragmentShader, /tvLinearLight/);
});
