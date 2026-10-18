// 都道府県GeoJSON → パズル用SVGパスデータ(js/prefectures.js)を生成する
// 使い方: node tools/build-prefectures.mjs <japan.geojson>
// 元データ: 地球地図日本(国土地理院) https://www.gsi.go.jp/kankyochiri/gm_jpn.html
//           を GeoJSON 化した https://github.com/dataofjapan/land (japan.geojson)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { r1, ringArea, bboxOf, simplifyRing, labelPoint, pathD } from './geo-utils.mjs';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-prefectures.mjs <japan.geojson>'); process.exit(1); }
const outFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js/prefectures.js');

const BOARD_W = 1000;
const PAD = 18;
const SIMPLIFY_PX = 0.45;   // ダグラス・ポーカー許容誤差(px)
const MIN_ISLAND_PX2 = 5;   // これより小さい島は省略(px²)
const OKINAWA = 47;

// 離島の扱い: 緯度で足切り(ピースが極端に間延びしないように)
const LAT_CUT = { 13: 35.2, 46: 30.0 }; // 東京都=伊豆・小笠原諸島, 鹿児島県=奄美以南

const REGION = (id) => id === 1 ? '北海道' : id <= 7 ? '東北' : id <= 14 ? '関東' : id <= 23 ? '中部'
  : id <= 30 ? '近畿' : id <= 35 ? '中国' : id <= 39 ? '四国' : '九州・沖縄';

const geo = JSON.parse(fs.readFileSync(src, 'utf8'));
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180 / Math.PI;

// 1) 投影(メルカトル, 未スケール)と離島の足切り
const prefs = geo.features.map((f) => {
  const id = f.properties.id;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const kept = polys.filter((poly) => {
    const lat = poly[0].reduce((s, p) => s + p[1], 0) / poly[0].length;
    return !(LAT_CUT[id] && lat < LAT_CUT[id]);
  }).map((poly) => poly.map((ring) => ring.map(([lon, lat]) => [lon, -mercY(lat)])));
  return { id, name: f.properties.nam_ja, polys: kept };
}).sort((a, b) => a.id - b.id);

// 2) 本土の範囲からスケールを決定
const mainPts = prefs.filter((p) => p.id !== OKINAWA).flatMap((p) => p.polys.flatMap((poly) => poly[0]));
const mb = bboxOf(mainPts);
const scale = (BOARD_W - PAD * 2) / (mb.x1 - mb.x0);
const BOARD_H = Math.ceil((mb.y1 - mb.y0) * scale + PAD * 2);
const toBoard = ([x, y]) => [(x - mb.x0) * scale + PAD, (y - mb.y0) * scale + PAD];

for (const p of prefs) p.polys = p.polys.map((poly) => poly.map((ring) => ring.map(toBoard)));

// 3) 沖縄は左上の枠内に同縮尺で移す(はめ込み図)
const oki = prefs.find((p) => p.id === OKINAWA);
oki.polys = oki.polys.filter((poly) => Math.abs(ringArea(poly[0])) >= MIN_ISLAND_PX2 * 3);
const ob = bboxOf(oki.polys.flatMap((poly) => poly[0]));
const INSET_PAD = 14;
const dx = PAD + INSET_PAD - ob.x0, dy = PAD + INSET_PAD - ob.y0;
oki.polys = oki.polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [x + dx, y + dy])));
const inset = { x: PAD, y: PAD, w: ob.x1 - ob.x0 + INSET_PAD * 2, h: ob.y1 - ob.y0 + INSET_PAD * 2 };

// 4) 小島の除去と単純化
for (const p of prefs) {
  const areas = p.polys.map((poly) => Math.abs(ringArea(poly[0])));
  const maxA = Math.max(...areas);
  p.polys = p.polys
    .filter((poly, i) => areas[i] === maxA || areas[i] >= MIN_ISLAND_PX2)
    .map((poly) => poly.map((r) => simplifyRing(r, SIMPLIFY_PX)).filter((r) => r.length >= 4 && Math.abs(ringArea(r)) >= 0.5));
}

// 5) ラベル位置と出力
const out = prefs.map((p) => {
  const areas = p.polys.map((poly) => Math.abs(ringArea(poly[0])));
  const main = p.polys[areas.indexOf(Math.max(...areas))];
  const lp = labelPoint(main);
  const all = p.polys.flatMap((poly) => poly[0]);
  const b = bboxOf(all);
  const d = pathD(p.polys);
  return {
    id: p.id, name: p.name, region: REGION(p.id),
    cx: r1(lp.x), cy: r1(lp.y), r: r1(lp.d),
    bbox: [r1(b.x0), r1(b.y0), r1(b.x1 - b.x0), r1(b.y1 - b.y0)],
    d,
  };
});

const js = `// 自動生成: node tools/build-prefectures.mjs <japan.geojson>
// 地図データ出典: 地球地図日本(国土地理院) https://www.gsi.go.jp/kankyochiri/gm_jpn.html を加工
// (GeoJSON化: dataofjapan/land https://github.com/dataofjapan/land)
window.JAPAN_MAP = ${JSON.stringify({ width: BOARD_W, height: BOARD_H, inset: Object.fromEntries(Object.entries(inset).map(([k, v]) => [k, r1(v)])), prefectures: out })};
`;
fs.writeFileSync(outFile, js);
console.log(`wrote ${outFile} (${(js.length / 1024).toFixed(0)} KB), board ${BOARD_W}x${BOARD_H}, inset`, inset);
for (const o of out) if (o.r < 6) console.log('  small label', o.name, o.r);
