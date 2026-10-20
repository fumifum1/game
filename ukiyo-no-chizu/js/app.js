(function () {
  'use strict';

  const SVGNS = 'http://www.w3.org/2000/svg';
  const NATIVE = window.Capacitor?.isNativePlatform?.() === true; // Androidアプリ(APK)として動いているか
  const HINT_PENALTY = 20;
  const ARTS = window.UKIYOE_ARTS;
  const WORLD_ARTS = window.WORLD_ARTS;

  // ===== 地図 =====
  const JAPAN = { id: 'japan', name: '日本', unit: '都道府県', ...window.JAPAN_MAP, pieces: window.JAPAN_MAP.prefectures, fixed: [], context: '' };
  // 日本の地方ステージ(都道府県データの region をまとめる)
  const JAPAN_STAGES = [['北海道・東北', ['北海道', '東北']], ['関東', ['関東']], ['中部', ['中部']], ['近畿', ['近畿']], ['中国・四国', ['中国', '四国']], ['九州・沖縄', ['九州・沖縄']]];
  const MAP_LIST = [
    { id: 'japan', name: '日本', count: JAPAN.pieces.length,
      regions: JAPAN_STAGES.map(([name, rs]) => ({ name, count: JAPAN.pieces.filter((p) => rs.includes(p.region)).length })) },
    ...window.WORLD_MAP_INDEX,
  ];
  const mapInfo = (id) => MAP_LIST.find((m) => m.id === id) || MAP_LIST[0];
  const stageIds = (map, stage) => {
    if (stage === 'all') return null;
    const g = map.id === 'japan' ? JAPAN_STAGES.find(([n]) => n === stage)?.[1] : [stage];
    return new Set(map.pieces.filter((p) => g?.includes(p.region)).map((p) => p.id));
  };

  // 現在の地図(ゲーム開始時に切り替える)
  let MAP = JAPAN, W = JAPAN.width, H = JAPAN.height, PIECES = JAPAN.pieces;

  // 世界地図データは大きいので、使うときに読み込む
  function loadMap(id) {
    if (id === 'japan') return Promise.resolve(JAPAN);
    const ready = () => window.PUZZLE_MAPS?.[id];
    if (ready()) return Promise.resolve(ready());
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = `js/maps/${id}.js`;
      s.onload = () => (ready() ? res(ready()) : rej(new Error('map data missing')));
      s.onerror = () => rej(new Error('map load error'));
      document.head.append(s);
    });
  }

  const DIFFS = [
    { key: 'easy', lv: '初級', name: '手ほどき', stars: 1, names: true, guide: true, tol: 1.5 },
    { key: 'names', lv: '中級', name: '名寄せ', stars: 2, names: true, guide: false, tol: 1.2 },
    { key: 'shapes', lv: '中級', name: '形合わせ', stars: 2, names: false, guide: true, tol: 1.2 },
    { key: 'master', lv: '上級', name: '達人', stars: 3, names: false, guide: false, tol: 1.0 },
  ];
  const diffOf = (key) => DIFFS.find((d) => d.key === key) || DIFFS[0];

  const $ = (s) => document.querySelector(s);
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }
  const shortName = (n) => (MAP.id !== 'japan' || n === '北海道' ? n : n.replace(/[都府県]$/, ''));
  const fmtTime = (sec) => { const s = Math.floor(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const LOCK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  const kobanEl = (n, sign = '') => { const b = h('b'); b.append(h('span', 'koban'), document.createTextNode(`${sign}${n}枚`)); return b; };

  // localStorage は使えない環境もあるので必ず try/catch
  const store = {
    get(k, d) { try { const v = localStorage.getItem('ukiyoe-puzzle:' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('ukiyoe-puzzle:' + k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } },
    clearAll() { try { Object.keys(localStorage).filter((k) => k.startsWith('ukiyoe-puzzle:')).forEach((k) => localStorage.removeItem(k)); } catch { /* 無視 */ } },
  };

  // ===== 表示設定 =====
  const SETTINGS_DEFAULT = { theme: 'paper', font: 'm', tray: 'auto', sound: store.get('sound', true), vibe: false, lift: true };
  const settings = { ...SETTINGS_DEFAULT, ...store.get('settings', {}) };
  const FONT_SCALE = { s: 0.94, m: 1, l: 1.15 };
  function applySettings() {
    const r = document.documentElement;
    r.dataset.theme = settings.theme; r.dataset.font = settings.font; r.dataset.tray = settings.tray;
    Sound.on = settings.sound;
    $('#btn-sound')?.classList.toggle('off', !settings.sound);
    store.set('settings', settings);
    if (S) setCam(S.cam.k, S.cam.tx, S.cam.ty);
    if (typeof pickGlobe !== 'undefined' && pickGlobe) { pickGlobe.theme = settings.theme; pickGlobe.draw(); }
  }

  // ===== 効果音(WebAudioで合成) =====
  const Sound = {
    ctx: null,
    on: true,
    ensure() {
      if (!this.on) return null;
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    tone(freq, t0, dur, type, vol) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
      return o;
    },
    pick() { const c = this.ensure(); if (c) this.tone(900, c.currentTime, 0.05, 'sine', 0.05); },
    snap() { // 拍子木のような「コン」
      const c = this.ensure(); if (!c) return;
      const t = c.currentTime;
      const o = this.tone(620, t, 0.16, 'sine', 0.35); o.frequency.exponentialRampToValueAtTime(420, t + 0.12);
      this.tone(1240, t, 0.05, 'triangle', 0.12);
    },
    coin() { // 小判の「チャリン」
      const c = this.ensure(); if (!c) return;
      const t = c.currentTime;
      this.tone(1568, t, 0.25, 'triangle', 0.12); this.tone(2093, t + 0.08, 0.35, 'triangle', 0.1);
    },
    rattle() { // ガチャのハンドル「ガラガラ」
      const c = this.ensure(); if (!c) return;
      const t = c.currentTime;
      for (let i = 0; i < 7; i++) this.tone(180 + Math.random() * 120, t + i * 0.11, 0.06, 'square', 0.05);
    },
    tick() { const c = this.ensure(); if (c) this.tone(1400 + Math.random() * 300, c.currentTime, 0.03, 'square', 0.03); },
    pop(rare) { // カプセルが開く「ポン」、レアは高い音を重ねる
      const c = this.ensure(); if (!c) return;
      const t = c.currentTime;
      const o = this.tone(300, t, 0.18, 'sine', 0.3); o.frequency.exponentialRampToValueAtTime(900, t + 0.12);
      if (rare >= 2) [1047, 1319, 1568].forEach((fq, i) => this.tone(fq, t + 0.15 + i * 0.09, 0.5, 'triangle', 0.12));
      if (rare >= 3) [2093, 2637].forEach((fq, i) => this.tone(fq, t + 0.45 + i * 0.1, 0.7, 'triangle', 0.1));
    },
    finish() { // 陽音階のアルペジオ
      const c = this.ensure(); if (!c) return;
      const t = c.currentTime;
      [587, 659, 784, 880, 988, 1175, 1319].forEach((f, i) => { this.tone(f, t + i * 0.11, 0.9, 'triangle', 0.16); this.tone(f * 2, t + i * 0.11, 0.3, 'sine', 0.03); });
    },
  };
  const vibrate = (ms) => { if (settings.vibe) navigator.vibrate?.(ms); };

  // ===== 小判とお店 =====
  // 小判はクリア・お題・称号でもらえ、お店で地図と絵柄を開ける
  const PRICES = {
    maps: { oceania: 50, southamerica: 80, northamerica: 100, europe: 150, asia: 200, africa: 200 },
    japan: { wave: 0, redfuji: 30, kameido: 50, shono: 70, ejiri: 90, atake: 120, kajikazawa: 150, naruto: 180, sanka: 220, gen: 300 },
    world: [0, 60, 90, 120, 150], // 各大陸の絵(1枚目は地図と一緒に開く)
  };
  const MULT = { easy: 0.5, names: 0.8, shapes: 0.8, master: 1.2 }; // 1ピースあたりの小判
  const SEC_PER = { easy: 6, names: 8, shapes: 8, master: 10 };    // 目標タイム(1ピースあたり秒)
  const GEN_ART = { id: 'gen', title: '創作浮世絵', artist: '遊ぶたびに新しく摺る' };

  const koban = () => store.get('koban', 0);
  function addKoban(n) {
    if (n <= 0) return;
    store.set('koban', koban() + n);
    store.set('kobanTotal', store.get('kobanTotal', 0) + n);
    renderWallet(true);
  }
  const owned = () => new Set(store.get('owned', []));
  const own = (key) => { const o = owned(); o.add(key); store.set('owned', [...o]); };
  const isMapOpen = (id) => id === 'japan' || owned().has('map:' + id);

  function artsFor(mapId) {
    const o = owned();
    if (mapId === 'japan') {
      return [...ARTS, GEN_ART].sort((x, y) => PRICES.japan[x.id] - PRICES.japan[y.id]).map((a) => {
        const price = PRICES.japan[a.id], key = `art:japan:${a.id}`;
        return { ...a, key, price, locked: price > 0 && !o.has(key) };
      });
    }
    return WORLD_ARTS[mapId].map((a, i) => {
      const key = `art:${mapId}:${a.id}`;
      return { ...a, key, price: PRICES.world[i] ?? 150, locked: i > 0 && !o.has(key) };
    });
  }
  const allArtsFor = (mapId) => [...artsFor(mapId), ...frameArts()];
  const artById = (mapId, id) => allArtsFor(mapId).find((a) => a.id === id);

  // 以前の版(修行点)で遊んでいた人の進み具合を小判の仕組みへ移す
  (function migrate() {
    if (store.get('migratedV2', false)) return;
    const pts = store.get('points', 0);
    const OLD = { redfuji: 1, kameido: 3, shono: 5, ejiri: 7, atake: 10, kajikazawa: 13, naruto: 16, sanka: 20, gen: 24 };
    if (pts > 0) {
      store.set('koban', koban() + pts * 20);
      for (const [id, need] of Object.entries(OLD)) if (pts >= need) own(`art:japan:${id}`);
    }
    for (const m of window.WORLD_MAP_INDEX) {
      const c = store.get('clears:' + m.id, 0);
      if (c > 0) { own('map:' + m.id); WORLD_ARTS[m.id].slice(1, c + 1).forEach((a) => own(`art:${m.id}:${a.id}`)); }
    }
    store.set('migratedV2', true);
  })();

  // 買う前の確認(足りないときは集め方を案内)
  function confirmBuy({ key, title, price }, after) {
    const have = koban();
    const body = h('div');
    if (have < price) {
      body.append(h('h3', null, '小判が足りません'),
        h('p', null, `「${title}」には小判${price}枚が必要です（あと${price - have}枚）。`),
        h('p', 'note', '地方ステージや今日のお題で小判を集めましょう。ヒントなし・目標タイム内で完成するとおまけがもらえます。'));
      return openModal(body, [['閉じる', closeModal, 'btn-primary']]);
    }
    body.append(h('h3', null, '交換しますか'), h('p', null, `「${title}」を小判${price}枚で開けます。`));
    const rw = h('div', 'rewards');
    const r1 = h('div', 'rw'); r1.append(h('span', null, 'いまの小判'), kobanEl(have));
    const r2 = h('div', 'rw total'); r2.append(h('span', null, '交換したあと'), kobanEl(have - price));
    rw.append(r1, r2); body.append(rw);
    openModal(body, [['開ける', () => {
      store.set('koban', have - price); own(key); Sound.coin(); vibrate(30);
      closeModal(); renderWallet(true);
      const earned = checkBadges();
      after?.();
      if (earned.length) showBadgeToastModal(earned);
    }, 'btn-primary'], ['やめる', closeModal]]);
  }

  // ===== 今日のお題 =====
  const pad2 = (n) => String(n).padStart(2, '0');
  const dateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const today = () => dateStr(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d); };
  function seeded(str) {
    let a = 0; for (const ch of str) a = (Math.imul(a, 31) + ch.charCodeAt(0)) | 0;
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // その日のお題は最初に決めたら変えない(途中で地図を買っても同じお題)
  function dailyChallenge() {
    const t = today(), saved = store.get('daily', null);
    if (saved?.date === t) return saved;
    const r = seeded(t), pick = (a) => a[Math.floor(r() * a.length)];
    const maps = MAP_LIST.filter((m) => isMapOpen(m.id) && m.regions.length);
    const m = pick(maps), st = pick(m.regions.filter((x) => x.count >= 4));
    const diff = pick(['easy', 'names']), cond = pick(['time', 'nohint']);
    const limit = Math.ceil((st.count * (diff === 'easy' ? 9 : 12)) / 10) * 10;
    const d = { date: t, map: m.id, stage: st.name, count: st.count, diff, cond, limit, reward: 50, done: false };
    store.set('daily', d);
    return d;
  }
  const dailyText = (d) => `${d.stage}（${mapInfo(d.map).name}・${d.count}枚）を${d.cond === 'time' ? fmtTime(d.limit) + '以内に' : 'ヒントなしで'}はめよう`;
  const streak = () => store.get('streak', { last: null, n: 0, max: 0 });

  // ===== 称号 =====
  const BADGES = [
    { id: 'first', name: '初陣', desc: 'はじめて完成させる', reward: 20, prog: (s) => [s.clears, 1] },
    { id: 'swift', name: '疾風', desc: '目標タイム内に完成', reward: 30, prog: (s) => [s.feats.swift ? 1 : 0, 1] },
    { id: 'solo', name: '独力', desc: 'ヒントもガイドも使わず完成', reward: 30, prog: (s) => [s.feats.solo ? 1 : 0, 1] },
    { id: 'master', name: '達人', desc: '上級「達人」で完成', reward: 50, prog: (s) => [s.feats.master ? 1 : 0, 1] },
    { id: 'regions', name: '地方巡り', desc: '日本の地方ステージをすべて完成', reward: 60, prog: (s) => [s.japanStages, JAPAN_STAGES.length] },
    { id: 'japanall', name: '全国制覇', desc: '日本全体を4つの難易度で完成', reward: 80, prog: (s) => [s.japanDiffs, 4] },
    { id: 'streak7', name: '皆勤', desc: '今日のお題を7日続けて達成', reward: 100, prog: (s) => [s.streakMax, 7] },
    { id: 'collector', name: '蒐集家', desc: '絵柄を10枚集める', reward: 50, prog: (s) => [s.arts, 10] },
    { id: 'frames', name: '私設画廊', desc: '自分の絵を5枚額装する', reward: 100, prog: (s) => [s.frames, FRAME_MAX] },
    { id: 'flags', name: '万国旗', desc: '国旗を50か国集める', reward: 80, prog: (s) => [s.flags, 50] },
    { id: 'world', name: '世界一周', desc: '6つの大陸すべてを完成', reward: 150, prog: (s) => [s.continents, 6], gold: true },
    { id: 'rich', name: '小判長者', desc: '小判を合計1000枚かせぐ', reward: 100, prog: (s) => [s.kobanTotal, 1000], gold: true },
  ];
  const starsOf = (mapId, stage) => store.get(`stars:${mapId}:${stage}`, 0);
  function stats() {
    return {
      clears: store.get('clearsTotal', 0),
      feats: store.get('feats', {}),
      japanStages: JAPAN_STAGES.filter(([n]) => starsOf('japan', n) > 0).length,
      japanDiffs: DIFFS.filter((d) => store.get(`done:japan:all:${d.key}`, false)).length,
      streakMax: streak().max,
      frames: FRAMES.length,
      arts: MAP_LIST.filter((m) => isMapOpen(m.id)).reduce((n, m) => n + artsFor(m.id).filter((a) => !a.locked).length, 0),
      continents: window.WORLD_MAP_INDEX.filter((m) => starsOf(m.id, 'all') > 0).length,
      kobanTotal: store.get('kobanTotal', 0),
      flags: Object.keys(store.get('flags', {})).length,
    };
  }
  // 新しく取った称号を記録してごほうびを渡す
  function checkBadges() {
    const s = stats(), got = new Set(store.get('badges', [])), earned = [];
    for (const b of BADGES) {
      const [cur, max] = b.prog(s);
      if (!got.has(b.id) && cur >= max) { got.add(b.id); earned.push(b); }
    }
    if (earned.length) { store.set('badges', [...got]); addKoban(earned.reduce((n, b) => n + b.reward, 0)); }
    return earned;
  }
  function badgeEl(b, got, s) {
    const d = h('div', `bd${got ? '' : ' lk'}${b.gold ? ' gold' : ''}`);
    d.append(h('div', 's', b.name.slice(0, 2)), h('div', 'n', b.name), h('div', 'c', b.desc));
    if (got) d.append(h('div', 'r', `+${b.reward}枚 もらった`));
    else if (s) {
      const [cur, max] = b.prog(s);
      const pg = h('div', 'pg'), i = h('i'); i.style.width = `${Math.min(100, (cur / max) * 100)}%`; pg.append(i);
      d.append(pg, h('div', 'r', `${Math.min(cur, max)}/${max}・+${b.reward}枚`));
    }
    return d;
  }
  function showBadgeToastModal(earned) {
    const body = h('div');
    body.append(h('h3', null, '称号を手に入れました'));
    const g = h('div', 'badges'); earned.forEach((b) => g.append(badgeEl(b, true))); body.append(g);
    openModal(body, [['うれしい', closeModal, 'btn-primary']]);
  }

  // ===== 国旗ガチャ・国旗図鑑 =====
  // 地球儀がくるくる回って止まった国のカードが出る。1回30枚。レア度は人口で決める(小さい国ほどレア)
  const GACHA = { one: 30, ten: 280, rates: [[3, 0.07], [2, 0.28], [1, 0.65]], dupe: { 1: 5, 2: 10, 3: 30 } };
  const COUNTRIES = window.COUNTRY_INDEX.map((c) => {
    const [cap, langName, lang, word, yomi, fact] = window.COUNTRY_FACTS[c.a3];
    return { ...c, rarity: c.pop < 1e6 ? 3 : c.pop < 1.5e7 ? 2 : 1, cap, langName, lang, word, yomi, fact };
  });
  const country = (a3) => COUNTRIES.find((c) => c.a3 === a3);
  const flagUrl = (c) => `https://flagcdn.com/${c.iso2}.svg`;
  const flags = () => store.get('flags', {});
  const stars = (n) => '★'.repeat(n);
  const OWNED_GOLD = '#e6c470';

  function drawOne() {
    let r = Math.random(), rarity = 1;
    for (const [k, p] of GACHA.rates) { if (r < p) { rarity = k; break; } r -= p; }
    const pool = COUNTRIES.filter((c) => c.rarity === rarity);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 国の形(大陸パズルの地図データから切り出す)
  async function shapeEl(c, color = '#c3402b') {
    try {
      const m = await loadMap(c.map);
      const p = [...m.pieces, ...m.fixed].find((x) => x.a3 === c.a3);
      if (!p) return h('div', 'dot', 'とても小さな国のため、地図では点ほどの大きさです');
      const tmp = svgEl('svg', { viewBox: `0 0 ${m.width} ${m.height}` });
      const path = svgEl('path', { d: p.d }, tmp);
      document.body.append(tmp);
      const b = path.getBBox(); tmp.remove();
      const pad = Math.max(b.width, b.height) * 0.08 + 2;
      const svg = svgEl('svg', { viewBox: `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`, preserveAspectRatio: 'xMidYMid meet' });
      svgEl('path', { d: p.d, fill: color, stroke: '#7a2416', 'stroke-width': Math.max(b.width, b.height) / 120, 'fill-rule': 'evenodd' }, svg);
      return svg;
    } catch { return h('div', 'dot', '国の形を読み込めませんでした'); }
  }

  let gacha = null; // {globe, status, btns}
  function openGacha() {
    const wrap = h('div', 'gacha');
    const stage = h('div', 'gacha-stage'), cv = h('canvas'); cv.id = 'gacha-globe'; cv.setAttribute('aria-label', '地球儀'); stage.append(cv);
    const status = h('p', 'gacha-status', 'ボタンを押すと地球儀が回ります');
    const btns = h('div', 'gacha-btns');
    const mk = (label, price, n) => {
      const b = h('button', 'btn btn-primary'); b.type = 'button';
      const sm = h('small'); sm.append(h('span', 'koban'), document.createTextNode(`${price}枚`));
      b.append(document.createTextNode(label), sm);
      b.addEventListener('click', () => pull(n, price));
      return b;
    };
    btns.append(mk('1回まわす', GACHA.one, 1), mk('10回まわす', GACHA.ten, 10));
    const rates = h('p', 'gacha-rates');
    rates.innerHTML = `金色の国は、もう国旗を持っている国です。<br>★★★（人口100万人未満）7%　★★ 28%　★ 65%<br>同じ国旗が出たら小判が戻ります（★5枚・★★10枚・★★★30枚）`;
    wrap.append(stage, status, btns, rates);
    openSheet(`国旗の福引（小判 ${koban()}枚）`, wrap);
    const globe = new window.Globe(cv, { lon: 120 + Math.random() * 60, lat: 20 });
    globe.theme = settings.theme;
    const have = flags(); globe.fill = (ft) => (have[ft.a3] ? OWNED_GOLD : null);
    globe.draw();
    gacha = { globe, status, btns, busy: false };
  }

  function pull(n, price) {
    if (!gacha || gacha.busy) return;
    if (koban() < price) {
      const body = h('div');
      body.append(h('h3', null, '小判が足りません'), h('p', null, `福引には小判${price}枚が必要です（あと${price - koban()}枚）。`), h('p', 'note', '地方ステージや今日のお題で小判を集めましょう。'));
      return openModal(body, [['閉じる', closeModal, 'btn-primary']]);
    }
    store.set('koban', koban() - price); renderWallet(true);
    $('#sheet-title').textContent = `国旗の福引（小判 ${koban()}枚）`;
    const before = flags(), have = { ...before }, results = [];
    let refund = 0;
    for (let i = 0; i < n; i++) {
      const c = drawOne(), isNew = !have[c.a3];
      have[c.a3] = (have[c.a3] || 0) + 1;
      if (!isNew) refund += GACHA.dupe[c.rarity];
      results.push({ c, isNew });
    }
    store.set('flags', have);
    if (refund) addKoban(refund);
    const earned = checkBadges();
    // 一番レアな国に止める
    const target = results.reduce((a, b) => (b.c.rarity > a.c.rarity ? b : a)).c;
    const { globe, status, btns } = gacha;
    gacha.busy = true;
    btns.querySelectorAll('button').forEach((b) => (b.disabled = true));
    status.textContent = 'くるくる……'; status.className = 'gacha-status spin';
    globe.fill = (ft) => (before[ft.a3] ? OWNED_GOLD : null);
    globe.setMarker(null);
    const ms = 3200;
    for (let t = 0, gap = 45; t < ms - 150; gap *= 1.13, t += gap) setTimeout(() => Sound.tick(), t);
    vibrate(30);
    globe.spinTo(target.lon, target.lat, ms, 3, () => {
      globe.fill = (ft) => (ft.a3 === target.a3 ? '#c3402b' : before[ft.a3] ? OWNED_GOLD : null);
      globe.setMarker(target.lon, target.lat);
      status.textContent = `${target.name}！`; status.className = 'gacha-status';
      Sound.pop(target.rarity); vibrate(target.rarity === 3 ? [40, 60, 40, 60, 80] : 40);
      setTimeout(() => {
        gacha.busy = false;
        btns.querySelectorAll('button').forEach((b) => (b.disabled = false));
        globe.fill = (ft) => (ft.a3 === target.a3 ? '#c3402b' : have[ft.a3] ? OWNED_GOLD : null);
        showPullResult(results, refund, earned);
      }, 900);
    });
  }

  // 国のカード
  function countryCard({ c, isNew }) {
    const card = h('div', `gcard r${c.rarity}`);
    const top = h('div', 'gc-top'); top.append(h('span', 'rstars', stars(c.rarity)));
    if (isNew) top.append(h('span', 'newtag', 'NEW'));
    else { const d = h('span', 'dupetag'); d.append(document.createTextNode('かぶり '), h('span', 'koban'), document.createTextNode(`+${GACHA.dupe[c.rarity]}`)); top.append(d); }
    const img = h('img', 'gflag'); img.src = flagUrl(c); img.alt = `${c.name}の国旗`;
    const sh = h('div', 'gshape');
    shapeEl(c).then((el) => sh.append(el));
    const th = h('div', 'gthanks'); th.append(h('small', null, 'ありがとう＝'), document.createTextNode(`${c.word}`), h('small', null, `（${c.yomi}）`));
    card.append(top, img, h('div', 'gname', c.name), h('div', 'small', `${mapInfo(c.map).name}・首都 ${c.cap}`), sh, h('p', 'gfact', c.fact), th);
    return card;
  }

  function showPullResult(results, refund, earned) {
    const body = h('div');
    if (results.length === 1) {
      const c = results[0].c;
      body.append(countryCard(results[0]));
      if (earned.length) body.append(h('p', 'new-best', `称号「${earned.map((b) => b.name).join('」「')}」を手に入れました`));
      openModal(body, [['くわしく・音声', () => showCountry(c.a3), 'btn-primary'], ['もう1回', () => { closeModal(); pull(1, GACHA.one); }], ['閉じる', closeModal]]);
    } else {
      body.append(h('h3', null, '10回の結果'));
      const grid = h('div', 'ten-grid');
      results.forEach(({ c, isNew }, i) => {
        const t = h('div', `tt r${c.rarity}`); t.style.animationDelay = `${i * 0.08}s`;
        const img = h('img'); img.src = flagUrl(c); img.alt = '';
        t.append(img, h('div', null, c.name));
        if (isNew) t.append(h('span', 'newtag', 'NEW'));
        t.addEventListener('click', () => showCountry(c.a3));
        grid.append(t);
      });
      body.append(grid);
      const p = h('p', 'daily-result ok', `新しい国旗 ${results.filter((r) => r.isNew).length}枚`);
      if (refund) p.append(document.createTextNode(`　かぶり分 小判+${refund}枚`));
      body.append(p);
      if (earned.length) body.append(h('p', 'new-best', `称号「${earned.map((b) => b.name).join('」「')}」を手に入れました`));
      openModal(body, [['図鑑を見る', () => { closeModal(); openZukan(); }, 'btn-primary'], ['閉じる', closeModal]]);
    }
  }

  // --- 国旗図鑑 ---
  let zukanTab = 'all';
  function openZukan(tab = zukanTab) {
    zukanTab = tab;
    const have = flags(), owned = Object.keys(have).length;
    const wrap = h('div');
    const head = h('div', 'zk-head'); head.append(h('span', null, `集めた国旗 ${owned} / ${COUNTRIES.length}`), h('span', 'small', `${Math.round((owned / COUNTRIES.length) * 100)}%`));
    const bar = h('div', 'zk-bar'), fill = h('i'); fill.style.width = `${(owned / COUNTRIES.length) * 100}%`; bar.append(fill);
    const tabs = h('div', 'zk-tabs');
    for (const [id, label] of [['all', 'すべて'], ...window.WORLD_MAP_INDEX.map((m) => [m.id, m.name])]) {
      const list = id === 'all' ? COUNTRIES : COUNTRIES.filter((c) => c.map === id);
      const got = list.filter((c) => have[c.a3]).length;
      const b = h('button', null, `${label} ${got}/${list.length}`); b.type = 'button'; b.setAttribute('aria-pressed', String(id === tab));
      b.addEventListener('click', () => openZukan(id));
      tabs.append(b);
    }
    const grid = h('div', 'zk-grid');
    const list = (tab === 'all' ? COUNTRIES : COUNTRIES.filter((c) => c.map === tab)).slice().sort((a, b) => (!!have[b.a3] - !!have[a.a3]) || a.rarity - b.rarity);
    for (const c of list) {
      const got = have[c.a3];
      const t = h('div', 'zk-tile' + (got ? '' : ' locked'));
      if (got) {
        const img = h('img'); img.src = flagUrl(c); img.alt = ''; img.loading = 'lazy';
        t.append(img, h('div', null, c.name));
        t.addEventListener('click', () => showCountry(c.a3));
      } else t.append(h('div', 'unk', '？'), h('div', null, '？？？'));
      t.append(h('span', 'ts', stars(c.rarity)));
      grid.append(t);
    }
    wrap.append(head, bar, tabs, grid);
    openSheet('国旗図鑑', wrap);
  }

  // --- 国の詳細: 国旗・豆知識・国の形・ありがとう ---
  async function showCountry(a3) {
    const c = country(a3), have = flags();
    const body = h('div', 'cdetail');
    const img = h('img', 'cflag'); img.src = flagUrl(c); img.alt = `${c.name}の国旗`;
    const title = h('h3', null, c.name);
    body.append(img, h('div', 'rstars', stars(c.rarity)), title);
    const dl = h('dl', 'cinfo');
    for (const [k, v] of [['首都', c.cap], ['地域', mapInfo(c.map).name], ['言葉', c.langName], ['出た回数', `${have[a3] || 0}回`]]) dl.append(h('dt', null, k), h('dd', null, v));
    body.append(dl, h('p', 'cfact', c.fact));
    const shape = h('div', 'cshape'); body.append(shape);
    // ありがとう
    const th = h('div', 'thanks');
    th.append(h('div', 'tl', `${c.langName}で「ありがとう」`), h('div', 'tw', c.word), h('div', 'ty', c.yomi));
    const say = h('button', 'btn btn-small say'); say.type = 'button';
    say.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/></svg>';
    say.append(document.createTextNode('聞いてみる'));
    const note = h('div', 'tnote');
    say.addEventListener('click', () => speakThanks(c, note));
    th.append(say, note);
    body.append(th);
    openModal(body, [['閉じる', closeModal, 'btn-primary']]);
    // 国の形(地図データから)
    shape.append(await shapeEl(c));
  }

  // 「ありがとう」をその国の言葉で読み上げる(端末に声がないときは日本語の声で読み方を読む)
  function speakThanks(c, note) {
    const tts = NATIVE && window.Capacitor.Plugins?.TextToSpeech;
    if (tts) return speakNative(tts, c, note);
    const synth = window.speechSynthesis;
    if (!synth) { note.textContent = 'このブラウザは音声の読み上げに対応していません。'; return; }
    const go = () => {
      synth.cancel();
      const voices = synth.getVoices(), want = c.lang.toLowerCase(), base = want.split('-')[0];
      const norm = (v) => v.lang.replace('_', '-').toLowerCase();
      const v = voices.find((x) => norm(x) === want) || voices.find((x) => norm(x).split('-')[0] === base);
      let u;
      if (v) {
        u = new SpeechSynthesisUtterance(c.word); u.voice = v; u.lang = v.lang;
        note.textContent = `${c.langName}の声で再生しています。`;
      } else {
        u = new SpeechSynthesisUtterance(c.yomi.replace(/・/g, ' ')); u.lang = 'ja-JP';
        const ja = voices.find((x) => norm(x).startsWith('ja')); if (ja) u.voice = ja;
        note.textContent = `この端末には${c.langName}の声が入っていないため、読み方を日本語の声で再生しています。`;
      }
      u.rate = 0.85;
      synth.speak(u);
    };
    if (synth.getVoices().length) go();
    else { synth.addEventListener('voiceschanged', go, { once: true }); setTimeout(() => { if (!synth.speaking) go(); }, 600); }
  }

  // Androidアプリ版: WebView には読み上げ機能がないので、端末の読み上げエンジン(プラグイン)で話す
  async function speakNative(tts, c, note) {
    try {
      await tts.stop().catch(() => {});
      const { languages = [] } = await tts.getSupportedLanguages();
      const norm = (l) => l.replace('_', '-').toLowerCase(), want = c.lang.toLowerCase(), base = want.split('-')[0];
      const hit = languages.find((l) => norm(l) === want) || languages.find((l) => norm(l).split('-')[0] === base);
      if (hit) {
        note.textContent = `${c.langName}の声で再生しています。`;
        await tts.speak({ text: c.word, lang: hit, rate: 0.85 });
      } else {
        note.textContent = `この端末には${c.langName}の声が入っていないため、読み方を日本語の声で再生しています。`;
        await tts.speak({ text: c.yomi.replace(/・/g, ' '), lang: 'ja-JP', rate: 0.85 });
      }
    } catch {
      note.textContent = '音声を再生できませんでした。端末の設定で「テキスト読み上げ」を確認してください。';
    }
  }

  // ===== 状態 =====
  const sel = { map: store.get('map', 'japan'), diff: store.get('diff', 'easy') };
  const selArtKey = (mapId) => (mapId === 'japan' ? 'art' : 'art:' + mapId);
  const selectedArt = (mapId) => { const id = store.get(selArtKey(mapId), 'random'); const a = artById(mapId, id); return a && !a.locked ? id : 'random'; };
  const selectedStage = (mapId) => { const s = store.get('stage:' + mapId, 'all'); return s === 'all' || mapInfo(mapId).regions.some((r) => r.name === s) ? s : 'all'; };
  let S = null; // 1ゲーム分の状態
  let artUrl = null; // 生成画像の blob URL(解放用)

  // ===== 小判の表示 =====
  function renderWallet(pop) {
    document.querySelectorAll('.koban-count').forEach((el) => (el.textContent = koban()));
    if (pop) document.querySelectorAll('.koban-badge').forEach((b) => { b.classList.remove('koban-pop'); void b.offsetWidth; b.classList.add('koban-pop'); });
    $('#nav-gacha .tab-dot').hidden = koban() < GACHA.one;
  }
  function renderMenu() { renderWallet(); renderTitle(); renderPicker(false); }

  // ===== タイトル画面(名画を全面に) =====
  // 持っている絵から1枚を全面に出す。タイトルに戻るたびに絵が変わる
  let titleArt = null;
  function changeTitleArt(first) {
    const pool = [...MAP_LIST.filter((m) => isMapOpen(m.id)).flatMap((m) => artsFor(m.id).filter((a) => !a.locked && a.url)), ...frameArts()];
    const next = first ? pool.find((a) => a.id === 'wave') : pool.filter((a) => a !== titleArt && a.id !== titleArt?.id)[Math.floor(Math.random() * Math.max(1, pool.length - 1))] || pool[0];
    titleArt = next;
    const img = $('#title-img');
    img.classList.remove('on');
    img.onload = () => img.classList.add('on');
    img.referrerPolicy = 'no-referrer';
    img.src = next.url;
    $('#title-credit').textContent = `${next.artist}「${next.title}」`;
    $('#title-credit').append(h('span', 'title-ver', `v${self.APP_VERSION}`));
  }
  function renderTitle() {
    const d = dailyChallenge(), st = streak(), n = st.last === today() || st.last === yesterday() ? st.n : 0;
    const line = $('#daily-line'); line.className = 'daily-line' + (d.done ? ' done' : ''); line.innerHTML = '';
    if (d.done) { line.append(document.createTextNode('今日のお題 達成ずみ ✓　連続 ')); line.append(h('b', null, String(n))); line.append(document.createTextNode(' 日')); }
    else { line.append(document.createTextNode(`今日のお題：${dailyText(d)}　`)); line.append(h('b', null, '挑戦 ›')); }
  }
  $('#daily-line').addEventListener('click', () => {
    const d = dailyChallenge();
    if (d.done) return toast2('今日のお題は達成ずみです。また明日！');
    Sound.ensure(); startGame({ mapId: d.map, stage: d.stage, diffKey: d.diff, artChoice: 'random', daily: d });
  });
  // メニュー画面用の小さなお知らせ(ゲーム中の toast とは別)
  function toast2(msg) { const body = h('div'); body.append(h('p', null, msg)); openModal(body, [['閉じる', closeModal, 'btn-primary']]); }

  // ===== 地図えらび(地球儀) =====
  const CENTERS = { japan: [137, 36], ...Object.fromEntries(window.WORLD_MAP_INDEX.map((m) => [m.id, m.center])) };
  const inMap = (ft, id) => (id === 'japan' ? ft.a3 === 'JPN' : ft.m.includes(id));
  let pickGlobe = null;
  function ensurePickGlobe() {
    if (pickGlobe) return pickGlobe;
    const cv = $('#pick-globe');
    pickGlobe = new window.Globe(cv, { lon: CENTERS[sel.map][0], lat: CENTERS[sel.map][1] });
    // 左右にスワイプして大陸を切り替える
    let sx = null;
    cv.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    cv.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 30) stepMap(dx < 0 ? 1 : -1); });
    cv.addEventListener('pointercancel', () => { sx = null; });
    return pickGlobe;
  }
  function stepMap(dir) {
    const i = MAP_LIST.findIndex((m) => m.id === sel.map);
    sel.map = MAP_LIST[(i + dir + MAP_LIST.length) % MAP_LIST.length].id;
    store.set('map', sel.map); Sound.pick();
    renderPicker(true);
  }
  $('#map-prev').addEventListener('click', () => stepMap(-1));
  $('#map-next').addEventListener('click', () => stepMap(1));

  function renderPicker(animate) {
    const m = mapInfo(sel.map), open = isMapOpen(m.id), price = PRICES.maps[m.id];
    $('#map-name').textContent = m.name;
    const first = m.id === 'japan' ? null : WORLD_ARTS[m.id][0];
    $('#map-sub').textContent = open
      ? `${m.count}${m.id === 'japan' ? '都道府県' : 'か国'}${starsOf(m.id, 'all') ? '・' + '★'.repeat(starsOf(m.id, 'all')) : ''}`
      : `小判${price}枚で開けられます・${first.artist.replace(/（.*?）/, '')}「${first.title}」つき`;
    const dots = $('#map-dots'); dots.innerHTML = '';
    for (const x of MAP_LIST) {
      const b = h('button', (x.id === m.id ? 'on' : '') + (isMapOpen(x.id) ? '' : ' lk')); b.type = 'button'; b.setAttribute('aria-label', x.name);
      b.addEventListener('click', () => { sel.map = x.id; store.set('map', x.id); renderPicker(true); });
      dots.append(b);
    }
    const g = ensurePickGlobe();
    g.theme = settings.theme;
    g.fill = (ft) => (inMap(ft, m.id) ? (open ? '#c3402b' : '#9b927f') : null);
    const [lon, lat] = CENTERS[m.id];
    if (animate) g.turnTo(lon, lat, 650); else { g.lon = lon; g.lat = lat; g.draw(); }
    // 開けていない地図は、遊ぶ設定を隠して「開ける」ボタンにする
    $('#pick-body').querySelectorAll(':scope > *').forEach((el) => (el.hidden = !open));
    $('#pick-body .lock-info')?.remove();
    if (!open) {
      // まだ開けていない地図: ついてくる名画を見せる
      const info = h('div', 'lock-info'), img = new Image(); img.src = first.thumb; img.alt = ''; img.referrerPolicy = 'no-referrer';
      const t = h('div', 'li-t');
      t.append(h('b', null, `「${first.title}」`), h('small', null, `${first.artist}・${first.series}`),
        h('span', null, `${m.name}の地図（${m.count}か国・地方ステージ${m.regions.length}つ）を開けると、この絵で遊べます。`));
      info.append(img, t); $('#pick-body').append(info);
    }
    if (open) { renderStageList(); renderDiffSeg(); renderArtPick(); }
    const sb = $('#btn-start');
    sb.classList.toggle('unlock-btn', !open);
    sb.innerHTML = '';
    if (open) sb.textContent = 'はじめる';
    else { sb.append(h('span', 'koban'), document.createTextNode(`小判${price}枚で開ける`)); }
  }

  // --- 範囲えらび(全体／地方ステージ) ---
  function renderStageList() {
    const m = mapInfo(sel.map), box = $('#stage-list'), cur = selectedStage(sel.map);
    box.innerHTML = '';
    if (!m.regions.length) { box.hidden = true; return; }
    for (const st of [{ name: 'all', count: m.count }, ...m.regions]) {
      const b = h('button', 'stage-chip'); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(st.name === cur));
      b.append(h('span', null, st.name === 'all' ? '全体' : st.name), h('span', 'sc-n', `${st.count}枚`));
      const n = starsOf(sel.map, st.name), sEl = h('span', 'sc-s');
      sEl.innerHTML = '★'.repeat(n) + `<span class="off">${'★'.repeat(3 - n)}</span>`;
      b.append(sEl);
      b.addEventListener('click', () => { store.set('stage:' + sel.map, st.name); renderStageList(); renderDiffSeg(); });
      box.append(b);
    }
  }

  // --- 難易度(4つの切り替え) ---
  function renderDiffSeg() {
    const box = $('#diff-seg');
    if (!box.childElementCount) {
      for (const d of DIFFS) {
        const b = h('button'); b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.key = d.key;
        b.append(document.createTextNode(d.name), h('small', null, d.lv));
        b.addEventListener('click', () => { sel.diff = d.key; store.set('diff', d.key); renderDiffSeg(); });
        box.append(b);
      }
    }
    for (const b of box.children) b.setAttribute('aria-checked', String(b.dataset.key === sel.diff));
    const m = mapInfo(sel.map), d = diffOf(sel.diff), u = m.id === 'japan' ? '県' : '国';
    const stage = selectedStage(sel.map), cnt = stage === 'all' ? m.count : m.regions.find((r) => r.name === stage).count;
    const reward = Math.max(stage === 'all' ? 10 : 5, Math.round(cnt * MULT[d.key]));
    const best = store.get(`best:${sel.map}:${stage}:${d.key}`, null);
    $('#diff-desc').textContent = `${u}名${d.names ? 'あり' : 'なし'}・形のガイド${d.guide ? 'あり' : 'なし'}　／　小判${reward}枚〜${best ? '　／　ベスト ' + fmtTime(best) : ''}`;
  }

  // ===== 写真で遊ぶ =====
  // 自分の写真を絵柄にする。小判を払うと1回遊べる。写真は端末の中だけで使い、保存もしない(アプリを閉じると消える)
  const PHOTO_PRICE = 30;
  const PHOTO_ART = { id: 'photo', title: '持ち込みの一枚', artist: 'あなたの写真', series: '', own: true };
  let photo = null; // { url(blob), w, h }
  function pickPhotoFile() {
    return new Promise((res) => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.addEventListener('change', () => res(input.files?.[0] || null), { once: true });
      input.addEventListener('cancel', () => res(null), { once: true });
      input.click();
    });
  }
  // 大きな写真は長辺1920pxに縮める(向きのずれも直す)
  async function loadPhoto(file) {
    let src;
    try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {
      src = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    }
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight, k = Math.min(1, 1920 / Math.max(w0, h0));
    const cv = document.createElement('canvas'); cv.width = Math.round(w0 * k); cv.height = Math.round(h0 * k);
    cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height);
    src.close?.();
    const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.9));
    if (photo) URL.revokeObjectURL(photo.url);
    photo = { url: URL.createObjectURL(blob), w: cv.width, h: cv.height, blob };
    return photo;
  }
  async function pickPhoto() {
    const file = await pickPhotoFile();
    if (!file) return null;
    $('#loading').hidden = false; $('#loading-text').textContent = '写真を読み込んでいます…';
    try { return await loadPhoto(file); } catch {
      const body = h('div'); body.append(h('h3', null, '写真を読み込めませんでした'), h('p', null, 'ほかの写真を選んでください。'));
      openModal(body, [['閉じる', closeModal, 'btn-primary']]);
      return null;
    } finally { $('#loading').hidden = true; }
  }
  // 写真を選ぶ → 確認(小判を払う) → onGo(写真の絵柄)
  async function choosePhoto(onGo) {
    if (!photo && !(await pickPhoto())) return;
    const have = koban(), body = h('div', 'photo-confirm');
    const img = h('img', 'photo-preview'); img.src = photo.url; img.alt = '選んだ写真';
    body.append(h('h3', null, '写真で遊ぶ'), img);
    const again = async () => { closeModal(); if (await pickPhoto()) choosePhoto(onGo); };
    if (have < PHOTO_PRICE) {
      body.append(h('p', null, `写真で遊ぶには小判${PHOTO_PRICE}枚が必要です（あと${PHOTO_PRICE - have}枚）。`),
        h('p', 'note', '地方ステージや今日のお題、余興で小判を集めましょう。'));
      return openModal(body, [['閉じる', closeModal, 'btn-primary']]);
    }
    body.append(h('p', null, `この写真を絵柄にして、小判${PHOTO_PRICE}枚で1回遊べます。`));
    const rw = h('div', 'rewards');
    const r1 = h('div', 'rw'); r1.append(h('span', null, 'いまの小判'), kobanEl(have));
    const r2 = h('div', 'rw total'); r2.append(h('span', null, '使ったあと'), kobanEl(have - PHOTO_PRICE));
    rw.append(r1, r2); body.append(rw);
    body.append(h('p', 'note', '写真はこの端末の中だけで使い、どこにも送りません。アプリを閉じると消えます。ほかの人が作った絵や写真は使わないでください。'));
    openModal(body, [[`小判${PHOTO_PRICE}枚で遊ぶ`, () => {
      store.set('koban', koban() - PHOTO_PRICE); Sound.coin(); vibrate(30); renderWallet(true);
      closeModal(); onGo({ ...PHOTO_ART, url: photo.url });
    }, 'btn-primary'], ['別の写真', again], ['やめる', closeModal]]);
  }
  // ===== 額装(自分の写真を絵画として飾る) =====
  // 小判300枚で1枠。5枠まで。外すと半分(150枚)戻る。写真は端末の IndexedDB に保存
  const FRAME_PRICE = 300, FRAME_MAX = 5, FRAME_REFUND = FRAME_PRICE / 2;
  let FRAMES = []; // [{ id, title, url }]
  const frameDb = () => new Promise((res, rej) => {
    const rq = indexedDB.open('ukiyo-frames', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('frames', { keyPath: 'id' });
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  async function frameTx(mode, fn) {
    const db = await frameDb();
    return new Promise((res, rej) => {
      const tx = db.transaction('frames', mode), st = tx.objectStore('frames'), out = fn(st);
      tx.oncomplete = () => { db.close(); res(out?.result); }; tx.onerror = () => { db.close(); rej(tx.error); };
    });
  }
  const frameArt = (f) => ({ id: 'frame:' + f.id, title: f.title, artist: '自分の絵', series: '', url: f.url, thumb: f.url, own: true, frame: f.id });
  const frameArts = () => FRAMES.map(frameArt);
  async function loadFrames() {
    try {
      const rows = await frameTx('readonly', (st) => st.getAll());
      FRAMES.forEach((f) => URL.revokeObjectURL(f.url));
      FRAMES = (rows || []).sort((a, b) => a.created - b.created).map((r) => ({ id: r.id, title: r.title, url: URL.createObjectURL(r.blob) }));
    } catch { FRAMES = []; }
    renderArtPick();
  }
  // 写真を選ぶ → 題名を付ける → 小判300枚で額に入れる
  async function addFrame(after) {
    if (FRAMES.length >= FRAME_MAX) return;
    if (koban() < FRAME_PRICE) return confirmBuy({ title: '額装', price: FRAME_PRICE });
    if (!(await pickPhoto())) return;
    const body = h('div', 'photo-confirm');
    const img = h('img', 'photo-preview'); img.src = photo.url; img.alt = '選んだ写真';
    const name = h('input', 'frame-name'); name.type = 'text'; name.maxLength = 16; name.value = `自分の絵 ${FRAMES.length + 1}`; name.setAttribute('aria-label', '絵の題名');
    const lab = h('label', 'frame-label', '題名'); lab.append(name);
    body.append(h('h3', null, '額に入れて飾る'), img, lab);
    const rw = h('div', 'rewards'), have = koban();
    const r1 = h('div', 'rw'); r1.append(h('span', null, 'いまの小判'), kobanEl(have));
    const r2 = h('div', 'rw total'); r2.append(h('span', null, '額装したあと'), kobanEl(have - FRAME_PRICE));
    rw.append(r1, r2);
    body.append(rw, h('p', 'note', `絵画の一覧に「自分の絵」として加わり、パズルや名画スライドで何度でも使えます（${FRAME_MAX}枠まで。外すと小判${FRAME_REFUND}枚が戻ります）。写真はこの端末の中だけに保存され、どこにも送りません。`));
    openModal(body, [['額に入れる', async () => {
      const title = name.value.trim() || `自分の絵 ${FRAMES.length + 1}`;
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      try {
        await frameTx('readwrite', (st) => st.put({ id, title, blob: photo.blob, w: photo.w, h: photo.h, created: Date.now() }));
      } catch {
        const m = h('div'); m.append(h('h3', null, '保存できませんでした'), h('p', null, 'この端末やブラウザの設定では写真を保存できないようです。小判は使っていません。'));
        return openModal(m, [['閉じる', closeModal, 'btn-primary']]);
      }
      navigator.storage?.persist?.().catch(() => {});
      store.set('koban', koban() - FRAME_PRICE); Sound.coin(); vibrate(30);
      FRAMES.push({ id, title, url: URL.createObjectURL(photo.blob) });
      closeModal(); renderWallet(true); renderArtPick();
      const earned = checkBadges();
      after?.();
      if (earned.length) showBadgeToastModal(earned);
    }, 'btn-primary'], ['別の写真', () => { closeModal(); photo = null; addFrame(after); }], ['やめる', closeModal]]);
  }
  function removeFrame(f, after) {
    const body = h('div');
    body.append(h('h3', null, '額から外しますか'), h('p', null, `「${f.title}」を絵画の一覧から外します。小判${FRAME_REFUND}枚が戻ります。`));
    openModal(body, [['外す', async () => {
      try { await frameTx('readwrite', (st) => st.delete(f.id)); } catch { /* 消せなくても一覧からは外す */ }
      URL.revokeObjectURL(f.url);
      FRAMES = FRAMES.filter((x) => x.id !== f.id);
      store.set('koban', koban() + FRAME_REFUND); Sound.coin();
      closeModal(); renderWallet(true); renderArtPick(); after?.();
    }, 'btn-primary'], ['やめる', closeModal]]);
  }

  const PHOTO_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  // ===== 絵柄えらび =====
  let genThumb = null;
  function artPicEl(a) {
    if (a.id === 'random') return h('div', 'pic random', '?');
    const pic = h('div', 'pic');
    if (a.id === 'gen') {
      if (!genThumb) genThumb = window.generateUkiyoe((Math.random() * 1e9) | 0, 300, Math.round((300 * JAPAN.height) / JAPAN.width)).canvas;
      const cv = h('canvas'); cv.width = genThumb.width; cv.height = genThumb.height; cv.getContext('2d').drawImage(genThumb, 0, 0);
      pic.append(cv);
    } else {
      const img = new Image(); img.loading = 'lazy'; img.alt = ''; img.src = a.thumb; img.referrerPolicy = 'no-referrer';
      pic.append(img);
    }
    return pic;
  }
  const artSubtitle = (a) => (a.id === 'gen' ? a.artist : `${a.artist}${a.series ? '・' + a.series : ''}`);

  function renderArtPick() {
    const id = selectedArt(sel.map);
    const btn = $('#art-pick');
    const pic = btn.querySelector('.ap-pic'); pic.innerHTML = '';
    if (id === 'random') {
      pic.append(artPicEl({ id: 'random' }));
      btn.querySelector('.ap-t').textContent = '絵画を選ぶ';
      const n = allArtsFor(sel.map).filter((a) => !a.locked).length;
      btn.querySelector('.ap-a').textContent = `いまはランダム（持っている${n}枚から）`;
    } else {
      const a = artById(sel.map, id);
      pic.append(artPicEl(a));
      btn.querySelector('.ap-t').textContent = a.title;
      btn.querySelector('.ap-a').textContent = artSubtitle(a);
    }
  }

  function openArtSheet() {
    const mapId = sel.map, cur = selectedArt(mapId);
    const list = h('div', 'art-list'); list.setAttribute('role', 'radiogroup');
    const items = [{ id: 'random', title: 'ランダム', sub: '持っている絵から毎回ちがう絵' }, ...allArtsFor(mapId).map((a) => ({ ...a, sub: artSubtitle(a) })).sort((x, y) => !!x.locked - !!y.locked)]; // 持っている絵(自分の絵を含む)を先に
    for (const a of items) {
      const b = h('button', 'art' + (a.locked ? ' locked' : '')); b.type = 'button';
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(a.id === cur));
      const pic = artPicEl(a);
      if (a.locked) {
        const lock = h('div', 'lock'); lock.innerHTML = LOCK_SVG;
        const p = h('span', 'lock-need'); p.append(h('span', 'koban'), document.createTextNode(` ${a.price}枚`)); lock.append(p); pic.append(lock);
      }
      b.append(pic, h('div', 't', a.locked ? '？？？' : a.title), h('div', 'a', a.locked ? `小判${a.price}枚で交換` : a.sub));
      b.addEventListener('click', () => {
        if (a.locked) return confirmBuy({ key: a.key, title: `${a.artist}のまだ見ぬ一枚`, price: a.price }, () => { store.set(selArtKey(mapId), a.id); renderArtPick(); openArtSheet(); });
        store.set(selArtKey(mapId), a.id);
        closeSheet(); renderArtPick();
      });
      list.append(b);
    }
    const pb = h('button', 'art photo-art'); pb.type = 'button';
    const ppic = h('div', 'pic photo'); ppic.innerHTML = PHOTO_SVG;
    pb.append(ppic, h('div', 't', '写真で遊ぶ'), h('div', 'a', `自分の写真で1回・小判${PHOTO_PRICE}枚`));
    pb.addEventListener('click', () => {
      if (!isMapOpen(mapId)) return;
      closeSheet();
      choosePhoto(() => startGame({ mapId, stage: selectedStage(mapId), diffKey: sel.diff, artChoice: 'photo' }));
    });
    list.append(pb);
    openSheet(`絵画を選ぶ（${mapInfo(mapId).name}）`, list);
  }

  function pictureList() {
    const seen = new Set();
    return [...MAP_LIST.filter((m) => isMapOpen(m.id)).flatMap((m) => artsFor(m.id).filter((a) => !a.locked && a.url)), ...frameArts()]
      .filter((a) => (seen.has(a.url) ? false : seen.add(a.url)));
  }
  function openArtChooser(onPick) {
    const list = h('div', 'art-list');
    for (const a of pictureList()) {
      const b = h('button', 'art'); b.type = 'button';
      b.append(artPicEl(a), h('div', 't', a.title), h('div', 'a', artSubtitle(a)));
      b.addEventListener('click', () => { closeSheet(); onPick(a); });
      list.append(b);
    }
    openSheet('絵画を選ぶ', list);
  }

  // ===== シート(絵柄・お店・称号・設定) =====
  function openSheet(title, content) {
    $('#sheet-title').textContent = title;
    $('#sheet-body').replaceChildren(content);
    $('#sheet').hidden = false;
  }
  function closeSheet() { $('#sheet').hidden = true; }
  $('#art-pick').addEventListener('click', openArtSheet);
  $('#sheet-close').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

  // --- お店 ---
  function shopItem(picEl, title, sub, state) {
    const it = h('div', 'shop-item'), pic = h('div', 'si-pic');
    if (picEl) pic.append(picEl);
    const t = h('div', 'si-t', title); if (sub) t.append(h('small', null, sub));
    it.append(pic, t, state);
    return it;
  }
  function priceBtn(price, onClick) {
    const b = h('button', 'price-btn' + (koban() < price ? ' short' : '')); b.type = 'button';
    b.append(h('span', 'koban'), document.createTextNode(`${price}枚`));
    b.addEventListener('click', onClick);
    return b;
  }
  function openShop() {
    const wrap = h('div');
    const reopen = () => { renderMenu(); openShop(); };
    wrap.append(h('div', 'shop-sec', '地図'));
    for (const m of window.WORLD_MAP_INDEX) {
      const open = isMapOpen(m.id), price = PRICES.maps[m.id];
      const first = WORLD_ARTS[m.id][0], img = new Image(); img.src = first.thumb; img.referrerPolicy = 'no-referrer'; img.alt = '';
      wrap.append(shopItem(img, `${m.name}の地図`, `${m.count}か国・絵「${first.title}」つき`,
        open ? h('span', 'owned', '持っている') : priceBtn(price, () => confirmBuy({ key: 'map:' + m.id, title: `${m.name}の地図`, price }, reopen))));
    }
    for (const m of MAP_LIST.filter((x) => isMapOpen(x.id))) {
      const arts = artsFor(m.id).filter((a) => a.price > 0);
      if (!arts.length) continue;
      wrap.append(h('div', 'shop-sec', `絵柄・${m.name}`));
      for (const a of arts) {
        const pic = a.locked ? null : artPicEl(a).firstChild;
        wrap.append(shopItem(pic, a.locked ? '？？？' : a.title, a.locked ? `${a.artist}の作品` : artSubtitle(a),
          a.locked ? priceBtn(a.price, () => confirmBuy({ key: a.key, title: `${a.artist}のまだ見ぬ一枚`, price: a.price }, reopen)) : h('span', 'owned', '持っている')));
      }
    }
    wrap.append(h('div', 'shop-sec', `額装（自分の絵 ${FRAMES.length} / ${FRAME_MAX}枠）`));
    for (const f of FRAMES) {
      const img = new Image(); img.src = f.url; img.alt = '';
      const out = h('button', 'btn btn-small', `外す（+${FRAME_REFUND}枚）`); out.type = 'button';
      out.addEventListener('click', () => removeFrame(f, reopen));
      wrap.append(shopItem(img, f.title, '自分の絵', out));
    }
    if (FRAMES.length < FRAME_MAX) {
      const ico = h('span', 'frame-ico'); ico.innerHTML = PHOTO_SVG;
      wrap.append(shopItem(ico, '写真を額に入れる', `自分の写真を絵画として飾る（あと${FRAME_MAX - FRAMES.length}枠）`, priceBtn(FRAME_PRICE, () => addFrame(reopen))));
    }
    openSheet(`画商（小判 ${koban()}枚）`, wrap);
  }
  $('#nav-shop').addEventListener('click', openShop);
  $('#nav-gacha').addEventListener('click', openGacha);
  $('#nav-zukan').addEventListener('click', () => openZukan());

  // --- 称号 ---
  function openBadges() {
    const got = new Set(store.get('badges', [])), s = stats(), g = h('div', 'badges');
    for (const b of BADGES) g.append(badgeEl(b, got.has(b.id), s));
    openSheet(`称号（${got.size} / ${BADGES.length}）`, g);
  }
  $('#nav-badges').addEventListener('click', openBadges);

  // --- 設定 ---
  function openSettings() {
    const wrap = h('div');
    const row = (label, sub, ctl) => { const r = h('div', 'set-row'), l = h('div', null, label); if (sub) l.append(h('small', null, sub)); r.append(l, ctl); wrap.append(r); };
    const sw = (key, onChange) => {
      const b = h('button', 'switch'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!settings[key]));
      b.addEventListener('click', () => { settings[key] = !settings[key]; b.setAttribute('aria-checked', String(settings[key])); applySettings(); onChange?.(); });
      return b;
    };
    const seg = (key, opts) => {
      const box = h('div', 'seg');
      for (const [v, label] of opts) {
        const b = h('button', null, label); b.type = 'button'; b.setAttribute('aria-pressed', String(settings[key] === v));
        b.addEventListener('click', () => { settings[key] = v; applySettings(); box.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(opts[i][0] === v))); });
        box.append(b);
      }
      return box;
    };
    const night = h('button', 'switch'); night.type = 'button'; night.setAttribute('role', 'switch'); night.setAttribute('aria-checked', String(settings.theme === 'night'));
    night.addEventListener('click', () => { settings.theme = settings.theme === 'night' ? 'paper' : 'night'; night.setAttribute('aria-checked', String(settings.theme === 'night')); applySettings(); });
    row('夜モード', '目にやさしい藍色の画面', night);
    row('文字の大きさ', null, seg('font', [['s', '小'], ['m', '中'], ['l', '大']]));
    row('置き場の位置', '自動＝縦長は下、横長は右', seg('tray', [['auto', '自動'], ['bottom', '下'], ['right', '右'], ['left', '左']]));
    row('効果音', null, sw('sound', () => { if (settings.sound) Sound.snap(); }));
    if (navigator.vibrate) row('振動', 'はまったときに軽くふるえる（対応するスマホのみ）', sw('vibe', () => vibrate(30)));
    row('ピースを指の上に出す', 'タッチ操作のとき、ピースが指で隠れないように', sw('lift'));
    const reset = h('button', 'btn btn-small danger-btn', '消す'); reset.type = 'button';
    reset.addEventListener('click', () => {
      const body = h('div'); body.append(h('h3', null, '記録をすべて消しますか'), h('p', null, '小判・持っている地図と絵柄・称号・ベストタイム・設定がすべて消え、最初からになります。元には戻せません。'));
      openModal(body, [['やめる', closeModal, 'btn-primary'], ['すべて消す', () => { store.clearAll(); location.reload(); }]]);
    });
    row('記録をすべて消す', null, reset);
    // スマホに入れる(ホーム画面に追加)
    const inst = h('button', 'btn btn-small', isStandalone() ? '入れてあります' : installEvt ? '入れる' : '入れ方');
    inst.type = 'button'; inst.disabled = isStandalone();
    inst.addEventListener('click', installApp);
    row('スマホに入れる', 'ホーム画面からアプリとして起動できます', inst);
    row('バージョン', `${self.APP_BUILD} 更新`, h('span', null, `${self.APP_VERSION}`));
    // つくった人のサイト(アプリ版では端末のブラウザで開く)
    const site = h('a', 'btn btn-small', 'ひらく'); site.href = 'https://fumifum1.github.io/main/index.html';
    row('クリエイターのサイト', 'ほかのゲームや作品はこちら', site);
    const cr = h('p', 'note');
    cr.innerHTML = '地図：<a href="https://www.gsi.go.jp/kankyochiri/gm_jpn.html" target="_blank" rel="noopener">地球地図日本（国土地理院）</a>を加工（<a href="https://github.com/dataofjapan/land" target="_blank" rel="noopener">dataofjapan/land</a> 経由）、<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a><br>絵画：<a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a>（パブリックドメイン）<br>国旗：<a href="https://flagpedia.net/" target="_blank" rel="noopener">Flagpedia</a>（パブリックドメイン）';
    wrap.append(h('div', 'shop-sec', '出典'), cr);
    openSheet('設定', wrap);
  }
  $('#nav-settings').addEventListener('click', openSettings);

  // ===== 絵柄の決定と読み込み =====
  function resolveArt(mapId, choice) {
    if (choice === 'photo' && photo) return { ...PHOTO_ART, url: photo.url };
    const open = allArtsFor(mapId).filter((a) => !a.locked);
    if (!open.some((a) => a.id === choice)) choice = 'random';
    if (choice === 'random') {
      const last = store.get('lastArt:' + mapId, null);
      const pool = open.length > 1 ? open.filter((a) => a.id !== last) : open;
      choice = pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (choice === 'gen') return { id: 'gen', seed: (Math.random() * 1e9) | 0 };
    return open.find((a) => a.id === choice);
  }

  function makeGenerated(art) {
    const gw = 1800, gh = Math.round((gw * H) / W);
    const { canvas, title } = window.generateUkiyoe(art.seed, gw, gh);
    art.title = title; art.artist = '創作浮世絵'; art.series = `第${(art.seed % 9000) + 1000}景`;
    return new Promise((res) => canvas.toBlob((blob) => res(URL.createObjectURL(blob)), 'image/jpeg', 0.92));
  }

  function preload(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      const timer = setTimeout(() => rej(new Error('timeout')), 15000);
      img.onload = () => { clearTimeout(timer); res(url); };
      img.onerror = () => { clearTimeout(timer); rej(new Error('load error')); };
      img.referrerPolicy = 'no-referrer';
      img.src = url;
    });
  }

  async function loadArt(art) {
    if (artUrl) { URL.revokeObjectURL(artUrl); artUrl = null; }
    if (art.id === 'gen') { artUrl = await makeGenerated(art); return { art, href: artUrl }; }
    if (art.id === 'photo') return { art, href: art.url };
    try {
      return { art, href: await preload(art.url) };
    } catch {
      // オフライン等で読めない場合は創作浮世絵に切り替える
      const gen = { id: 'gen', seed: (Math.random() * 1e9) | 0, fallback: true };
      artUrl = await makeGenerated(gen);
      return { art: gen, href: artUrl };
    }
  }

  async function startGame({ mapId, stage, diffKey, artChoice, daily = null }) {
    const diff = diffOf(diffKey);
    $('#loading').hidden = false;
    $('#loading-text').textContent = mapId === 'japan' ? '絵を摺っています…' : '地図と絵を用意しています…';
    await new Promise((r) => setTimeout(r, 30)); // ローディング表示を先に描画
    let map;
    try { map = await loadMap(mapId); } catch {
      $('#loading').hidden = true;
      const body = h('div'); body.append(h('h3', null, '読み込めませんでした'), h('p', null, '地図データを読み込めませんでした。通信状態を確かめて、もう一度お試しください。'));
      return openModal(body, [['閉じる', closeModal, 'btn-primary']]);
    }
    useMap(map);
    const { art, href } = await loadArt(resolveArt(mapId, artChoice));
    $('#loading').hidden = true;
    if (art.id !== 'photo') store.set('lastArt:' + mapId, art.id);
    setupGame({ diff, art, href, stage, daily });
    if (art.fallback) toast('絵を読み込めなかったため、創作浮世絵で遊びます', 3500);
  }

  // ===== ボード =====
  const board = $('#board');
  const camera = $('#camera');
  const layers = {
    clips: $('#clips'), context: $('#context'), outline: $('#outline'), guide: $('#guide'), placed: $('#placed'),
    hint: $('#hint-layer'), loose: $('#loose'), cartouche: $('#cartouche'),
  };
  const tray = $('#tray'), trayList = $('#tray-list');
  let builtMap = null;

  // 地図ごとに変わらない部分(切り抜き・外枠・ガイド)を作る
  function useMap(map) {
    MAP = map; W = map.width; H = map.height; PIECES = map.pieces;
    if (builtMap === map.id) return;
    builtMap = map.id;
    for (const k of ['clips', 'context', 'outline', 'guide']) layers[k].innerHTML = '';
    board.setAttribute('viewBox', `0 0 ${W} ${H}`);
    for (const id of ['sea', 'sea-pattern', 'frame', 'surround']) {
      const el = document.getElementById(id);
      el.setAttribute('x', 0); el.setAttribute('y', 0); el.setAttribute('width', W); el.setAttribute('height', H);
    }
    const all = [...PIECES, ...map.fixed.map((f, i) => ({ ...f, id: 'f' + i }))];
    for (const p of all) {
      const cp = svgEl('clipPath', { id: `clip-${p.id}` }, layers.clips);
      svgEl('path', { d: p.d, 'clip-rule': 'evenodd' }, cp);
    }
    // パズルに入らない周りの陸地(大陸の図のみ)
    if (map.context) svgEl('path', { d: map.context, class: 'context-land' }, layers.context);
    // 外枠(常に表示): 太い線の上に塗りを重ねて、境界を消し海岸線だけ残す
    const lines = svgEl('g', {}, layers.outline), fills = svgEl('g', {}, layers.outline);
    for (const p of all) {
      svgEl('path', { d: p.d, class: 'coast-line' }, lines);
      svgEl('path', { d: p.d, class: 'coast-fill' }, fills);
    }
    // 沖縄のはめ込み枠は地図の約束事なので常に出す
    const r = map.inset;
    if (r) svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 4, class: 'guide-inset' }, layers.outline);
    // 形のガイド(オン・オフ切り替え)
    for (const p of PIECES) svgEl('path', { d: p.d, class: 'guide-pref' }, layers.guide);
  }

  // 地方ステージのときは、その地方が画面いっぱいになる位置を「ホーム」にする
  function homeCam(ids) {
    if (!ids) return { k: 1, tx: 0, ty: 0 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of PIECES) if (ids.has(p.id)) { const [x, y, w, hh] = p.bbox; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + hh); }
    const k = Math.max(1, Math.min(6, 0.85 * Math.min(W / (x1 - x0), H / (y1 - y0))));
    return { k, tx: W / 2 - ((x0 + x1) / 2) * k, ty: H / 2 - ((y0 + y1) / 2) * k };
  }

  function setupGame({ diff, art, href, stage, daily }) {
    // 前回の残りを片付ける
    for (const k of ['placed', 'hint', 'loose', 'cartouche']) layers[k].innerHTML = '';
    trayList.innerHTML = '';
    board.classList.remove('complete');
    $('#surround').setAttribute('href', href);

    const ids = stageIds(MAP, stage);
    const play = ids ? PIECES.filter((p) => ids.has(p.id)) : PIECES;
    S = {
      map: MAP, diff, art, href, daily,
      stage: { name: stage, ids }, play,
      target: daily?.cond === 'time' ? daily.limit : Math.ceil((play.length * SEC_PER[diff.key]) / 10) * 10,
      pieces: new Map(),
      placed: 0, hints: 0, penalty: 0,
      start: performance.now(), pausedAt: null, done: false,
      lastTouched: null,
      usedGuide: false,
      cam: { k: 1, tx: 0, ty: 0 },
    };
    S.home = homeCam(ids);

    setGuide(diff.guide);
    setArt(store.get('showArt', true));

    // 小さすぎる国は最初からはめておく
    MAP.fixed.forEach((f, i) => {
      const g = svgEl('g', { class: 'piece placed fixed' }, layers.placed);
      svgEl('image', { class: 'pimg', href, width: W, height: H, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#clip-f${i})` }, g);
      svgEl('path', { class: 'edge', d: f.d }, g);
    });

    for (const p of shuffle(play.slice())) {
      const st = { p, state: 'tray', dx: 0, dy: 0, el: null, thumb: makeThumb(p, href, diff) };
      S.pieces.set(p.id, st);
      trayList.append(st.thumb);
    }

    const parts = [daily ? '今日のお題' : null, MAP.id === 'japan' ? null : MAP.name, stage === 'all' ? null : stage, `${diff.lv}・${diff.name}`].filter(Boolean);
    $('#hud-diff').textContent = parts.join('・');
    $('#hud-art').textContent = artLabel(art);
    $('#hud-total').textContent = play.length;
    $('#hud-target').textContent = `${daily?.cond === 'time' ? '制限' : '目標'} ${fmtTime(S.target)}`;
    $('#btn-hint').disabled = false;
    $('#btn-guide').disabled = false;
    $('#btn-art').disabled = false;
    updateHud();
    closeSheet();
    $('#menu').hidden = true;
    $('#title').hidden = true;
    $('#game').hidden = false;
    trayList.scrollTo(0, 0);
    setCam(S.home.k, S.home.tx, S.home.ty);
    clearInterval(timerId); timerId = setInterval(updateTime, 250); updateTime();
    if (daily) toast(dailyText(daily), 3200);
  }

  const artLabel = (a) => `${a.artist}「${a.title}」`;

  function makeThumb(p, href, diff) {
    const div = h('div', 'thumb'); div.dataset.id = p.id;
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', diff.names ? p.name : 'ピース');
    const [bx, by, bw, bh] = p.bbox;
    const side = Math.max(bw, bh) * 1.1;
    const svg = svgEl('svg', { viewBox: `${bx + bw / 2 - side / 2} ${by + bh / 2 - side / 2} ${side} ${side}` });
    svgEl('image', { href, width: W, height: H, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#clip-${p.id})` }, svg);
    svgEl('path', { d: p.d, class: 'edge' }, svg);
    div.append(svg);
    if (diff.names) div.append(h('span', 'tname', p.name));
    div.addEventListener('pointerdown', onThumbDown);
    div.addEventListener('dragstart', (e) => e.preventDefault());
    return div;
  }

  function ensureBoardPiece(st) {
    if (st.el) return st.el;
    const p = st.p;
    const g = svgEl('g', { class: 'piece', 'data-id': p.id });
    svgEl('image', { class: 'pimg', href: S.href, width: W, height: H, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#clip-${p.id})` }, g);
    svgEl('path', { class: 'edge', d: p.d }, g);
    svgEl('path', { class: 'hit', d: p.d }, g);
    if (S.diff.names) svgEl('text', { class: 'plabel', x: p.cx, y: p.cy }, g).textContent = shortName(p.name);
    g.addEventListener('pointerdown', onPieceDown);
    st.el = g;
    return g;
  }
  const placeAt = (st) => st.el.setAttribute('transform', `translate(${st.dx} ${st.dy})`);

  // ===== カメラ(拡大・移動) =====
  function svgScale() { return board.getScreenCTM()?.a || 1; }
  function pxPerUnit() { return svgScale() * S.cam.k; }
  function clientToSvg(x, y) { const m = board.getScreenCTM().inverse(); return new DOMPoint(x, y).matrixTransform(m); }
  function clientToBoard(x, y) { const m = camera.getScreenCTM().inverse(); return new DOMPoint(x, y).matrixTransform(m); }

  function setCam(k, tx, ty) {
    k = Math.min(8, Math.max(1, k));
    const m = 0.15;
    tx = Math.min(W * m, Math.max(W - W * k - W * m, tx));
    ty = Math.min(H * m, Math.max(H - H * k - H * m, ty));
    Object.assign(S.cam, { k, tx, ty });
    camera.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
    camera.style.setProperty('--ls', ((13 * FONT_SCALE[settings.font]) / pxPerUnit()).toFixed(2));
  }
  function zoomAt(pt, f) {
    const { k, tx, ty } = S.cam;
    const k2 = Math.min(8, Math.max(1, k * f)), r = k2 / k;
    setCam(k2, pt.x - (pt.x - tx) * r, pt.y - (pt.y - ty) * r);
  }
  function animateCam(k, tx, ty, ms = 450) {
    const a = { ...S.cam }, t0 = performance.now();
    const step = (now) => {
      if (!S) return;
      const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3);
      setCam(a.k + (k - a.k) * e, a.tx + (tx - a.tx) * e, a.ty + (ty - a.ty) * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const boardCenter = () => { const r = board.getBoundingClientRect(); return clientToSvg(r.left + r.width / 2, r.top + r.height / 2); };

  board.addEventListener('wheel', (e) => {
    if (!S) return;
    e.preventDefault();
    zoomAt(clientToSvg(e.clientX, e.clientY), Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });

  // 背景ドラッグで移動、2本指でピンチ
  const pans = new Map();
  board.addEventListener('pointerdown', (e) => {
    if (!S || e.target.closest('.piece')) return;
    pans.set(e.pointerId, { x: e.clientX, y: e.clientY });
    board.setPointerCapture(e.pointerId);
    board.classList.add('panning');
  });
  board.addEventListener('pointermove', (e) => {
    const prev = pans.get(e.pointerId);
    if (!prev || !S) return;
    const s = svgScale();
    if (pans.size === 1) {
      setCam(S.cam.k, S.cam.tx + (e.clientX - prev.x) / s, S.cam.ty + (e.clientY - prev.y) / s);
    } else if (pans.size === 2) {
      const other = [...pans.entries()].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 }, m1 = { x: (e.clientX + other.x) / 2, y: (e.clientY + other.y) / 2 };
      setCam(S.cam.k, S.cam.tx + (m1.x - m0.x) / s, S.cam.ty + (m1.y - m0.y) / s);
      if (d0 > 0) zoomAt(clientToSvg(m1.x, m1.y), d1 / d0);
    }
    pans.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const endPan = (e) => { pans.delete(e.pointerId); if (!pans.size) board.classList.remove('panning'); };
  board.addEventListener('pointerup', endPan);
  board.addEventListener('pointercancel', endPan);

  $('#zoom-in').addEventListener('click', () => zoomAt(boardCenter(), 1.5));
  $('#zoom-out').addEventListener('click', () => zoomAt(boardCenter(), 1 / 1.5));
  $('#zoom-fit').addEventListener('click', () => animateCam(S.home.k, S.home.tx, S.home.ty));
  window.addEventListener('resize', () => { if (S) setCam(S.cam.k, S.cam.tx, S.cam.ty); });

  // ===== ピースのドラッグ =====
  let drag = null;

  function onThumbDown(e) {
    if (!S || S.done || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const thumb = e.currentTarget;
    drag = { st: S.pieces.get(+thumb.dataset.id), pointerId: e.pointerId, type: e.pointerType, fromTray: true, started: false, sx: e.clientX, sy: e.clientY, thumb };
    if (e.pointerType === 'mouse') e.preventDefault();
  }

  function onPieceDown(e) {
    if (!S || S.done || drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.stopPropagation();
    const g = e.currentTarget, st = S.pieces.get(+g.dataset.id);
    if (st.state !== 'loose') return;
    if (g.nextSibling) layers.loose.appendChild(g); // 最前面へ
    try { g.setPointerCapture(e.pointerId); } catch { /* 無視 */ }
    const pt = clientToBoard(e.clientX, e.clientY);
    drag = { st, pointerId: e.pointerId, type: e.pointerType, fromTray: false, started: true, thumb: st.thumb,
      grab: { x: pt.x - (st.p.cx + st.dx), y: pt.y - (st.p.cy + st.dy) } };
    g.classList.add('dragging');
    S.lastTouched = st.p.id;
    Sound.pick();
  }

  function beginTrayDrag() {
    const { st, thumb } = drag;
    ensureBoardPiece(st);
    layers.loose.appendChild(st.el);
    st.state = 'loose';
    thumb.classList.add('lifting');
    st.el.classList.add('dragging');
    // 指で隠れないよう、タッチ時はピースを指の少し上に出す(設定で切り替え)
    drag.grab = { x: 0, y: (drag.type === 'touch' && settings.lift ? 60 : 0) / pxPerUnit() };
    drag.started = true;
    S.lastTouched = st.p.id;
    Sound.pick();
  }

  window.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
      beginTrayDrag();
    }
    const pt = clientToBoard(e.clientX, e.clientY);
    const st = drag.st;
    st.dx = pt.x - drag.grab.x - st.p.cx;
    st.dy = pt.y - drag.grab.y - st.p.cy;
    placeAt(st);
    tray.classList.toggle('drop-back', overTray(e.clientX, e.clientY));
  });

  window.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag; drag = null;
    tray.classList.remove('drop-back');
    if (!d.started) return;
    const st = d.st;
    st.el.classList.remove('dragging');
    if (overTray(e.clientX, e.clientY)) return returnToTray(st);
    const tol = Math.max(18 / pxPerUnit(), 4) * S.diff.tol;
    if (Math.hypot(st.dx, st.dy) <= tol) return place(st);
    st.state = 'loose';
    st.thumb.classList.remove('lifting');
    st.thumb.classList.add('out');
  });

  window.addEventListener('pointercancel', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag; drag = null;
    tray.classList.remove('drop-back');
    if (d.started && d.fromTray) returnToTray(d.st);
    else if (d.started) d.st.el.classList.remove('dragging');
  });

  function overTray(x, y) {
    const r = tray.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function returnToTray(st) {
    st.state = 'tray';
    st.el.remove();
    st.thumb.classList.remove('lifting', 'out');
  }

  function place(st) {
    st.state = 'placed';
    st.dx = st.dy = 0;
    placeAt(st);
    st.el.querySelector('.plabel')?.remove();
    st.el.classList.add('placed', 'just-placed');
    layers.placed.appendChild(st.el);
    st.thumb.classList.remove('lifting');
    st.thumb.classList.add('out');
    S.placed++;
    updateHud();
    Sound.snap(); vibrate(20);
    if (S.placed === S.play.length) return complete();
    toast(`${st.p.name}　ぴたり`);
  }

  // ===== HUD・タイマー =====
  let timerId = null;
  const elapsed = () => (((S.pausedAt ?? performance.now()) - S.start) / 1000) + S.penalty;
  function updateTime() { if (S && !S.done) $('#hud-time').textContent = fmtTime(elapsed()); }
  function updateHud() {
    $('#hud-count').textContent = S.placed;
    $('#tray-left').textContent = S.play.length - S.placed;
  }
  document.addEventListener('visibilitychange', () => {
    if (!S || S.done) return;
    if (document.hidden) S.pausedAt = performance.now();
    else if (S.pausedAt != null) { S.start += performance.now() - S.pausedAt; S.pausedAt = null; }
  });

  let toastTimer = null;
  function toast(msg, ms = 1400) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }

  // ===== ヒント =====
  $('#btn-hint').addEventListener('click', () => {
    if (!S || S.done) return;
    let st = S.pieces.get(S.lastTouched);
    if (!st || st.state === 'placed') {
      const rest = [...S.pieces.values()].filter((x) => x.state !== 'placed');
      const loose = rest.filter((x) => x.state === 'loose');
      st = (loose.length ? loose : rest)[Math.floor(Math.random() * (loose.length || rest.length))];
    }
    layers.hint.innerHTML = '';
    svgEl('path', { d: st.p.d, class: 'hint-glow' }, layers.hint);
    if (st.state === 'tray') {
      st.thumb.classList.remove('hinted'); void st.thumb.offsetWidth; st.thumb.classList.add('hinted');
      st.thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    } else {
      layers.hint.appendChild(svgEl('path', { d: st.p.d, class: 'hint-glow', transform: `translate(${st.dx} ${st.dy})` }));
    }
    setTimeout(() => { layers.hint.innerHTML = ''; st.thumb.classList.remove('hinted'); }, 2600);
    S.hints++; S.penalty += HINT_PENALTY;
    updateTime();
    toast(`光るピースを、光る場所へ（+${HINT_PENALTY}秒）`, 2400);
  });

  // ===== まわりの絵柄の表示・非表示(設定は次のゲームにも引き継ぐ) =====
  function setArt(on) {
    board.classList.toggle('hide-art', !on);
    $('#btn-art').setAttribute('aria-pressed', String(on));
  }
  function toggleArt() {
    if (!S || S.done) return;
    const on = board.classList.contains('hide-art');
    setArt(on); store.set('showArt', on);
    toast(on ? 'まわりの絵柄 表示' : 'まわりの絵柄 非表示', 1200);
  }
  $('#btn-art').addEventListener('click', toggleArt);

  // ===== 形のガイド =====
  function setGuide(on) {
    board.classList.toggle('show-guide', on);
    $('#btn-guide').setAttribute('aria-pressed', String(on));
    if (on && !S.diff.guide) S.usedGuide = true;
  }
  function toggleGuide() {
    if (!S || S.done) return;
    const on = !board.classList.contains('show-guide');
    const first = on && !S.diff.guide && !S.usedGuide;
    setGuide(on);
    toast(on ? (first ? '形ガイド オン（ベスト記録なし）' : '形のガイド オン') : '形のガイド オフ', first ? 2600 : 1200);
  }
  $('#btn-guide').addEventListener('click', toggleGuide);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !$('#modal').hidden || $('#game').hidden) return;
    if (e.key === 'g' || e.key === 'G') toggleGuide();
    if (e.key === 'e' || e.key === 'E') toggleArt();
  });

  // ===== 見本 =====
  $('#btn-sample').addEventListener('click', () => {
    if (!S) return;
    const body = h('div');
    const img = h('img', 'sample-img'); img.src = S.href; img.alt = S.art.title; img.style.aspectRatio = `${W} / ${H}`;
    body.append(img, artCaption(S.art));
    openModal(body, [['閉じる', closeModal, 'btn-primary']]);
  });

  function artCaption(a) {
    const c = h('div', 'art-cap');
    c.append(h('div', 't', `${a.series ? a.series + '　' : ''}${a.title}`), h('div', 'a', a.artist));
    return c;
  }

  // ===== 完成 =====
  function complete() {
    S.done = true;
    clearInterval(timerId);
    const t = elapsed(), mapId = MAP.id, stage = S.stage.name, stageMode = stage !== 'all', n = S.play.length;
    $('#hud-time').textContent = fmtTime(t);
    for (const id of ['#btn-hint', '#btn-guide', '#btn-art']) $(id).disabled = true;

    // 星: 完成 / 目標タイム内 / ヒントもガイドも使わない
    const swift = t <= S.target, solo = S.hints === 0 && !S.usedGuide;
    const stars = 1 + (swift ? 1 : 0) + (solo ? 1 : 0);
    const prevStars = starsOf(mapId, stage);
    if (stars > prevStars) store.set(`stars:${mapId}:${stage}`, stars);

    // ベストタイム(ガイドを使った回は記録しない)
    const key = `best:${mapId}:${stage}:${S.diff.key}`, prevBest = store.get(key, null);
    const newBest = !S.usedGuide && (prevBest == null || t < prevBest);
    if (newBest) store.set(key, t);

    // 小判: ガイドを使った回は「ガイドありの難易度」相当
    const eff = S.usedGuide ? (S.diff.names ? 'easy' : 'shapes') : S.diff.key;
    const base = Math.max(stageMode ? 5 : 10, Math.round(n * MULT[eff])), bonus = stageMode ? 5 : 10;
    const doneKey = `done:${mapId}:${stage}:${S.diff.key}`, firstClear = !store.get(doneKey, false);
    const rewards = [['完成', base]];
    if (firstClear) rewards.push(['はじめてのクリア', base]);
    if (swift) rewards.push([`${S.daily?.cond === 'time' ? '制限' : '目標'}タイム内`, bonus]);
    if (solo) rewards.push(['ヒント・ガイドなし', bonus]);

    // 今日のお題
    let dailyOk = null;
    if (S.daily) {
      const d = dailyChallenge();
      dailyOk = d.cond === 'time' ? t <= d.limit : S.hints === 0;
      if (dailyOk && !d.done) {
        d.done = true; store.set('daily', d);
        const st = streak(), nStreak = st.last === yesterday() ? st.n + 1 : st.last === today() ? st.n : 1;
        store.set('streak', { last: today(), n: nStreak, max: Math.max(st.max, nStreak) });
        rewards.push([`今日のお題（連続${nStreak}日）`, d.reward]);
      }
    }

    // 記録と称号
    store.set(doneKey, true);
    store.set('clearsTotal', store.get('clearsTotal', 0) + 1);
    store.set('clears:' + mapId, store.get('clears:' + mapId, 0) + 1);
    const feats = store.get('feats', {});
    if (swift) feats.swift = true;
    if (solo) feats.solo = true;
    if (S.diff.key === 'master') feats.master = true;
    store.set('feats', feats);
    const total = rewards.reduce((a, [, v]) => a + v, 0);
    addKoban(total);
    const earned = checkBadges();

    layers.hint.innerHTML = '';
    drawCartouche(S.art);
    animateCam(1, 0, 0, 700);
    setTimeout(() => board.classList.add('complete'), 350);
    Sound.finish(); setTimeout(() => Sound.coin(), 900); vibrate([30, 60, 30]);
    toast('完成！', 2500);

    setTimeout(() => {
      if (!S || !S.done) return;
      const body = h('div');
      body.append(h('h3', null, stageMode ? `${stage} 完成` : '完　成'), artCaption(S.art));
      const sr = h('div', 'stars3'); for (let i = 0; i < 3; i++) sr.append(h('span', i < stars ? 'on' : 'off', '★')); body.append(sr);
      const cd = h('div', 'conds');
      for (const [ok, label] of [[true, '完成'], [swift, `${fmtTime(S.target)}以内`], [solo, 'ヒント・ガイドなし']]) cd.append(h('span', ok ? 'ok' : null, `${ok ? '✓' : '✗'} ${label}`));
      body.append(cd);
      const res = h('div', 'result');
      for (const [k, v] of [['タイム', fmtTime(t)], ['ヒント', `${S.hints}回`], ['ベスト', newBest ? fmtTime(t) : prevBest == null ? '―' : fmtTime(prevBest)]]) {
        const d = h('div'); d.append(h('div', 'k', k), h('div', 'v', v)); res.append(d);
      }
      body.append(res);
      if (newBest && prevBest != null) body.append(h('p', 'new-best', 'ベスト更新！'));
      if (S.daily) body.append(h('p', `daily-result ${dailyOk ? 'ok' : 'ng'}`, dailyOk ? 'お題達成！' : `お題は未達成（${S.daily.cond === 'time' ? fmtTime(S.daily.limit) + '以内' : 'ヒントなし'}）`));
      const rw = h('div', 'rewards');
      for (const [label, v] of rewards) { const r = h('div', 'rw'); r.append(h('span', null, label), kobanEl(v, '+')); rw.append(r); }
      if (earned.length) { const r = h('div', 'rw'); r.append(h('span', null, `称号「${earned.map((b) => b.name).join('」「')}」`), kobanEl(earned.reduce((a, b) => a + b.reward, 0), '+')); rw.append(r); }
      const tr = h('div', 'rw total'); tr.append(h('span', null, `合計（所持 ${koban()}枚）`), kobanEl(total + earned.reduce((a, b) => a + b.reward, 0), '+')); rw.append(tr);
      body.append(rw);
      if (earned.length) {
        const box = h('div', 'unlocked'); box.append(h('div', 'unlocked-head', '称号を手に入れました'));
        const g = h('div', 'badges'); earned.forEach((b) => g.append(badgeEl(b, true))); box.append(g); body.append(box);
      }
      // 次の地方(ステージのとき)
      const regions = mapInfo(mapId).regions, idx = regions.findIndex((r) => r.name === stage);
      const next = stageMode && !S.daily ? regions[(idx + 1) % regions.length].name : null;
      const again = store.get(selArtKey(mapId), 'random') === 'gen' ? 'gen' : 'random';
      const diffKey = S.diff.key;
      openModal(body, [
        S.daily ? ['メニューへ', () => { closeModal(); goMenu(); }, 'btn-primary']
          : next ? [`次は「${next}」`, () => { closeModal(); store.set('stage:' + mapId, next); startGame({ mapId, stage: next, diffKey, artChoice: again }); }, 'btn-primary']
            : ['別の絵でもう一度', () => { closeModal(); startGame({ mapId, stage, diffKey, artChoice: again }); }, 'btn-primary'],
        ['絵をながめる', closeModal],
        ...(S.daily ? [] : [['メニューへ', () => { closeModal(); goMenu(); }]]),
      ]);
    }, 3400);
  }

  // 題箋(たんざく)を右下に置く
  function drawCartouche(a) {
    const g = layers.cartouche; g.innerHTML = '';
    const ts = 24, ss = 14;
    const title = a.title.replace(/\s/g, ''), series = a.series || '';
    const colH = Math.max(title.length * ts * 1.05, series.length * ss * 1.08) + 26;
    const slipW = series ? 66 : 44;
    const x0 = W - slipW - 34, y0 = H - colH - 70;
    svgEl('rect', { x: x0, y: y0, width: slipW, height: colH, class: 'slip' }, g);
    svgEl('rect', { x: x0 + 4, y: y0 + 4, width: slipW - 8, height: colH - 8, class: 'slip2' }, g);
    const vtext = (str, x, y, size, cls) => [...str].forEach((ch, i) => {
      svgEl('text', { x, y: y + (i + 0.5) * size * 1.05, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: cls || '', style: 'writing-mode:horizontal-tb' }, g).textContent = ch;
    });
    const titleX = series ? x0 + slipW - 24 : x0 + slipW / 2;
    vtext(title, titleX, y0 + 13, ts);
    if (series) vtext(series, x0 + 18, y0 + 13, ss, 'sub');
    // 落款: 浮世絵は「北斎画」の形、世界の絵は作者名(国名の注記は省く)
    const sign = a.own ? '持込' : a.artist === '創作浮世絵' ? '創作画'
      : MAP.id === 'japan' ? a.artist.slice(-2) + '画' : a.artist.replace(/（.*?）/g, '').slice(0, 9);
    const sx = x0 - 18;
    vtext(sign, sx, y0 + colH - sign.length * 16 * 1.05 - 22, 16, 'sub');
    svgEl('rect', { x: sx - 8, y: y0 + colH - 18, width: 16, height: 16, rx: 2, class: 'sealmark' }, g);
  }

  // ===== モーダル =====
  function openModal(bodyEl, actions) {
    $('#modal-body').replaceChildren(bodyEl);
    const box = $('#modal-actions'); box.innerHTML = '';
    for (const [label, fn, cls] of actions) { const b = h('button', 'btn ' + (cls || ''), label); b.addEventListener('click', fn); box.append(b); }
    $('#modal').hidden = false;
    box.querySelector('button')?.focus();
  }
  function closeModal() { $('#modal').hidden = true; }
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#modal').hidden) closeModal();
    else if (!$('#sheet').hidden) closeSheet();
  });

  // ===== 画面遷移 =====
  function goMenu() {
    clearInterval(timerId);
    S = null; drag = null;
    showPicker();
  }
  // 下のメニューはタイトルと地図えらびの両方に出す(要素は1つなので見える画面へ移す)
  const tabbar = document.querySelector('.tabbar');
  function showPicker() {
    closeSheet();
    $('#menu').append(tabbar);
    $('#title').hidden = true; $('#game').hidden = true; $('#mini').hidden = true; $('#menu').hidden = false;
    renderMenu();
  }
  function showTitle(first) {
    closeSheet();
    $('#title').append(tabbar);
    $('#menu').hidden = true; $('#game').hidden = true; $('#mini').hidden = true; $('#title').hidden = false;
    changeTitleArt(first);
    renderMenu();
  }
  $('#btn-go').addEventListener('click', () => { Sound.ensure(); showPicker(); });
  $('#btn-title').addEventListener('click', () => showTitle());
  $('#btn-back').addEventListener('click', () => {
    if (!S || S.done || S.placed === 0) return goMenu();
    const body = h('div'); body.append(h('h3', null, '中断しますか'), h('p', null, 'いまのパズルは保存されません。'));
    openModal(body, [['つづける', closeModal, 'btn-primary'], ['メニューへ戻る', () => { closeModal(); goMenu(); }]]);
  });
  $('#btn-start').addEventListener('click', () => {
    Sound.ensure();
    if (!isMapOpen(sel.map)) {
      const m = mapInfo(sel.map);
      return confirmBuy({ key: 'map:' + m.id, title: `${m.name}の地図`, price: PRICES.maps[m.id] }, () => renderPicker(false));
    }
    startGame({ mapId: sel.map, stage: selectedStage(sel.map), diffKey: sel.diff, artChoice: selectedArt(sel.map) });
  });
  $('#btn-sound').addEventListener('click', () => { settings.sound = !settings.sound; applySettings(); if (settings.sound) Sound.snap(); });

  applySettings();
  // ===== スマホアプリとして入れる(PWA) =====
  let installEvt = null;
  function isStandalone() { return NATIVE || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
  window.addEventListener('appinstalled', () => { installEvt = null; });
  async function installApp() {
    if (installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; closeSheet(); return; }
    // iPhone など、ボタンで入れられないブラウザは手順を出す
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const body = h('div'); body.append(h('h3', null, 'スマホに入れる'));
    const ol = h('ol', 'install-steps');
    const steps = ios
      ? ['Safari でこのページを開く', '画面下の「共有」ボタン（□に↑）を押す', '「ホーム画面に追加」を選ぶ', '右上の「追加」を押す']
      : ['Chrome でこのページを開く', '右上の「︙」メニューを押す', '「アプリをインストール」または「ホーム画面に追加」を選ぶ', '「インストール」を押す'];
    steps.forEach((t) => ol.append(h('li', null, t)));
    body.append(ol, h('p', 'note', 'ホーム画面の「浮世ノ地図」から、アプリのように全画面で遊べます。一度開いた地図や絵は、電波がなくても遊べます。'));
    openModal(body, [['閉じる', closeModal, 'btn-primary']]);
  }
  // オフラインでも動くように(https か localhost のときだけ)
  if (!NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 入れられなくても遊べる */ });
  }

  if (NATIVE && window.Capacitor.Plugins?.App) {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
      if (!$('#modal').hidden) return closeModal();
      if (!$('#sheet').hidden) return closeSheet();
      if (!$('#game').hidden) return $('#btn-back').click();
      if (!$('#menu').hidden) return showTitle();
      if (!$('#mini').hidden) return window.MINI?.back();
      window.Capacitor.Plugins.App.exitApp();
    });
  }

  // ミニゲーム(minigames.js)に渡す道具
  window.UKIYO = { h, svgEl, $, store, Sound, vibrate, settings, fmtTime, shuffle, koban, addKoban, renderWallet, checkBadges, openModal, closeModal,
    COUNTRIES, flagUrl, shapeEl, speakThanks, choosePhoto, PHOTO_PRICE, PHOTO_SVG, pictureList, openArtChooser, JAPAN, MAP_LIST, artsFor, isMapOpen, loadMap, showTitle: () => showTitle(), showPicker: () => showPicker() };

  useMap(JAPAN);
  showTitle(true);
  loadFrames();
})();
