import {
  Box3,
  DataTexture,
  DataUtils,
  FloatType,
  Group,
  HalfFloatType,
  LinearFilter,
  LinearSRGBColorSpace,
  Matrix3,
  Mesh,
  MeshStandardMaterial,
  RGBAFormat,
  Vector3,
} from "three";
import { buildRayGeometry, type RayTriangle } from "./bezel-ray-geometry";
import { injectBezelRays } from "./bezel-ray-shader";
import type { ScreenLighting } from "./screen-lighting";
import {
  SCREEN_LIGHT_RADIANCE,
  screenFilmSize,
  screenLightBlend,
  screenPixelRadiance,
} from "./screen-light-sampling";

const SAMPLE_SIZE = 32;
// Do not repeatedly retry an expensive sample count on every shuffle.
let sampleCeiling = 64;

export function createBezelRayLighting(
  model: Group,
  screen: Mesh,
  video: HTMLVideoElement,
  onMaterialClone?: (
    original: MeshStandardMaterial,
    clone: MeshStandardMaterial,
  ) => () => void,
): ScreenLighting | null {
  const bezel = model.getObjectByName("Screen_LowB");
  if (!bezel) return null;
  const receivers: Mesh[] = [];
  bezel.traverse((node) => {
    if (node instanceof Mesh && node.material instanceof MeshStandardMaterial)
      receivers.push(node);
  });
  if (!receivers.length) return null;

  model.updateWorldMatrix(true, true);
  const corridor = new Box3()
    .setFromObject(screen)
    .union(new Box3().setFromObject(bezel))
    .expandByScalar(0.002);
  const triangles: RayTriangle[] = [];
  const triangleBox = new Box3();
  const a = new Vector3(),
    b = new Vector3(),
    c = new Vector3();
  model.traverse((node) => {
    if (!(node instanceof Mesh) || node === screen || !node.visible) return;
    const positions = node.geometry.getAttribute("position");
    if (!positions) return;
    const indices = node.geometry.getIndex();
    const count = indices?.count ?? positions.count;
    for (let offset = 0; offset < count; offset += 3) {
      a.fromBufferAttribute(
        positions,
        indices?.getX(offset) ?? offset,
      ).applyMatrix4(node.matrixWorld);
      b.fromBufferAttribute(
        positions,
        indices?.getX(offset + 1) ?? offset + 1,
      ).applyMatrix4(node.matrixWorld);
      c.fromBufferAttribute(
        positions,
        indices?.getX(offset + 2) ?? offset + 2,
      ).applyMatrix4(node.matrixWorld);
      triangleBox
        .makeEmpty()
        .expandByPoint(a)
        .expandByPoint(b)
        .expandByPoint(c);
      if (triangleBox.intersectsBox(corridor))
        triangles.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]);
    }
  });
  const geometry = buildRayGeometry(triangles);
  const geometryTexture = new DataTexture(
    geometry.data,
    geometry.width,
    geometry.height,
    RGBAFormat,
    FloatType,
  );
  geometryTexture.needsUpdate = true;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    geometryTexture.dispose();
    return null;
  }
  const current = new Float32Array(SAMPLE_SIZE * SAMPLE_SIZE * 4);
  const target = new Float32Array(current.length);
  const encoded = new Uint16Array(current.length);
  for (let i = 3; i < encoded.length; i += 4)
    encoded[i] = DataUtils.toHalfFloat(1);
  const emission = new DataTexture(
    encoded,
    SAMPLE_SIZE,
    SAMPLE_SIZE,
    RGBAFormat,
    HalfFloatType,
  );
  emission.colorSpace = LinearSRGBColorSpace;
  emission.minFilter = emission.magFilter = LinearFilter;
  emission.needsUpdate = true;

  screen.geometry.computeBoundingBox();
  const bounds = screen.geometry.boundingBox!;
  const origin = screen.localToWorld(
    new Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
  );
  const screenU = screen
    .localToWorld(new Vector3(bounds.max.x, bounds.max.y, bounds.max.z))
    .sub(origin);
  const screenV = screen
    .localToWorld(new Vector3(bounds.min.x, bounds.min.y, bounds.max.z))
    .sub(origin);
  const screenNormal = new Vector3().crossVectors(screenV, screenU).normalize();
  const screenArea = new Vector3().crossVectors(screenU, screenV).length();
  const screenAspect = screenU.length() / screenV.length();
  const requestedSamples = Number(
    new URLSearchParams(window.location.search).get("raySamples"),
  );
  const samples = [16, 32, 64].includes(requestedSamples)
    ? requestedSamples
    : 32;
  const sampleCount = { value: Math.min(samples, sampleCeiling) };
  const originals = new Map<Mesh, MeshStandardMaterial>();
  const clones: MeshStandardMaterial[] = [];
  const releases: Array<() => void> = [];
  receivers.forEach((mesh) => {
    const original = mesh.material as MeshStandardMaterial;
    const clone = original.clone();
    clone.name = original.name;
    const compile = original.onBeforeCompile;
    const originalKey = original.customProgramCacheKey.call(original);
    const uniforms = {
      tvRayGeometry: { value: geometryTexture },
      tvRayEmission: { value: emission },
      tvRayTextureWidth: { value: geometry.width },
      tvRayTriangleOffset: { value: geometry.triangleOffset },
      tvRayScreenOrigin: { value: origin },
      tvRayScreenU: { value: screenU },
      tvRayScreenV: { value: screenV },
      tvRayScreenNormal: { value: screenNormal },
      tvRayScreenArea: { value: screenArea },
      tvRayRadiance: { value: SCREEN_LIGHT_RADIANCE },
      tvRaySampleCount: sampleCount,
      tvRayNormalMatrix: {
        value: new Matrix3().getNormalMatrix(mesh.matrixWorld),
      },
    };
    clone.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      const injected = injectBezelRays(
        shader.vertexShader,
        shader.fragmentShader,
        geometry.nodeCount,
        samples,
      );
      shader.vertexShader = injected.vertex;
      shader.fragmentShader = injected.fragment;
    };
    clone.customProgramCacheKey = () =>
      `${originalKey}:bezel-ray-v1:${geometry.nodeCount}:${samples}`;
    clone.userData.screenRays = {
      samples,
      triangles: geometry.triangleCount,
      nodes: geometry.nodeCount,
    };
    originals.set(mesh, original);
    mesh.material = clone;
    clones.push(clone);
    if (onMaterialClone) releases.push(onMaterialClone(original, clone));
  });

  let lastSample = -Infinity;
  let lastVideoTime = NaN;
  let previousFrame = 0;
  let settling = false;
  let disposed = false;
  return {
    mode: "raytraced",
    get raySamples() {
      return sampleCount.value;
    },
    reduceQuality() {
      if (sampleCount.value <= 16) return false;
      sampleCount.value /= 2;
      sampleCeiling = Math.min(sampleCeiling, sampleCount.value);
      return true;
    },
    get settling() {
      return settling;
    },
    update(now) {
      if (disposed) return false;
      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTime &&
        (video.paused || video.ended || now - lastSample >= 100)
      ) {
        try {
          const [width, height] = screenFilmSize(
            video.videoWidth / video.videoHeight,
            screenAspect,
          );
          context.fillStyle = "#000";
          context.fillRect(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
          context.drawImage(
            video,
            ((1 - width) * SAMPLE_SIZE) / 2,
            ((1 - height) * SAMPLE_SIZE) / 2,
            width * SAMPLE_SIZE,
            height * SAMPLE_SIZE,
          );
          screenPixelRadiance(
            context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data,
            target,
          );
          lastVideoTime = video.currentTime;
          lastSample = now;
        } catch {
          return false;
        }
      }
      const blend = screenLightBlend(
        previousFrame ? now - previousFrame : 16.7,
      );
      previousFrame = now;
      settling = false;
      let changed = false;
      for (let offset = 0; offset < current.length; offset += 4) {
        for (let channel = 0; channel < 3; channel++) {
          const i = offset + channel;
          const difference = target[i] - current[i];
          if (Math.abs(difference) > 0.0003) settling = true;
          const value =
            Math.abs(difference) > 0.0003
              ? current[i] + difference * blend
              : target[i];
          changed ||= value !== current[i];
          current[i] = value;
          encoded[i] = DataUtils.toHalfFloat(value);
        }
      }
      if (changed) emission.needsUpdate = true;
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      originals.forEach((material, mesh) => {
        mesh.material = material;
      });
      releases.forEach((release) => release());
      clones.forEach((material) => material.dispose());
      geometryTexture.dispose();
      emission.dispose();
      canvas.width = canvas.height = 0;
    },
  };
}
