// 世界の国境データ → 大陸ごとのパズル用データ(js/maps/<大陸>.js)を生成する
// 使い方: node tools/build-world.mjs <ne_50m_admin_0_countries.geojson>
// 元データ: Natural Earth (パブリックドメイン) https://www.naturalearthdata.com/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { r1, ringArea, bboxOf, simplifyRing, labelPoint, pathD, clipRing } from './geo-utils.mjs';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-world.mjs <ne_50m_admin_0_countries.geojson>'); process.exit(1); }
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js/maps');
fs.mkdirSync(outDir, { recursive: true });

const BOARD_W = 1000;
const PAD = 14;
const SIMPLIFY_PX = 0.4;
const MIN_ISLAND_PX2 = 3;      // これより小さい島は省略
const MIN_PIECE_PX2 = 40;      // これより小さい国は「最初からはまっている」固定ピースにする
const MIN_DEPENDENCY_PX2 = 300; // 海外領土などはさらに大きくないとピースにしない

// 大陸ごとの設定: center=投影の中心(経度,緯度) view=表示範囲(西,南,東,北)
const REGIONS = [
  { id: 'asia', name: 'アジア', center: [88, 30], view: [25, -11, 150, 60], continents: ['Asia'], add: ['RUS', 'MDV'],
    regions: ['東アジア', '東南アジア', '南アジア', '中央アジア・ロシア', '西アジア'],
    regionOf: (a3, sub) => (a3 === 'RUS' || sub === 'Central Asia' ? '中央アジア・ロシア' : SUBREGION_JA[sub]) },
  { id: 'europe', name: 'ヨーロッパ', center: [15, 52], view: [-25, 34, 50, 71.5], continents: ['Europe'],
    regions: ['北ヨーロッパ', '西ヨーロッパ', '南ヨーロッパ', '東ヨーロッパ'] },
  { id: 'africa', name: 'アフリカ', center: [17, 2], view: [-26, -36, 60, 38], continents: ['Africa'], add: ['SYC', 'MUS'],
    regions: ['北アフリカ', '西アフリカ', '中部アフリカ', '東アフリカ', '南部アフリカ'] },
  { id: 'northamerica', name: '北アメリカ', center: [-100, 50], view: [-170, 6, -10, 84], continents: ['North America'],
    exclude: [[-180, 15, -140, 30]], // ハワイは北アメリカ大陸の図から外す
    regions: ['北アメリカ北部', '中央アメリカ', 'カリブ海'] },
  { id: 'southamerica', name: '南アメリカ', center: [-60, -22], view: [-82, -56, -33, 13], continents: ['South America'],
    add: ['FRA'], rename: { FRA: 'フランス領ギアナ' },
    regions: ['南アメリカ北部', '南アメリカ南部'],
    regionOf: (a3) => (['BOL', 'PRY', 'URY', 'ARG', 'CHL', 'FLK'].includes(a3) ? '南アメリカ南部' : '南アメリカ北部') },
  { id: 'oceania', name: 'オセアニア', center: [150, -25], view: [110, -50, 180, 0], continents: ['Oceania'], regions: [] },
];

// 地方ステージ用: Natural Earth の SUBREGION → 日本語の地域名
const SUBREGION_JA = {
  'Eastern Asia': '東アジア', 'South-Eastern Asia': '東南アジア', 'Southern Asia': '南アジア', 'Central Asia': '中央アジア', 'Western Asia': '西アジア',
  'Northern Europe': '北ヨーロッパ', 'Western Europe': '西ヨーロッパ', 'Southern Europe': '南ヨーロッパ', 'Eastern Europe': '東ヨーロッパ',
  'Northern Africa': '北アフリカ', 'Western Africa': '西アフリカ', 'Middle Africa': '中部アフリカ', 'Eastern Africa': '東アフリカ', 'Southern Africa': '南部アフリカ',
  'Northern America': '北アメリカ北部', 'Central America': '中央アメリカ', 'Caribbean': 'カリブ海',
};

// 日本の地図帳の表記に合わせる
const MERGE = { SOL: 'SOM', CYN: 'CYP' }; // ソマリランド→ソマリア, 北キプロス→キプロス
const ALWAYS_FIXED = new Set(['KAS']);     // 係争地の小区域はピースにしない
const SHORT = {
  USA: 'アメリカ合衆国', CHN: '中国', KOR: '韓国', PRK: '北朝鮮', TWN: '台湾', MNG: 'モンゴル', THA: 'タイ', MLI: 'マリ',
  KOS: 'コソボ', ZAF: '南アフリカ', CAF: '中央アフリカ', GBR: 'イギリス', CZE: 'チェコ',
};

// 国旗ガチャ・図鑑に入れる国(日本が国家として承認している国＋北朝鮮。台湾・パレスチナ・西サハラなどの地域は入れない)
const GACHA_TYPES = new Set(['Sovereign country', 'Country', 'Sovereignty', 'Disputed']);
const GACHA_EXCLUDE = new Set(['TWN', 'PSX', 'SAH', 'FLK', 'IOT', 'KAS', 'GRL', 'JEY', 'GGY', 'IMN', 'ALD', 'ABW', 'CUW', 'SXM', 'MAC', 'HKG']);

