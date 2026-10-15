export type Point2 = [number, number];

/** A triangle as x0, y0, x1, y1, x2, y2. */
export type Triangle2 = [number, number, number, number, number, number];

const MAX_CELLS = 160;

function overlapsRect(
  t: Triangle2,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  const xs = [t[0], t[2], t[4]];
  const ys = [t[1], t[3], t[5]];
  if (Math.max(...xs) < x0 || Math.min(...xs) > x1) return false;
  if (Math.max(...ys) < y0 || Math.min(...ys) > y1) return false;
  const corners: Point2[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let e = 0; e < 3; e++) {
    const ax = xs[e], ay = ys[e];
    const bx = xs[(e + 1) % 3], by = ys[(e + 1) % 3];
    const nx = -(by - ay), ny = bx - ax;
    const tri = xs.map((x, i) => nx * (x - ax) + ny * (ys[i] - ay));
    const box = corners.map(([x, y]) => nx * (x - ax) + ny * (y - ay));
    if (
      Math.max(...tri) < Math.min(...box) || Math.min(...tri) > Math.max(...box)
    ) return false;
  }
  return true;
}

function distanceToSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / len;
}

/** Douglas-Peucker on an open polyline. Both end points are kept. */
function douglasPeucker(points: Point2[], epsilon: number): Point2[] {
  if (points.length <= 2) return points;
  const last = points.length - 1;
  let worst = -1, at = -1;
  for (let i = 1; i < last; i++) {
    const d = distanceToSegment(points[i], points[0], points[last]);
    if (d > worst) [worst, at] = [d, i];
  }
  if (worst <= epsilon) return [points[0], points[last]];
  const left = douglasPeucker(points.slice(0, at + 1), epsilon);
  const right = douglasPeucker(points.slice(at), epsilon);
  return [...left.slice(0, -1), ...right];
}

/** Simplifies a closed loop by splitting it at the point farthest from point 0. */
function simplifyLoop(loop: Point2[], epsilon: number): Point2[] {
  let far = 0;
  let best = -1;
  for (let i = 1; i < loop.length; i++) {
    const d = Math.hypot(loop[i][0] - loop[0][0], loop[i][1] - loop[0][1]);
    if (d > best) [best, far] = [d, i];
  }
  if (far === 0) return loop;
  const a = douglasPeucker(loop.slice(0, far + 1), epsilon);
  const b = douglasPeucker([...loop.slice(far), loop[0]], epsilon);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

function signedArea(loop: Point2[]): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const [x0, y0] = loop[i];
    const [x1, y1] = loop[(i + 1) % loop.length];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/**
 * Top-down outline of a triangle soup. Triangles are rasterized into at most
 * 160 cells along the long side, then the boundary of the filled cells is
 * traced and simplified. Holes come back as separate loops.
 */
export function silhouette(triangles: Triangle2[]): Point2[][] {
  if (triangles.length === 0) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const t of triangles) {
    for (let i = 0; i < 6; i += 2) {
      minX = Math.min(minX, t[i]);
      maxX = Math.max(maxX, t[i]);
      minY = Math.min(minY, t[i + 1]);
      maxY = Math.max(maxY, t[i + 1]);
    }
  }
  const size = Math.max(maxX - minX, maxY - minY);
  if (!(size > 0)) return [];
  const cell = size / MAX_CELLS;
  const nx = Math.ceil((maxX - minX) / cell) + 1;
  const ny = Math.ceil((maxY - minY) / cell) + 1;
  const filled = new Uint8Array(nx * ny);

  for (const t of triangles) {
    const bx0 = Math.floor((Math.min(t[0], t[2], t[4]) - minX) / cell);
    const bx1 = Math.floor((Math.max(t[0], t[2], t[4]) - minX) / cell);
    const by0 = Math.floor((Math.min(t[1], t[3], t[5]) - minY) / cell);
    const by1 = Math.floor((Math.max(t[1], t[3], t[5]) - minY) / cell);
    for (let j = by0; j <= by1; j++) {
      for (let i = bx0; i <= bx1; i++) {
        if (filled[j * nx + i]) continue;
        const x0 = minX + i * cell, y0 = minY + j * cell;
        if (overlapsRect(t, x0, y0, x0 + cell, y0 + cell)) {
          filled[j * nx + i] = 1;
        }
      }
    }
  }

  const at = (i: number, j: number) =>
    i >= 0 && j >= 0 && i < nx && j < ny && filled[j * nx + i] === 1;
  const vkey = (x: number, y: number) => y * (nx + 1) + x;
  const edges = new Map<number, [number, number][]>();
  const add = (ax: number, ay: number, bx: number, by: number) => {
    const key = vkey(ax, ay);
    const list = edges.get(key) ?? [];
    list.push([bx, by]);
    edges.set(key, list);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (!at(i, j)) continue;
      if (!at(i, j - 1)) add(i, j, i + 1, j);
      if (!at(i + 1, j)) add(i + 1, j, i + 1, j + 1);
      if (!at(i, j + 1)) add(i + 1, j + 1, i, j + 1);
      if (!at(i - 1, j)) add(i, j + 1, i, j);
    }
  }

  const loops: Point2[][] = [];
  for (const [startKey, outs] of edges) {
    while (outs.length > 0) {
      const sx = startKey % (nx + 1), sy = Math.floor(startKey / (nx + 1));
      const loop: Point2[] = [];
      let cx = sx, cy = sy;
      for (;;) {
        loop.push([minX + cx * cell, minY + cy * cell]);
        const next = edges.get(vkey(cx, cy))?.pop();
        if (!next) break;
        [cx, cy] = next;
        if (cx === sx && cy === sy) break;
      }
      if (loop.length >= 3) loops.push(loop);
    }
  }

  const result: Point2[][] = [];
  for (const loop of loops) {
    const simple = simplifyLoop(loop, cell * 0.75);
    if (simple.length >= 3 && Math.abs(signedArea(simple)) > cell * cell) {
      result.push(simple);
    }
  }
  return result;
}
