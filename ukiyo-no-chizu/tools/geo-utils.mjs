// 地図ビルド用の共通ジオメトリ処理(座標はすべて投影後の平面座標)

export const r1 = (v) => Math.round(v * 10) / 10;

export const ringArea = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return a / 2; };
export const bboxOf = (pts) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };

// ダグラス・ポーカー法
export function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const vx = bx - ax, vy = by - ay, len2 = vx * vx + vy * vy;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let t = len2 ? ((px - ax) * vx + (py - ay) * vy) / len2 : 0; t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// 閉じたリングは2分割して処理(始点=終点での退化を防ぐ)
export function simplifyRing(ring, eps) {
  const mid = Math.floor(ring.length / 2);
  return [...dp(ring.slice(0, mid + 1), eps), ...dp(ring.slice(mid), eps).slice(1)];
}

export function pointInRing(x, y, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function distToRing(x, y, r) {
  let m = Infinity;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [ax, ay] = r[j], [bx, by] = r[i];
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy;
    let t = l2 ? ((x - ax) * vx + (y - ay) * vy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    m = Math.min(m, Math.hypot(x - (ax + t * vx), y - (ay + t * vy)));
  }
  return m;
}

// ラベル位置: ポリゴン内で縁から最も遠い点を格子探索
export function labelPoint(poly) {
  const outer = poly[0];
  const b = bboxOf(outer);
  let best = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, d: -1 };
  let step = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 30;
  let cx0 = b.x0, cy0 = b.y0, cx1 = b.x1, cy1 = b.y1;
  for (let pass = 0; pass < 3; pass++) {
    for (let x = cx0; x <= cx1; x += step) for (let y = cy0; y <= cy1; y += step) {
      if (!pointInRing(x, y, outer) || poly.slice(1).some((h) => pointInRing(x, y, h))) continue;
      const d = Math.min(...poly.map((r) => distToRing(x, y, r)));
      if (d > best.d) best = { x, y, d };
    }
    cx0 = best.x - step; cx1 = best.x + step; cy0 = best.y - step; cy1 = best.y + step; step /= 6;
  }
  return best;
}

// ポリゴン群 → SVGパス文字列
export const pathD = (polys) => polys.map((poly) => poly.map((ring) => 'M' + ring.slice(0, -1).map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z').join('')).join('');

// サザーランド・ホッジマン法でリングを矩形に切り抜く(地図の枠で国を切る)
export function clipRing(ring, { x0, y0, x1, y1 }) {
  const edges = [
    [(p) => p[0] >= x0, (a, b) => { const t = (x0 - a[0]) / (b[0] - a[0]); return [x0, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= x1, (a, b) => { const t = (x1 - a[0]) / (b[0] - a[0]); return [x1, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= y0, (a, b) => { const t = (y0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y0]; }],
    [(p) => p[1] <= y1, (a, b) => { const t = (y1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y1]; }],
  ];
  let pts = ring.slice(0, -1);
  for (const [inside, cross] of edges) {
    if (!pts.length) break;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i], prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) { if (!inside(prev)) out.push(cross(prev, cur)); out.push(cur); }
      else if (inside(prev)) out.push(cross(prev, cur));
    }
    pts = out;
  }
  return pts.length >= 3 ? [...pts, pts[0]] : null;
}