const geo = JSON.parse(fs.readFileSync(src, 'utf8'));
const polysOf = (f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);

// ランベルト正積方位図法
function projector([lon0, lat0]) {
  const rad = Math.PI / 180, s0 = Math.sin(lat0 * rad), c0 = Math.cos(lat0 * rad);
  return ([lon, lat]) => {
    let dl = lon - lon0; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
    const p = lat * rad, l = dl * rad, sp = Math.sin(p), cp = Math.cos(p), cl = Math.cos(l);
    const k = Math.sqrt(2 / Math.max(1e-9, 1 + s0 * sp + c0 * cp * cl));
    return [k * cp * Math.sin(l), -k * (c0 * sp - s0 * cp * cl)];
  };
}
const inBox = ([lon, lat], [w, s, e, n]) => lon >= w && lon <= e && lat >= s && lat <= n;

const index = [], countries = new Map();
for (const R of REGIONS) {
  const proj = projector(R.center);
  const members = new Map(); // ADM0 → {name, fixed, type, polys(lonlat)}
  const context = [];
  for (const f of geo.features) {
    const p = f.properties, a3 = MERGE[p.ADM0_A3] || p.ADM0_A3;
    const isMember = R.continents.includes(p.CONTINENT) || R.add?.includes(p.ADM0_A3) || (MERGE[p.ADM0_A3] && R.continents.includes(p.CONTINENT));
    if (p.CONTINENT === 'Antarctica') continue;
    if (!isMember) { context.push(...polysOf(f)); continue; }
    const polys = polysOf(f).filter((poly) => poly[0].some((pt) => inBox(pt, R.view))
      && !(R.exclude || []).some((box) => poly[0].every((pt) => inBox(pt, box))));
    if (!polys.length) continue;
    if (!members.has(a3)) {
      const host = geo.features.find((g) => g.properties.ADM0_A3 === a3).properties;
      members.set(a3, { a3, name: R.rename?.[a3] || SHORT[a3] || host.NAME_JA, baseName: SHORT[a3] || host.NAME_JA, type: host.TYPE, sub: host.SUBREGION, iso2: host.ISO_A2_EH, pop: host.POP_EST, lon: host.LABEL_X, lat: host.LABEL_Y, polys: [] });
    }
    members.get(a3).polys.push(...polys);
  }

  // 表示範囲: 大陸の国々の外接矩形と、view の投影範囲の重なり
  const projected = (polys) => polys.map((poly) => poly.map((ring) => ring.map(proj)));
  for (const m of members.values()) m.xy = projected(m.polys);
  const B = bboxOf([...members.values()].flatMap((m) => m.xy.flatMap((poly) => poly[0])));
  const [w, s, e, n] = R.view, edge = [];
  for (let i = 0; i <= 60; i++) { const t = i / 60; edge.push([w + (e - w) * t, s], [w + (e - w) * t, n], [w, s + (n - s) * t], [e, s + (n - s) * t]); }
  const V = bboxOf(edge.map(proj));
  const rect = { x0: Math.max(B.x0, V.x0), y0: Math.max(B.y0, V.y0), x1: Math.min(B.x1, V.x1), y1: Math.min(B.y1, V.y1) };
  const scale = (BOARD_W - PAD * 2) / (rect.x1 - rect.x0);
  const BOARD_H = Math.ceil((rect.y1 - rect.y0) * scale + PAD * 2);
  const toBoard = ([x, y]) => [(x - rect.x0) * scale + PAD, (y - rect.y0) * scale + PAD];
  const frame = { x0: PAD, y0: PAD, x1: BOARD_W - PAD, y1: BOARD_H - PAD };

  const prepare = (xyPolys, eps, minIsland, keepLargest) => {
    let polys = xyPolys
      .map((poly) => poly.map((ring) => clipRing(ring.map(toBoard), frame)))
      .filter((poly) => poly[0])
      .map((poly) => poly.filter(Boolean));
    const areas = polys.map((poly) => Math.abs(ringArea(poly[0])));
    const maxA = Math.max(0, ...areas);
    polys = polys.filter((_, i) => (keepLargest && areas[i] === maxA) || areas[i] >= minIsland)
      .map((poly) => poly.map((r) => simplifyRing(r, eps)).filter((r) => r.length >= 4 && Math.abs(ringArea(r)) >= 0.3))
      .filter((poly) => poly.length);
    return polys;
  };

  const pieces = [], fixed = [];
  for (const m of members.values()) {
    const polys = prepare(m.xy, SIMPLIFY_PX, MIN_ISLAND_PX2, true);
    if (GACHA_TYPES.has(m.type) && !GACHA_EXCLUDE.has(m.a3) && !countries.has(m.a3)) {
      // 地図に描けないほど小さい国(バチカンなど)も図鑑には入れる
      countries.set(m.a3, { a3: m.a3, iso2: m.iso2.toLowerCase(), name: m.baseName, map: R.id, pop: m.pop, lon: r1(m.lon), lat: r1(m.lat), shape: polys.length > 0 });
    }
    if (!polys.length) continue;
    const area = polys.reduce((a, poly) => a + Math.abs(ringArea(poly[0])), 0);
    const minArea = m.type === 'Dependency' ? MIN_DEPENDENCY_PX2 : MIN_PIECE_PX2;
    if (ALWAYS_FIXED.has(m.a3) || area < minArea) { fixed.push({ name: m.name, a3: m.a3, d: pathD(polys) }); continue; }
    const areas = polys.map((poly) => Math.abs(ringArea(poly[0])));
    const lp = labelPoint(polys[areas.indexOf(Math.max(...areas))]);
    const b = bboxOf(polys.flatMap((poly) => poly[0]));
    const region = R.regions.length ? (R.regionOf ? R.regionOf(m.a3, m.sub) : SUBREGION_JA[m.sub]) : undefined;
    if (R.regions.length && !R.regions.includes(region)) console.warn('  地域が未設定:', m.name, m.sub);
    pieces.push({ name: m.name, a3: m.a3, region, cx: r1(lp.x), cy: r1(lp.y), r: r1(lp.d), bbox: [r1(b.x0), r1(b.y0), r1(b.x1 - b.x0), r1(b.y1 - b.y0)], d: pathD(polys), area });
  }
  pieces.sort((a, b) => b.area - a.area);
  pieces.forEach((p, i) => { p.id = i + 1; delete p.area; });

  const ctx = pathD(prepare(projected(context), 0.8, 6, false));
  const data = { id: R.id, name: R.name, unit: '国', regions: R.regions, width: BOARD_W, height: BOARD_H, pieces, fixed, context: ctx };
  const js = `// 自動生成: node tools/build-world.mjs <ne_50m_admin_0_countries.geojson>
// 地図データ出典: Natural Earth (パブリックドメイン) https://www.naturalearthdata.com/
window.PUZZLE_MAPS = window.PUZZLE_MAPS || {};
window.PUZZLE_MAPS[${JSON.stringify(R.id)}] = ${JSON.stringify(data)};
`;
  fs.writeFileSync(path.join(outDir, `${R.id}.js`), js);
  index.push({ id: R.id, name: R.name, count: pieces.length, center: R.center, regions: R.regions.map((r) => ({ name: r, count: pieces.filter((p) => p.region === r).length })) });
  console.log(`${R.name}: ${pieces.length}ピース + 固定${fixed.length} / ${BOARD_W}x${BOARD_H} / ${(js.length / 1024).toFixed(0)}KB`);
  for (const r of R.regions) console.log(`   ${r}: ${pieces.filter((p) => p.region === r).map((p) => p.name).join(' ')}`);
  console.log('   固定:', fixed.map((p) => p.name).join(' '));
}

