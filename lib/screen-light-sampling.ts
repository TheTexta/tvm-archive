export const SCREEN_LIGHT_SAMPLE_SIZE = 24;
export const SCREEN_LIGHT_RADIANCE = 2.4;

const linear = Float32Array.from({ length: 256 }, (_, byte) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
});

export function screenPixelRadiance(
  pixels: Uint8ClampedArray,
  target: Float32Array,
) {
  if (!pixels.length || pixels.length % 4 || target.length !== pixels.length)
    throw new Error("Radiance buffers must have matching RGBA dimensions.");
  for (let offset = 0; offset < pixels.length; offset += 4) {
    for (let channel = 0; channel < 3; channel++)
      target[offset + channel] = linear[pixels[offset + channel]];
    target[offset + 3] = 1;
  }
}

// Canvas/video row order: top-left, top-right, bottom-left, bottom-right.
// Average in linear light, retaining black letterbox pixels in each region.
export function screenRegionColors(pixels: Uint8ClampedArray, size: number) {
  if (size < 2 || size % 2 || pixels.length !== size * size * 4)
    throw new Error("Screen samples must be an even square RGBA image.");
  const colors = Array.from({ length: 4 }, () => [0, 0, 0]);
  const count = (size * size) / 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const region = (y < size / 2 ? 0 : 2) + (x < size / 2 ? 0 : 1);
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++)
        colors[region][channel] += linear[pixels[offset + channel]] / count;
    }
  }
  return colors;
}

export function screenFilmSize(videoAspect: number, screenAspect: number) {
  return videoAspect > screenAspect
    ? [1, screenAspect / videoAspect]
    : [videoAspect / screenAspect, 1];
}

export function screenLightBlend(elapsedMs: number) {
  return 1 - Math.exp(-Math.max(0, Math.min(elapsedMs, 100)) / 180);
}

// Only the dedicated inner bezel should receive the screen's area lights.
// Undefining the direct-area-light hook leaves all other PBR lighting intact.
export function excludeScreenAreaLight(fragmentShader: string) {
  const marker = "#include <lights_fragment_begin>";
  if (!fragmentShader.includes(marker))
    throw new Error(
      "The PBR lighting shader no longer exposes its light hook.",
    );
  return fragmentShader.replace(marker, `#undef RE_Direct_RectArea\n${marker}`);
}
