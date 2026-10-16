import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RectAreaLight,
  Texture,
  UniformsLib,
  Vector3,
} from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import {
  excludeScreenAreaLight,
  SCREEN_LIGHT_RADIANCE,
  SCREEN_LIGHT_SAMPLE_SIZE,
  screenFilmSize,
  screenLightBlend,
  screenRegionColors,
} from "./screen-light-sampling";

let textureUsers = 0;

function acquireLightTextures() {
  if (textureUsers === 0) RectAreaLightUniformsLib.init();
  textureUsers++;
  return () => {
    if (--textureUsers !== 0) return;
    // These optional, shared LTC tables are not owned by the GLB materials.
    for (const [name, texture] of Object.entries(UniformsLib)) {
      if (name.startsWith("LTC_") && texture instanceof Texture)
        texture.dispose();
    }
  };
}

export type ScreenLighting = {
  readonly mode: "regional" | "raytraced";
  readonly raySamples?: number;
  reduceQuality?: () => boolean;
  update: (now: number) => boolean;
  readonly settling: boolean;
  dispose: () => void;
};

export function createScreenLighting(
  model: Group,
  screen: Mesh,
  video: HTMLVideoElement,
  onMaterialClone?: (
    original: MeshStandardMaterial,
    clone: MeshStandardMaterial,
  ) => () => void,
): ScreenLighting | null {
  const bezel = model.getObjectByName("Screen_LowB");
  const receivers: Mesh[] = [];
  bezel?.traverse((node) => {
    if (node instanceof Mesh && node.material instanceof MeshStandardMaterial)
      receivers.push(node);
  });
  if (!receivers.length) return null;

  const canvas = document.createElement("canvas");
  const size = SCREEN_LIGHT_SAMPLE_SIZE;
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  // Clone the bezel's shared Radiola material before excluding screen light
  // from the originals used by the cabinet, logos, controls, and legs.
  const originals = new Map<Mesh, MeshStandardMaterial>();
  const clones: MeshStandardMaterial[] = [];
  const releaseMaterials: Array<() => void> = [];
  const suppressed = new Map<
    MeshStandardMaterial,
    {
      compile: MeshStandardMaterial["onBeforeCompile"];
      cacheKey: MeshStandardMaterial["customProgramCacheKey"];
    }
  >();
  receivers.forEach((mesh) => {
    const original = mesh.material as MeshStandardMaterial;
    originals.set(mesh, original);
    const clone = original.clone();
    clone.name = original.name;
    // Material.clone() does not preserve shader callbacks. Keep the cabinet's
    // material-local light processing on the isolated bezel, too.
    clone.onBeforeCompile = original.onBeforeCompile;
    clone.customProgramCacheKey = original.customProgramCacheKey;
    mesh.material = clone;
    clones.push(clone);
    if (onMaterialClone)
      releaseMaterials.push(onMaterialClone(original, clone));
  });
  model.traverse((node) => {
    if (!(node instanceof Mesh) || originals.has(node)) return;
    const materials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    materials.forEach((material) => {
      if (
        !(material instanceof MeshStandardMaterial) ||
        suppressed.has(material)
      )
        return;
      const compile = material.onBeforeCompile;
      const cacheKey = material.customProgramCacheKey;
      const originalKey = cacheKey.call(material);
      suppressed.set(material, { compile, cacheKey });
      material.onBeforeCompile = function (shader, renderer) {
        compile.call(this, shader, renderer);
        shader.fragmentShader = excludeScreenAreaLight(shader.fragmentShader);
      };
      material.customProgramCacheKey = () => `${originalKey}:no-screen-area-v1`;
      material.needsUpdate = true;
    });
  });

  const releaseTextures = acquireLightTextures();
  const lights = new Group();
  lights.name = "Video-reactive screen emission";
  model.updateWorldMatrix(true, true);
  screen.geometry.computeBoundingBox();
  const bounds = screen.geometry.boundingBox as Box3;
  const dimensions = bounds.getSize(new Vector3());
  const worldScale = screen.getWorldScale(new Vector3());
  const width = dimensions.x * worldScale.x;
  const height = dimensions.y * worldScale.y;
  const screenAspect = width / height;
  const orientation = screen.getWorldQuaternion(new Quaternion());
  // RectAreaLight emits along local -Z; this model's screen faces local +Z.
  orientation.multiply(
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI),
  );
  const regions = Array.from({ length: 4 }, (_, index) => {
    const light = new RectAreaLight(
      0x000000,
      SCREEN_LIGHT_RADIANCE,
      width / 2,
      height / 2,
    );
    light.name = `Screen emission ${["top left", "top right", "bottom left", "bottom right"][index]}`;
    light.position.set(
      bounds.min.x + dimensions.x * (index % 2 ? 0.75 : 0.25),
      bounds.max.y - dimensions.y * (index < 2 ? 0.25 : 0.75),
      bounds.max.z + 0.0001,
    );
    screen.localToWorld(light.position);
    light.quaternion.copy(orientation);
    lights.add(light);
    return light;
  });
  // World-space lights avoid RectAreaLight's intentional disregard of scale.
  // The exported TV is stationary; only the camera moves during parallax.
  model.parent?.add(lights);
  const targets = Array.from({ length: 4 }, () => new Color(0, 0, 0));
  let previousFrame = 0;
  let lastSample = -Infinity;
  let lastVideoTime = NaN;
  let settling = false;
  let disposed = false;

  return {
    mode: "regional",
    get settling() {
      return settling;
    },
    update(now) {
      if (disposed) return false;
      if (
        video.readyState >= 2 &&
        (video.paused || video.ended || now - lastSample >= 100) &&
        video.currentTime !== lastVideoTime
      ) {
        try {
          const aspect = video.videoWidth / video.videoHeight;
          const [filmWidth, filmHeight] = screenFilmSize(aspect, screenAspect);
          context.fillStyle = "#000";
          context.fillRect(0, 0, size, size);
          context.drawImage(
            video,
            ((1 - filmWidth) * size) / 2,
            ((1 - filmHeight) * size) / 2,
            filmWidth * size,
            filmHeight * size,
          );
          const colors = screenRegionColors(
            context.getImageData(0, 0, size, size).data,
            size,
          );
          colors.forEach((color, index) =>
            targets[index].setRGB(color[0], color[1], color[2]),
          );
          lastSample = now;
          lastVideoTime = video.currentTime;
        } catch {
          // CORS/readback failures must never interrupt archive playback.
          return false;
        }
      }
      const blend = screenLightBlend(
        previousFrame ? now - previousFrame : 16.7,
      );
      previousFrame = now;
      settling = false;
      regions.forEach((light, index) => {
        light.color.lerp(targets[index], blend);
        if (
          Math.abs(light.color.r - targets[index].r) +
            Math.abs(light.color.g - targets[index].g) +
            Math.abs(light.color.b - targets[index].b) >
          0.001
        )
          settling = true;
        else light.color.copy(targets[index]);
      });
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      lights.removeFromParent();
      suppressed.forEach(({ compile, cacheKey }, material) => {
        material.onBeforeCompile = compile;
        material.customProgramCacheKey = cacheKey;
        material.needsUpdate = true;
      });
      originals.forEach((material, mesh) => {
        mesh.material = material;
      });
      releaseMaterials.forEach((release) => release());
      clones.forEach((material) => material.dispose());
      releaseTextures();
      canvas.width = canvas.height = 0;
    },
  };
}
