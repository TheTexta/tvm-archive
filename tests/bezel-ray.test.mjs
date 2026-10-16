import assert from "node:assert/strict";
import { test } from "node:test";
import { Box3, Ray, ShaderLib, Vector3 } from "three";
import { buildRayGeometry } from "../lib/bezel-ray-geometry.ts";
import {
  bezelRayContribution,
  bezelRayShader,
  injectBezelRays,
} from "../lib/bezel-ray-shader.ts";
import { screenPixelRadiance } from "../lib/screen-light-sampling.ts";

// Interpret the packed GPU layout using Three's independent ray/triangle
// implementation, so leaf offsets, subtree escapes, and padding are exercised.
function blocked(geometry, start, end) {
  const distance = start.distanceTo(end);
  const ray = new Ray(start, end.clone().sub(start).normalize());
  const data = geometry.data;
  let node = 0;
  const hit = new Vector3();
  for (
    let step = 0;
    step < geometry.nodeCount && node < geometry.nodeCount;
    step++
  ) {
    const offset = node * 8;
    const box = new Box3(
      new Vector3().fromArray(data, offset),
      new Vector3().fromArray(data, offset + 4),
    );
    if (!ray.intersectBox(box, hit) || hit.distanceTo(start) > distance) {
      // An origin inside a node intersects its exit face, potentially beyond
      // the segment. It still needs testing against that node's triangles.
      if (!box.containsPoint(start)) {
        node = data[offset + 3];
        continue;
      }
    }
    if (data[offset + 7] > 0) {
      const first = data[offset + 7] - 1;
      for (let face = 0; face < 4; face++) {
        const base = (geometry.triangleOffset + (first + face) * 3) * 4;
        if (
          ray.intersectTriangle(
            new Vector3().fromArray(data, base),
            new Vector3().fromArray(data, base + 4),
            new Vector3().fromArray(data, base + 8),
            false,
            hit,
          )
        ) {
          const travel = hit.distanceTo(start);
          if (travel > 0.0001 && travel < distance) return true;
        }
      }
      node = data[offset + 3];
    } else node++;
  }
  return false;
}

test("packed BVH blocks actual segments, not rays ending before the surface", () => {
  const geometry = buildRayGeometry([[-1, -1, 0, 1, -1, 0, 0, 1, 0]]);
  assert.equal(
    blocked(geometry, new Vector3(0, 0, 1), new Vector3(0, 0, -1)),
    true,
  );
  assert.equal(
    blocked(geometry, new Vector3(0, 0, 1), new Vector3(0, 0, 0.5)),
    false,
  );
  assert.equal(
    blocked(geometry, new Vector3(2, 0, 1), new Vector3(2, 0, -1)),
    false,
  );
  assert.equal(
    blocked(geometry, new Vector3(0, 0, -1), new Vector3(0, 0, 1)),
    true,
  );
});

test("stackless BVH visits both subtrees and padded leaves without phantom blockers", () => {
  const triangles = Array.from({ length: 29 }, (_, i) => {
    const x = i * 3;
    return [x - 1, -1, 0, x + 1, -1, 0, x, 1, 0];
  });
  const geometry = buildRayGeometry(triangles);
  assert.ok(geometry.nodeCount > 1);
  assert.equal(geometry.data[3], geometry.nodeCount);
  assert.equal(geometry.triangleOffset, geometry.nodeCount * 2);
  for (let i = 0; i < 29; i++) {
    const x = i * 3;
    assert.equal(
      blocked(geometry, new Vector3(x, 0, 1), new Vector3(x, 0, -1)),
      true,
    );
    assert.equal(
      blocked(
        geometry,
        new Vector3(x + 1.5, 0, 1),
        new Vector3(x + 1.5, 0, -1),
      ),
      false,
    );
  }
  assert.throws(() => buildRayGeometry([]));
  assert.throws(() => buildRayGeometry([[NaN, 0, 0, 1, 0, 0, 0, 1, 0]]));
});

test("ray shader integrates visibility-tested screen samples through the PBR light equation", () => {
  const shader = injectBezelRays(
    ShaderLib.standard.vertexShader,
    ShaderLib.standard.fragmentShader,
    31,
    32,
  );
  assert.match(shader.vertex, /modelMatrix \* vec4\(transformed, 1.0\)/);
  assert.match(shader.fragment, /texelFetch\(tvRayGeometry/);
  assert.match(shader.fragment, /step < 31/);
  assert.match(shader.fragment, /ray < 32/);
  assert.match(shader.fragment, /!tvRayBlocked/);
  assert.match(shader.fragment, /RE_Direct\(screenRay/);
  assert.match(shader.fragment, /distance \* distance/);
  assert.doesNotMatch(shader.fragment, /uniform float.*[Tt]ime|gl_FragCoord/);
  assert.throws(() => injectBezelRays("changed", "changed", 1, 32));
  assert.throws(() => bezelRayShader(0, 32));
  assert.throws(() => bezelRayContribution(128));
});

test("ray-traced emission preserves individual pixel colours in linear light", () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 128, 255, 255, 0, 0, 0, 255,
  ]);
  const target = new Float32Array(12);
  screenPixelRadiance(pixels, target);
  assert.deepEqual(Array.from(target.slice(0, 4)), [1, 0, 0, 1]);
  assert.ok(Math.abs(target[5] - 0.21586) < 0.00001);
  assert.deepEqual(Array.from(target.slice(8)), [0, 0, 0, 1]);
  assert.throws(() => screenPixelRadiance(pixels, new Float32Array(4)));
});
