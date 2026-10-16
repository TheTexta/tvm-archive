import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canTrialAfterBaseline,
  canTrialTextureDetail,
  defaultToEnhancedDetail,
  enhancedDetailIsSmooth,
  p90FrameTime,
} from "../lib/scene-quality.ts";

const desktop = {
  width: 1200,
  height: 800,
  pixelRatio: 2,
  deviceMemory: 8,
  hardwareConcurrency: 8,
};

test("texture detail uses conservative hints but allows capable mobile and unreported hardware", () => {
  assert.equal(defaultToEnhancedDetail(desktop, true), true);
  assert.equal(
    defaultToEnhancedDetail({ ...desktop, width: 390 }, true),
    false,
  );
  assert.equal(defaultToEnhancedDetail(desktop, false), false);
  assert.equal(
    defaultToEnhancedDetail({ ...desktop, saveData: true }, true),
    false,
  );
  assert.equal(
    defaultToEnhancedDetail({ ...desktop, deviceMemory: 2 }, true),
    true,
  );
  assert.equal(canTrialTextureDetail(desktop), true);
  assert.equal(
    canTrialTextureDetail({
      ...desktop,
      deviceMemory: undefined,
      hardwareConcurrency: undefined,
    }),
    true,
  );
  assert.equal(canTrialTextureDetail({ ...desktop, saveData: true }), false);
  assert.equal(canTrialTextureDetail({ ...desktop, deviceMemory: 2 }), false);
  assert.equal(
    canTrialTextureDetail({ ...desktop, hardwareConcurrency: 2 }),
    false,
  );
  assert.equal(canTrialTextureDetail({ ...desktop, width: 390 }), true);
  assert.equal(canTrialTextureDetail({ ...desktop, width: 2600 }), false);
});

test("enhanced detail needs stable playback and falls back after sustained slow frames", () => {
  assert.equal(p90FrameTime(Array(59).fill(16)), null);
  assert.equal(canTrialAfterBaseline(Array(90).fill(16.7)), true);
  assert.equal(canTrialAfterBaseline(Array(90).fill(24)), false);
  assert.equal(enhancedDetailIsSmooth(16.7, Array(59).fill(16.7)), null);
  assert.equal(enhancedDetailIsSmooth(16.7, Array(90).fill(17)), true);
  assert.equal(enhancedDetailIsSmooth(16.7, Array(90).fill(24)), false);
  assert.equal(enhancedDetailIsSmooth(8.3, Array(90).fill(17)), false);
});
