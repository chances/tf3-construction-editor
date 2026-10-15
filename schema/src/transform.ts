import type { Mat4 } from "./types.ts";

export function identityMat4(): Mat4 {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export interface PositionYaw {
  x: number;
  y: number;
  z: number;
  /** Rotation about the Z axis in radians, counterclockwise seen from above. */
  yaw: number;
  /** Uniform scale. Defaults to 1. */
  scale?: number;
}

export function composeTransf({ x, y, z, yaw, scale = 1 }: PositionYaw): Mat4 {
  const c = Math.cos(yaw) * scale;
  const s = Math.sin(yaw) * scale;
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, scale, 0, x, y, z, 1];
}

/** Reads translation, yaw, and uniform scale. Tilt in the matrix is ignored. */
export function decomposeTransf(m: Mat4): Required<PositionYaw> {
  return {
    x: m[12],
    y: m[13],
    z: m[14],
    yaw: Math.atan2(m[1], m[0]),
    scale: Math.hypot(m[0], m[1], m[2]),
  };
}

/** Returns `a * b` for column-major 4x4 matrices. Applying it applies `b` first. */
export function multiplyMat4(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}

/** Applies a column-major 4x4 matrix to a point. */
export function transformPoint(
  m: Mat4,
  p: readonly [number, number, number],
): [number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function isMat4(value: unknown): value is Mat4 {
  return Array.isArray(value) && value.length === 16 &&
    value.every((n) => typeof n === "number" && Number.isFinite(n));
}
