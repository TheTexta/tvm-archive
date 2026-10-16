export type RayTriangle = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type RayGeometry = {
  data: Float32Array;
  width: number;
  height: number;
  nodeCount: number;
  triangleOffset: number;
  triangleCount: number;
};

// A small, static, stackless BVH. Each node has two RGBA texels:
// min.xyz / subtree escape index, max.xyz / (leaf triangle offset + 1).
// Leaves hold four triangles (three texels each), padded with degenerate faces.
export function buildRayGeometry(
  triangles: readonly RayTriangle[],
): RayGeometry {
  if (!triangles.length || triangles.length > 2048)
    throw new Error(
      "The bezel prototype needs 1–2048 nearby opaque triangles.",
    );
  if (
    triangles.some(
      (triangle) =>
        triangle.length !== 9 || triangle.some((n) => !Number.isFinite(n)),
    )
  )
    throw new Error("Ray geometry must contain finite triangle vertices.");
  const nodes: number[][] = [];
  const faces: number[] = [];
  const build = (items: readonly RayTriangle[]) => {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const triangle of items) {
      for (let vertex = 0; vertex < 3; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], triangle[vertex * 3 + axis]);
          max[axis] = Math.max(max[axis], triangle[vertex * 3 + axis]);
        }
      }
    }
    const node = [...min, 0, ...max, 0];
    nodes.push(node);
    if (items.length <= 4) {
      node[7] = faces.length / 12 + 1;
      for (let i = 0; i < 4; i++) {
        const triangle = items[i];
        for (let vertex = 0; vertex < 3; vertex++)
          faces.push(
            triangle?.[vertex * 3] ?? 0,
            triangle?.[vertex * 3 + 1] ?? 0,
            triangle?.[vertex * 3 + 2] ?? 0,
            0,
          );
      }
    } else {
      const extents = max.map((value, axis) => value - min[axis]);
      const axis = extents.indexOf(Math.max(...extents));
      const sorted = [...items].sort(
        (a, b) =>
          a[axis] +
          a[axis + 3] +
          a[axis + 6] -
          b[axis] -
          b[axis + 3] -
          b[axis + 6],
      );
      const middle = Math.floor(sorted.length / 2);
      build(sorted.slice(0, middle));
      build(sorted.slice(middle));
    }
    node[3] = nodes.length;
  };
  build(triangles);
  const packed = [...nodes.flat(), ...faces];
  const texels = packed.length / 4;
  const width = Math.min(256, texels);
  const height = Math.ceil(texels / width);
  const data = new Float32Array(width * height * 4);
  data.set(packed);
  return {
    data,
    width,
    height,
    nodeCount: nodes.length,
    triangleOffset: nodes.length * 2,
    triangleCount: triangles.length,
  };
}