// メニュー用の一覧(地図データ本体は遊ぶときに読み込む)
fs.writeFileSync(path.join(outDir, 'index.js'), `// 自動生成: node tools/build-world.mjs
window.WORLD_MAP_INDEX = ${JSON.stringify(index)};
`);

// 国旗ガチャ・図鑑用の国一覧(豆知識・ありがとうは js/country-facts.js)
fs.writeFileSync(path.join(outDir, 'countries.js'), `// 自動生成: node tools/build-world.mjs
window.COUNTRY_INDEX = ${JSON.stringify([...countries.values()])};
`);
console.log('ガチャの国:', countries.size, 'か国');

// 地球儀用の軽い世界地図(経度・緯度のまま)。m = その国が入っている大陸パズル
{
  const GLOBE_EPS = 0.3, GLOBE_MIN_AREA = 0.08;
  const mapsOf = (p) => REGIONS.filter((R) => R.continents.includes(p.CONTINENT) || R.add?.includes(p.ADM0_A3)).map((R) => R.id);
  const feats = [];
  let points = 0;
  for (const g of geo.features) {
    const p = g.properties;
    if (p.CONTINENT === 'Antarctica') continue;
    const polys = polysOf(g);
    const areas = polys.map((poly) => Math.abs(ringArea(poly[0])));
    const maxA = Math.max(...areas);
    const rings = polys.filter((_, i) => areas[i] === maxA || areas[i] >= GLOBE_MIN_AREA)
      .map((poly) => simplifyRing(poly[0], GLOBE_EPS)).filter((r) => r.length >= 4)
      .map((r) => r.slice(0, -1).flatMap(([x, y]) => [r1(x), r1(y)]));
    points += rings.reduce((n, r) => n + r.length / 2, 0);
    feats.push({ a3: MERGE[p.ADM0_A3] || p.ADM0_A3, m: mapsOf(p), r: rings });
  }
  const js = `// 自動生成: node tools/build-world.mjs  地図データ出典: Natural Earth (パブリックドメイン)
window.GLOBE_DATA = ${JSON.stringify(feats)};
`;
  fs.writeFileSync(path.join(outDir, 'globe.js'), js);
  console.log(`地球儀: ${feats.length}地域 / ${points}点 / ${(js.length / 1024).toFixed(0)}KB`);
}
