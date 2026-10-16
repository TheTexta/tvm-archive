import type { MeshStandardMaterial } from "three";

// Visual/technical reference: P_Malin's Meta CRT (4dlyWX), via the source port:
// https://github.com/libretro/glsl-shaders/tree/master/crt/shaders/metacrt
// Reuse the rational tone-curve equation and hemisphere-lighting principle,
// not the reference's scene, textures, raymarcher, or temporal post stack.
export function referenceToneMap(value: number) {
  const x = Math.max(0, Math.min(value, 10_000));
  return (x * (x + 13.2)) / (x * (x + 16.3) + 10.1);
}

export function processMaterialFragment(fragment: string) {
  const lightHook = "#include <lights_fragment_begin>";
  const toneHook = "#include <tonemapping_fragment>";
  if (!fragment.includes(lightHook) || !fragment.includes(toneHook))
    throw new Error("The material light-processing shader hooks changed.");
  return fragment
    .replace(
      lightHook,
      /* glsl */ `
    ${lightHook}
    #if defined(RE_IndirectDiffuse)
      // The reference weights ambient light by the world-space up normal.
      // Retain some lower-hemisphere fill for this site's existing white floor.
      vec3 tvWorldNormal = inverseTransformDirection(geometryNormal, viewMatrix);
      float tvSkyWeight = 0.25 + 0.75 * clamp(tvWorldNormal.y * 0.5 + 0.5, 0.0, 1.0);
      irradiance += getAmbientLightIrradiance(ambientLightColor) * (tvSkyWeight - 1.0);
    #endif
  `,
    )
    .replace(
      toneHook,
      /* glsl */ `
    // Material-local display transform, before Three's single sRGB encoding.
    // Do not also apply renderer tone mapping or a full-frame colour pass.
    vec3 tvLinearLight = clamp(gl_FragColor.rgb, vec3(0.0), vec3(10000.0));
    gl_FragColor.rgb = tvLinearLight * (tvLinearLight + 13.2)
      / (tvLinearLight * (tvLinearLight + 16.3) + 10.1);
  `,
    );
}

export function configureMaterialLightProcessing(
  material: MeshStandardMaterial,
) {
  const compile = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey.call(material);
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.fragmentShader = processMaterialFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () =>
    `${originalKey}:meta-crt-light-response-v1`;
  material.needsUpdate = true;
}
