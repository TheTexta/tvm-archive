// Adapted from Timothy Lottes' PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER.
// Original: https://www.shadertoy.com/view/XsjSzR
// Reference port: https://github.com/libretro/glsl-shaders/blob/master/crt/shaders/crt-lottes.glsl
// Lottes: "Please take and use, change, or whatever."
// This video adaptation omits bloom and uses a screen-local, distance-filtered mask.

export function crtRaster(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  )
    return [320, 240] as const;
  const rows = Math.min(height, 240);
  return [Math.max(1, Math.round((width / height) * rows)), rows] as const;
}

export const crtVertexShader = /* glsl */ `
  varying vec2 screenUv;
  void main() {
    screenUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const crtFragmentShader = /* glsl */ `
  uniform sampler2D tvVideo;
  uniform float tvAspect;
  uniform vec2 tvRaster;
  uniform float tvCrt;
  varying vec2 screenUv;

  vec3 videoLinear(vec2 uv) {
    // Custom video samplers do not get Three's built-in map sRGB decoding.
    // Decode once here; colorspace_fragment performs the sole output encoding.
    return sRGBTransferEOTF(texture2D(tvVideo, uv)).rgb;
  }

  vec3 fetchSample(vec2 uv, vec2 offset) {
    vec2 sampleUv = (floor(uv * tvRaster + offset) + 0.5) / tvRaster;
    if (any(lessThan(sampleUv, vec2(0.0))) ||
        any(greaterThan(sampleUv, vec2(1.0)))) return vec3(0.0);
    return videoLinear(sampleUv);
  }

  float gaussian(float distance, float hardness) {
    return exp2(hardness * distance * distance);
  }

  vec3 horizontal(vec2 uv, float row, bool wide) {
    float distance = 0.5 - fract(uv.x * tvRaster.x);
    float left = gaussian(distance - 1.0, -3.0);
    float middle = gaussian(distance, -3.0);
    float right = gaussian(distance + 1.0, -3.0);
    vec3 color = fetchSample(uv, vec2(-1.0, row)) * left
      + fetchSample(uv, vec2(0.0, row)) * middle
      + fetchSample(uv, vec2(1.0, row)) * right;
    float weight = left + middle + right;
    if (wide) {
      float outerLeft = gaussian(distance - 2.0, -3.0);
      float outerRight = gaussian(distance + 2.0, -3.0);
      color += fetchSample(uv, vec2(-2.0, row)) * outerLeft
        + fetchSample(uv, vec2(2.0, row)) * outerRight;
      weight += outerLeft + outerRight;
    }
    return color / weight;
  }

  vec3 scanlines(vec2 uv) {
    float distance = 0.5 - fract(uv.y * tvRaster.y);
    return 1.05 * (
      horizontal(uv, -1.0, false) * gaussian(distance - 1.0, -5.0)
      + horizontal(uv, 0.0, true) * gaussian(distance, -5.0)
      + horizontal(uv, 1.0, false) * gaussian(distance + 1.0, -5.0)
    );
  }

  void main() {
    vec2 aperture = screenUv * 2.0 - 1.0;
    vec2 warped = aperture * (1.0 + tvCrt * vec2(0.008, 0.012)
      * aperture.yx * aperture.yx);
    vec2 uv = warped * 0.5 + 0.5;
    float screenAspect = 0.52 / 0.442;
    vec2 filmSize = tvAspect > screenAspect
      ? vec2(1.0, screenAspect / tvAspect)
      : vec2(tvAspect / screenAspect, 1.0);
    vec2 filmUv = (uv - 0.5) / filmSize + 0.5;

    // Derivatives stay outside divergent branches. Filter the emulated raster
    // and phosphor pattern out before either becomes subpixel during parallax.
    vec2 footprint = fwidth(filmUv) * tvRaster;
    float lineVisibility = 1.0 - smoothstep(0.4, 1.0, footprint.y);
    vec2 maskUv = screenUv * vec2(360.0, 306.0);
    float maskVisibility = 1.0 - smoothstep(0.5, 1.0, fwidth(maskUv.x));

    vec3 color = vec3(0.0);
    if (all(lessThanEqual(abs(uv - 0.5), filmSize * 0.5))) {
      color = videoLinear(filmUv);
      if (tvCrt > 0.0) {
        if (lineVisibility > 0.0)
          color = mix(color, scanlines(filmUv), lineVisibility * 0.8);
        // Smooth, RGB aperture grille anchored to the glass, not gl_FragCoord.
        vec3 mask = 1.0 + 0.12 * cos(6.2831853 * (
          maskUv.x / 3.0 + vec3(0.0, -1.0 / 3.0, -2.0 / 3.0)));
        color *= mix(vec3(1.0), mask, maskVisibility);
      }
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;
