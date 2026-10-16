// Actual screen-to-bezel visibility rays, not a screen-space glow or an SDF
// approximation of the cabinet. The BVH contains the model's real triangles.
export function bezelRayShader(nodeCount: number, samples: number) {
  if (!Number.isInteger(nodeCount) || nodeCount < 1 || nodeCount > 1023)
    throw new Error("Invalid bezel BVH size.");
  if (![16, 32, 64].includes(samples))
    throw new Error("Unsupported ray count.");
  return /* glsl */ `
    varying vec3 tvRayPosition;
    varying vec3 tvRayGeometricNormal;
    uniform sampler2D tvRayGeometry;
    uniform sampler2D tvRayEmission;
    uniform int tvRayTextureWidth;
    uniform int tvRayTriangleOffset;
    uniform vec3 tvRayScreenOrigin;
    uniform vec3 tvRayScreenU;
    uniform vec3 tvRayScreenV;
    uniform vec3 tvRayScreenNormal;
    uniform float tvRayScreenArea;
    uniform float tvRayRadiance;
    uniform int tvRaySampleCount;

    vec4 tvRayRead(int index) {
      return texelFetch(tvRayGeometry,
        ivec2(index % tvRayTextureWidth, index / tvRayTextureWidth), 0);
    }

    bool tvRayBox(vec3 origin, vec3 direction, float distance, vec3 low, vec3 high) {
      vec3 safeDirection = mix(vec3(1e-8), direction,
        greaterThan(abs(direction), vec3(1e-8)));
      vec3 a = (low - origin) / safeDirection;
      vec3 b = (high - origin) / safeDirection;
      vec3 nearHit = min(a, b);
      vec3 farHit = max(a, b);
      return max(max(nearHit.x, nearHit.y), max(nearHit.z, 0.0))
        <= min(min(farHit.x, farHit.y), min(farHit.z, distance));
    }

    bool tvRayTriangle(vec3 origin, vec3 direction, float distance, int triangle) {
      int offset = tvRayTriangleOffset + triangle * 3;
      vec3 a = tvRayRead(offset).xyz;
      vec3 edge1 = tvRayRead(offset + 1).xyz - a;
      vec3 edge2 = tvRayRead(offset + 2).xyz - a;
      vec3 p = cross(direction, edge2);
      float det = dot(edge1, p);
      if (abs(det) < 1e-8) return false;
      vec3 t = origin - a;
      float u = dot(t, p) / det;
      if (u < 0.0 || u > 1.0) return false;
      vec3 q = cross(t, edge1);
      float v = dot(direction, q) / det;
      if (v < 0.0 || u + v > 1.0) return false;
      float hit = dot(edge2, q) / det;
      return hit > 0.0001 && hit < distance;
    }

    bool tvRayBlocked(vec3 origin, vec3 direction, float distance) {
      int node = 0;
      for (int step = 0; step < ${nodeCount}; step++) {
        if (node >= ${nodeCount}) break;
        vec4 low = tvRayRead(node * 2);
        vec4 high = tvRayRead(node * 2 + 1);
        if (!tvRayBox(origin, direction, distance, low.xyz, high.xyz)) {
          node = int(low.w);
        } else if (high.w > 0.0) {
          int first = int(high.w) - 1;
          for (int face = 0; face < 4; face++) {
            if (tvRayTriangle(origin, direction, distance, first + face)) return true;
          }
          node = int(low.w);
        } else {
          node++;
        }
      }
      return false;
    }
  `;
}

export function bezelRayContribution(samples: number) {
  if (![16, 32, 64].includes(samples))
    throw new Error("Unsupported ray count.");
  return /* glsl */ `
    // Fixed low-discrepancy samples have no temporal accumulation, random
    // flicker, camera reset, or stale-video ghosting. One direct-light bounce.
    vec3 tvRayOrigin = tvRayPosition + normalize(tvRayGeometricNormal) * 0.0008;
    for (int ray = 0; ray < ${samples}; ray++) {
      if (ray >= tvRaySampleCount) break;
      vec2 sampleUv = fract((float(ray) + 0.5) * vec2(0.754877666, 0.569840291));
      vec3 source = tvRayScreenOrigin + tvRayScreenU * sampleUv.x
        + tvRayScreenV * sampleUv.y;
      vec3 delta = source - tvRayOrigin;
      float distance = length(delta);
      vec3 direction = delta / max(distance, 0.0001);
      float emittingCosine = max(dot(tvRayScreenNormal, -direction), 0.0);
      vec3 viewDirection = (viewMatrix * vec4(direction, 0.0)).xyz;
      if (emittingCosine > 0.0 && dot(geometryNormal, viewDirection) > 0.0) {
        vec3 emission = texture2D(tvRayEmission, sampleUv).rgb;
        if (max(max(emission.r, emission.g), emission.b) > 0.0001 &&
            !tvRayBlocked(tvRayOrigin, direction, distance - 0.0016)) {
          IncidentLight screenRay;
          screenRay.direction = viewDirection;
          screenRay.color = emission * tvRayRadiance * emittingCosine
            * tvRayScreenArea / (float(tvRaySampleCount) * max(distance * distance, 0.0001));
          screenRay.visible = true;
          RE_Direct(screenRay, geometryPosition, geometryNormal,
            geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
        }
      }
    }
  `;
}

export function injectBezelRays(
  vertex: string,
  fragment: string,
  nodeCount: number,
  samples: number,
) {
  const vertexHook = "#include <project_vertex>";
  const fragmentHook = "#include <lights_fragment_end>";
  if (!vertex.includes(vertexHook) || !fragment.includes(fragmentHook))
    throw new Error("The bezel prototype's PBR shader hooks changed.");
  return {
    vertex:
      /* glsl */ `
      varying vec3 tvRayPosition;
      varying vec3 tvRayGeometricNormal;
      uniform mat3 tvRayNormalMatrix;
    ` +
      vertex.replace(
        vertexHook,
        /* glsl */ `
      ${vertexHook}
      tvRayPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      tvRayGeometricNormal = tvRayNormalMatrix * objectNormal;
    `,
      ),
    fragment:
      bezelRayShader(nodeCount, samples) +
      fragment.replace(
        fragmentHook,
        fragmentHook + bezelRayContribution(samples),
      ),
  };
}
