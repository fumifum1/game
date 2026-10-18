// 創作浮世絵ジェネレーター: シード値から毎回ちがう浮世絵風の一枚を描く
(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const INK = '#2a2420';
  const PAPER = '#f1e4c6';

  // 時間帯ごとの配色
  const SKIES = {
    day:   { top: '#24477a', mid: '#8fb0c8', low: '#f1e4c6', mist: 'rgba(246,234,208,0.92)', sea: ['#1d3b66', '#3f6f9f'], far: '#7d9bb8' },
    dusk:  { top: '#2b2f57', mid: '#d0603e', low: '#f4c77d', mist: 'rgba(244,196,160,0.88)', sea: ['#22305a', '#4b5f8f'], far: '#8b6b8a' },
    night: { top: '#0d1730', mid: '#2a3c63', low: '#5b7295', mist: 'rgba(130,148,184,0.55)', sea: ['#0f1d3a', '#2a4268'], far: '#3f557a' },
  };

  function generateUkiyoe(seed, W, H) {
    const R = mulberry32(seed);
    const rnd = (a = 0, b = 1) => a + (b - a) * R();
    const pick = (arr) => arr[Math.floor(R() * arr.length)];
    const chance = (p) => R() < p;

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const u = W / 1000; // 基準単位

    // --- 構図の抽選 ---
    const time = pick(['day', 'day', 'day', 'dusk', 'dusk', 'night']);
    const motif = pick(['wave', 'wave', 'fuji', 'fuji', 'river']);
    const season = pick(['spring', 'autumn', 'winter', 'none', 'none']);
    const rain = season !== 'winter' && time !== 'night' && chance(0.2);
    const redFuji = motif === 'fuji' && time !== 'night' && !rain && season !== 'winter' && chance(0.6);
    const sky = SKIES[time];
    const horizon = H * (motif === 'wave' ? rnd(0.58, 0.66) : rnd(0.55, 0.62));
    const flip = chance(0.5);

    // --- 空: 一文字ぼかし ---
    const sg = g.createLinearGradient(0, 0, 0, horizon);
    sg.addColorStop(0, sky.top);
    sg.addColorStop(0.16, sky.top);
    sg.addColorStop(0.42, sky.mid);
    sg.addColorStop(1, sky.low);
    g.fillStyle = sg; g.fillRect(0, 0, W, H);
    if (redFuji) { // 凱風快晴風の鰯雲
      g.fillStyle = 'rgba(255,255,255,0.75)';
      for (let row = 0; row < 7; row++) {
        const y = H * 0.12 + row * H * 0.035, n = 9 + row * 2;
        for (let i = 0; i < n; i++) {
          if (chance(0.35)) continue;
          const x = rnd(0, W), w = rnd(14, 42) * u;
          roundBlob(g, x, y + rnd(-6, 6) * u, w, w * 0.32);
        }
      }
    }

    // --- 日・月 ---
    const sunX = flip ? rnd(0.15, 0.35) * W : rnd(0.65, 0.85) * W;
    const sunY = rnd(0.12, 0.3) * H;
    if (time === 'night') {
      const glow = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, 120 * u);
      glow.addColorStop(0, 'rgba(255,248,220,0.55)'); glow.addColorStop(1, 'rgba(255,248,220,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      circle(g, sunX, sunY, 42 * u, '#f6eed2');
      if (chance(0.5)) { // 星
        g.fillStyle = 'rgba(255,250,230,0.8)';
        for (let i = 0; i < 70; i++) circle(g, rnd(0, W), rnd(0, horizon * 0.7), rnd(0.8, 2.2) * u);
      }
    } else if (!rain) {
      circle(g, sunX, sunY, (time === 'dusk' ? 70 : 46) * u, time === 'dusk' ? '#d8432c' : '#d4482f');
    }

    // --- 霞(すやり霞) ---
    const mistBands = [];
    for (let i = 0; i < rnd(2, 4); i++) mistBands.push(rnd(0.25, 0.5) * horizon + horizon * 0.45 * (i / 4));
    for (const y of mistBands) kasumi(g, y, sky.mist, W, u, rnd);

    // --- 遠山 ---
    g.fillStyle = sky.far; g.globalAlpha = 0.75;
    ridge(g, horizon, 40 * u, W, rnd, 0.008); g.fill();
    g.globalAlpha = 1;

    // --- 富士 ---
    const fujiBig = motif === 'fuji';
    const fx = fujiBig ? rnd(0.38, 0.62) * W : (flip ? rnd(0.62, 0.8) : rnd(0.2, 0.38)) * W;
    const fw = fujiBig ? rnd(0.36, 0.48) * W : rnd(0.12, 0.18) * W;
    const fh = fujiBig ? rnd(0.36, 0.44) * H : rnd(0.08, 0.13) * H;
    if (motif !== 'river' || chance(0.7)) drawFuji(g, fx, horizon + (fujiBig ? 4 * u : 0), fw, fh, { red: redFuji, season, time, rnd, u });

    // 霞を富士の裾に一本
    kasumi(g, horizon - fh * 0.12, sky.mist, W, u, rnd);

    // --- 地上 / 海 ---
    if (motif === 'wave') {
      const seaG = g.createLinearGradient(0, horizon, 0, H);
      seaG.addColorStop(0, sky.sea[1]); seaG.addColorStop(1, sky.sea[0]);
      g.fillStyle = seaG; g.fillRect(0, horizon, W, H - horizon);
      seaLines(g, horizon, H, W, u, rnd);
      // 小波
      for (let i = 0; i < 4; i++) {
        const bw = rnd(0.18, 0.3) * W;
        drawWave(g, rnd(-0.1, 0.9) * W, horizon + rnd(0.12, 0.25) * (H - horizon), bw, bw * 0.38, chance(0.5), sky, rnd, u);
      }
      boat(g, rnd(0.25, 0.75) * W, horizon + 0.45 * (H - horizon), 220 * u, rnd, u);
      // 大波
      const bigW = rnd(0.7, 0.9) * W;
      const bigX = flip ? W - bigW * 0.95 : -bigW * 0.05;
      drawWave(g, bigX, H * 1.02, bigW, rnd(0.55, 0.7) * H, flip, sky, rnd, u);
      boat(g, rnd(0.3, 0.7) * W, H * 0.93, 260 * u, rnd, u);
    } else {
      const greens = season === 'winter' ? ['#d8dcdf', '#bfc6cc', '#9aa6b0']
        : season === 'autumn' ? ['#8a7a3c', '#9b5a2c', '#5e4a2a'] : ['#6f8c4a', '#4f6f3a', '#3a5530'];
      if (time === 'night') greens.forEach((c, i) => (greens[i] = shade(c, -0.45)));
      if (motif === 'river') {
        hillsBand(g, horizon + 30 * u, 50 * u, greens[0], W, H, rnd, u, season);
        river(g, horizon, W, H, u, rnd, sky, flip);
        hillsBand(g, horizon + 0.45 * (H - horizon), 60 * u, greens[1], W, H, rnd, u, season, true);
        if (chance(0.6)) torii(g, rnd(0.15, 0.85) * W, horizon + 0.42 * (H - horizon), 60 * u);
      } else {
        hillsBand(g, horizon + 20 * u, 40 * u, greens[0], W, H, rnd, u, season);
        hillsBand(g, horizon + 0.35 * (H - horizon), 70 * u, greens[1], W, H, rnd, u, season, true);
      }
      hillsBand(g, horizon + 0.72 * (H - horizon), 60 * u, greens[2], W, H, rnd, u, season, true);
    }

    // --- 季節の前景 ---
    if (chance(0.55) && motif !== 'wave') pine(g, flip ? W * 0.9 : W * 0.1, H, H * 0.75, rnd, u, flip, season === 'winter');
    if (season === 'spring') blossomBranch(g, flip ? 0 : W, 0, W, H, rnd, u, !flip, '#f5c9d0', '#d2667c');
    if (season === 'autumn') { blossomBranch(g, flip ? 0 : W, 0, W, H, rnd, u, !flip, null, null); leaves(g, W, H, rnd, u); }

    // --- 鳥 ---
    if (!rain && chance(0.6)) birds(g, rnd(0.2, 0.7) * W, rnd(0.18, 0.35) * H, rnd, u, time === 'night' ? '#d9d2bc' : INK);

    // --- 天候 ---
    if (rain) rainLines(g, W, H, rnd, u);
    if (season === 'winter') snowfall(g, W, H, rnd, u);

    // --- 紙と版の質感 ---
    paperTexture(g, W, H, rnd, u);

    const PLACES = ['相州', '駿州', '武州', '甲州', '江戸', '近江', '紀州', '房州', '尾州', '奥州', '信州', '摂州', '播州', '筑前', '長門', '佐渡', '安房', '常陸'];
    const scene = rain ? pick(['白雨', '夕立', '驟雨'])
      : season === 'winter' ? pick(['雪景', '雪晴', '暮雪'])
      : redFuji ? pick(['赤富士', '凱風'])
      : time === 'night' ? pick(['月夜', '夜景', '秋月'])
      : time === 'dusk' ? pick(['夕映', '落照', '晩鐘'])
      : season === 'spring' ? pick(['春霞', '花盛'])
      : season === 'autumn' ? pick(['紅葉', '秋景'])
      : motif === 'wave' ? pick(['沖浪裏', '波濤', '荒波'])
      : motif === 'river' ? pick(['川辺', '渡し', '清流']) : pick(['富士遠望', '晴嵐']);
    return { canvas: cv, title: `${pick(PLACES)} ${scene}` };
  }

  // ===== 描画ヘルパー =====
  function circle(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); if (fill) g.fillStyle = fill; g.fill(); }
  function roundBlob(g, x, y, w, h) { g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2); g.fill(); }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  function kasumi(g, y, color, W, u, rnd) {
    g.save();
    g.fillStyle = color;
    let x = rnd(-0.2, 0.1) * W;
    while (x < W) {
      const len = rnd(0.15, 0.4) * W, h = rnd(18, 34) * u, dy = rnd(-14, 14) * u;
      g.beginPath(); g.roundRect(x, y + dy - h / 2, len, h, h / 2); g.fill();
      x += len + rnd(0.04, 0.2) * W;
    }
    g.restore();
  }

  function ridge(g, base, amp, W, rnd, freq) {
    const p1 = rnd(0, 6), p2 = rnd(0, 6);
    g.beginPath(); g.moveTo(0, base);
    for (let x = 0; x <= W; x += 6) {
      const y = base - amp * (0.5 + 0.35 * Math.sin(x * freq + p1) + 0.25 * Math.sin(x * freq * 2.7 + p2));
      g.lineTo(x, y);
    }
    g.lineTo(W, base + 4); g.lineTo(0, base + 4); g.closePath();
  }

  function fujiPath(g, fx, base, fw, fh) {
    const tw = fw * 0.13;
    g.beginPath();
    g.moveTo(fx - fw, base);
    g.quadraticCurveTo(fx - fw * 0.42, base - fh * 0.12, fx - tw, base - fh);
    g.lineTo(fx - tw * 0.5, base - fh * 1.015); g.lineTo(fx - tw * 0.1, base - fh * 0.99);
    g.lineTo(fx + tw * 0.4, base - fh * 1.012); g.lineTo(fx + tw, base - fh);
    g.quadraticCurveTo(fx + fw * 0.42, base - fh * 0.12, fx + fw, base);
    g.closePath();
  }

  function drawFuji(g, fx, base, fw, fh, o) {
    const { red, season, time, rnd, u } = o;
    const body = g.createLinearGradient(0, base - fh, 0, base);
    if (red) { body.addColorStop(0, '#7b2618'); body.addColorStop(0.55, '#b8462a'); body.addColorStop(1, '#c9673a'); }
    else if (time === 'night') { body.addColorStop(0, '#1f2f4f'); body.addColorStop(1, '#3d5378'); }
    else { body.addColorStop(0, '#24406b'); body.addColorStop(0.6, '#4d6f99'); body.addColorStop(1, '#88a5c2'); }
    fujiPath(g, fx, base, fw, fh); g.fillStyle = body; g.fill();

    g.save(); fujiPath(g, fx, base, fw, fh); g.clip();
    // 山肌の筋
    g.strokeStyle = red ? 'rgba(60,15,8,0.35)' : 'rgba(15,25,50,0.3)'; g.lineWidth = 1.6 * u;
    for (let i = 0; i < 26; i++) {
      const t = rnd(-1, 1), x0 = fx + t * fw * 0.12;
      g.beginPath(); g.moveTo(x0, base - fh); g.quadraticCurveTo(fx + t * fw * 0.45, base - fh * 0.35, fx + t * fw * rnd(0.6, 1), base); g.stroke();
    }
    // 雪
    const snowY = base - fh * (season === 'winter' ? 0.25 : red ? 0.78 : 0.6);
    g.fillStyle = time === 'night' ? '#d6dbe6' : '#fbf7ee';
    g.beginPath(); g.moveTo(fx - fw, 0); g.lineTo(fx + fw, 0);
    const N = 22;
    for (let i = N; i >= 0; i--) {
      const x = fx - fw + (2 * fw * i) / N;
      const y = snowY + (i % 2 ? rnd(0.06, 0.22) * fh : -rnd(0, 0.05) * fh);
      g.lineTo(x, y);
    }
    g.closePath(); g.fill();
    // 裾の樹林
    if (red || season !== 'winter') {
      g.fillStyle = red ? '#2f4a2c' : 'rgba(40,70,50,0.55)';
      for (let i = 0; i < 400; i++) {
        const x = fx + rnd(-1, 1) * fw, y = base - rnd(0, 0.16) * fh;
        circle(g, x, y, rnd(1.5, 4) * u);
      }
    }
    g.restore();
    fujiPath(g, fx, base, fw, fh); g.strokeStyle = 'rgba(30,25,20,0.55)'; g.lineWidth = 2 * u; g.stroke();
  }

  function bez(p0, p1, p2, p3, t) {
    const m = 1 - t;
    return [
      m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
      m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1],
    ];
  }

  // 北斎風の砕ける波
  function drawWave(g, x, base, w, h, mirror, sky, rnd, u) {
    g.save();
    g.translate(mirror ? x + w : x, base);
    g.scale(mirror ? -1 : 1, 1);
    const P = (a, b) => [a * w, -b * h];
    const back = [P(0, 0), P(0.15, 0.2), P(0.3, 0.97), P(0.58, 1)];
    const lip = [P(0.58, 1), P(0.8, 1.03), P(0.92, 0.74), P(0.8, 0.56)];
    const curl = [P(0.8, 0.56), P(0.74, 0.47), P(0.66, 0.62), P(0.67, 0.71)];
    const face = [P(0.67, 0.71), P(0.58, 0.6), P(0.62, 0.18), P(0.88, 0)];
    const path = () => {
      g.beginPath(); g.moveTo(...back[0]);
      for (const c of [back, lip, curl, face]) g.bezierCurveTo(...c[1], ...c[2], ...c[3]);
      g.closePath();
    };
    const grad = g.createLinearGradient(0, -h, 0, 0);
    grad.addColorStop(0, '#16305a'); grad.addColorStop(0.5, sky.sea[0]); grad.addColorStop(1, sky.sea[1]);
    path(); g.fillStyle = grad; g.fill();
    // 波の筋
    g.save(); path(); g.clip();
    g.strokeStyle = 'rgba(190,215,235,0.55)'; g.lineWidth = Math.max(1.2, w * 0.004);
    for (let i = 1; i <= 7; i++) {
      const k = i * 0.045;
      g.beginPath(); g.moveTo(back[0][0] + k * w, 0);
      g.bezierCurveTo(back[1][0] + k * w, back[1][1] + k * h * 0.6, back[2][0] + k * w * 0.6, back[2][1] + k * h, back[3][0] + k * w * 0.3, back[3][1] + k * h * 1.2);
      g.stroke();
    }
    // 内側の明るい面
    g.fillStyle = 'rgba(120,165,200,0.35)';
    g.beginPath(); g.moveTo(...face[0]); g.bezierCurveTo(...face[1], ...face[2], ...face[3]); g.lineTo(face[0][0] + w * 0.06, 0); g.closePath(); g.fill();
    g.restore();
    path(); g.strokeStyle = 'rgba(20,20,30,0.6)'; g.lineWidth = Math.max(1.5, w * 0.004); g.stroke();
    // 白い泡と爪
    g.fillStyle = '#fbf8ef'; g.strokeStyle = '#fbf8ef'; g.lineCap = 'round';
    const foamPts = [];
    for (let t = 0.55; t <= 1; t += 0.02) foamPts.push(bez(...back, t));
    for (let t = 0; t <= 1; t += 0.025) foamPts.push(bez(...lip, t));
    for (const [px, py] of foamPts) {
      circle(g, px + rnd(-0.008, 0.008) * w, py + rnd(-0.012, 0.004) * h, rnd(0.006, 0.014) * w);
      // 爪
      g.lineWidth = rnd(0.004, 0.008) * w;
      const len = rnd(0.02, 0.045) * w;
      g.beginPath(); g.moveTo(px, py);
      g.quadraticCurveTo(px + len, py - len * 0.9, px + len * 1.4, py - len * 0.2); g.stroke();
    }
    // しぶき
    for (let i = 0; i < 70; i++) {
      const [px, py] = bez(...lip, rnd(0, 1));
      circle(g, px + rnd(-0.05, 0.12) * w, py - rnd(0, 0.18) * h, rnd(0.002, 0.007) * w);
    }
    g.restore();
  }

  function seaLines(g, top, H, W, u, rnd) {
    g.strokeStyle = 'rgba(220,235,245,0.35)'; g.lineWidth = 1.4 * u;
    for (let y = top + 10 * u; y < H; y += rnd(12, 22) * u) {
      g.beginPath();
      for (let x = 0; x <= W; x += 30 * u) {
        const yy = y + Math.sin(x * 0.02 / u + y) * 3 * u;
        x === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy);
      }
      g.stroke();
    }
  }

  function boat(g, x, y, L, rnd, u) {
    g.save(); g.translate(x, y); g.rotate(rnd(-0.25, 0.25));
    g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, L * 0.12, L / 2, -L * 0.04);
    g.lineTo(L / 2 - L * 0.04, -L * 0.07); g.quadraticCurveTo(0, L * 0.02, -L / 2 + L * 0.03, -L * 0.04); g.closePath();
    g.fillStyle = '#e6cf9f'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5 * u; g.stroke();
    g.fillStyle = '#29324a';
    for (let i = 0; i < 8; i++) circle(g, -L * 0.36 + i * L * 0.09, -L * 0.045, L * 0.018);
    g.restore();
  }

  function hillsBand(g, base, amp, color, W, H, rnd, u, season, trees) {
    ridge(g, base, amp, W, rnd, rnd(0.004, 0.009) / u);
    g.lineTo(W, H); g.lineTo(0, H); g.closePath();
    g.fillStyle = color; g.fill();
    g.strokeStyle = 'rgba(30,25,20,0.45)'; g.lineWidth = 1.6 * u; g.stroke();
    if (season === 'winter') { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 7 * u; g.stroke(); }
    if (!trees) return;
    for (let i = 0; i < 60; i++) {
      const x = rnd(0, W), y = base - amp * rnd(0.05, 0.6) + rnd(0, 60) * u;
      const c = season === 'spring' && rnd() < 0.45 ? '#f2c3cb' : season === 'autumn' && rnd() < 0.6 ? pickC(rnd, ['#c4472b', '#d98a2f', '#a9361f']) : shade(color.startsWith('#') ? color : '#4f6f3a', -0.25);
      g.fillStyle = c;
      roundBlob(g, x, y, rnd(10, 22) * u, rnd(8, 14) * u);
    }
  }
  const pickC = (rnd, a) => a[Math.floor(rnd() * a.length)];

  function river(g, horizon, W, H, u, rnd, sky, flip) {
    const s = flip ? -1 : 1, cx = W / 2;
    g.beginPath();
    g.moveTo(cx - 20 * u, horizon + 30 * u);
    g.bezierCurveTo(cx + s * 260 * u, horizon + 120 * u, cx - s * 360 * u, H * 0.85, cx - s * 120 * u, H);
    g.lineTo(cx + s * 360 * u, H);
    g.bezierCurveTo(cx + s * 60 * u, H * 0.85, cx + s * 380 * u, horizon + 120 * u, cx + 20 * u, horizon + 30 * u);
    g.closePath();
    const rg = g.createLinearGradient(0, horizon, 0, H);
    rg.addColorStop(0, sky.sea[1]); rg.addColorStop(1, sky.sea[0]);
    g.fillStyle = rg; g.fill();
    g.save(); g.clip(); seaLines(g, horizon, H, W, u, rnd); g.restore();
  }

  function torii(g, x, y, s) {
    g.save(); g.translate(x, y); g.fillStyle = '#c8402c'; g.strokeStyle = INK; g.lineWidth = s * 0.03;
    g.fillRect(-s * 0.36, -s, s * 0.08, s); g.fillRect(s * 0.28, -s, s * 0.08, s);
    g.fillRect(-s * 0.5, -s * 1.05, s, s * 0.1); g.fillRect(-s * 0.42, -s * 0.8, s * 0.84, s * 0.07);
    g.restore();
  }

  function pine(g, x, H, h, rnd, u, flip, snow) {
    const s = flip ? -1 : 1;
    g.save(); g.translate(x, H);
    g.strokeStyle = '#4a3324'; g.lineCap = 'round';
    const top = [s * rnd(60, 140) * u, -h];
    for (let w = 26; w > 4; w -= 4) {
      g.lineWidth = w * u;
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(s * 80 * u, -h * 0.3, -s * 40 * u, -h * 0.65, ...top); g.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const t = 0.35 + i * 0.12;
      const bx = s * (rnd(-20, 60) * u), by = -h * t;
      const ex = bx + s * rnd(80, 200) * u * (i % 2 ? 1 : -0.7), ey = by + rnd(-30, 20) * u;
      g.lineWidth = 6 * u; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      for (let k = 0; k < 3; k++) {
        const px = bx + (ex - bx) * (0.5 + k * 0.25), py = by + (ey - by) * (0.5 + k * 0.25);
        g.fillStyle = '#2f4a2f'; roundBlob(g, px, py - 6 * u, rnd(60, 100) * u, rnd(22, 34) * u);
        g.strokeStyle = 'rgba(160,190,140,0.5)'; g.lineWidth = 1 * u;
        for (let n = -4; n <= 4; n++) { g.beginPath(); g.moveTo(px + n * 8 * u, py - 18 * u); g.lineTo(px + n * 9 * u, py + 4 * u); g.stroke(); }
        if (snow) { g.fillStyle = 'rgba(255,255,255,0.92)'; roundBlob(g, px, py - 18 * u, rnd(50, 80) * u, 12 * u); }
        g.strokeStyle = '#4a3324';
      }
    }
    g.restore();
  }

  function flower(g, x, y, r, petal, core) {
    g.fillStyle = petal;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; circle(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5); }
    circle(g, x, y, r * 0.22, core);
  }
  function mapleLeaf(g, x, y, r, rot, color) {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = color; g.beginPath();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 - Math.PI / 2; const rr = i % 2 ? r * 0.42 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    g.closePath(); g.fill(); g.restore();
  }

  function blossomBranch(g, x0, y0, W, H, rnd, u, toLeft, petal, core) {
    const s = toLeft ? -1 : 1;
    const end = [x0 + s * rnd(0.35, 0.55) * W, y0 + rnd(0.15, 0.3) * H];
    g.strokeStyle = '#3b2a20'; g.lineCap = 'round';
    for (let w = 18; w > 3; w -= 3) {
      g.lineWidth = w * u; g.beginPath(); g.moveTo(x0, y0 + 20 * u);
      g.bezierCurveTo(x0 + s * 120 * u, y0 + 160 * u, end[0] - s * 160 * u, end[1] - 60 * u, ...end); g.stroke();
    }
    for (let i = 0; i < 46; i++) {
      const t = rnd(0.15, 1);
      const p = bez([x0, y0 + 20 * u], [x0 + s * 120 * u, y0 + 160 * u], [end[0] - s * 160 * u, end[1] - 60 * u], end, t);
      const ox = rnd(-50, 50) * u, oy = rnd(-40, 50) * u;
      if (petal) flower(g, p[0] + ox, p[1] + oy, rnd(10, 18) * u, petal, core);
      else mapleLeaf(g, p[0] + ox, p[1] + oy, rnd(12, 22) * u, rnd(0, 6), pickC(rnd, ['#c4402a', '#d8762c', '#a8301e', '#e0a23a']));
    }
  }
  function leaves(g, W, H, rnd, u) {
    for (let i = 0; i < 30; i++) mapleLeaf(g, rnd(0, W), rnd(0.3, 1) * H, rnd(8, 14) * u, rnd(0, 6), pickC(rnd, ['#c4402a', '#d8762c', '#e0a23a']));
  }

  function birds(g, x, y, rnd, u, color) {
    g.strokeStyle = color; g.lineWidth = 2.4 * u; g.lineCap = 'round';
    const n = Math.floor(rnd(5, 11));
    for (let i = 0; i < n; i++) {
      const bx = x + i * rnd(26, 40) * u, by = y + Math.sin(i * 0.8) * 22 * u + i * 6 * u, s = rnd(9, 15) * u;
      g.beginPath(); g.moveTo(bx - s, by - s * 0.4); g.quadraticCurveTo(bx - s * 0.4, by - s * 0.5, bx, by);
      g.quadraticCurveTo(bx + s * 0.4, by - s * 0.5, bx + s, by - s * 0.4); g.stroke();
    }
  }

  function rainLines(g, W, H, rnd, u) {
    g.fillStyle = 'rgba(30,35,50,0.18)'; g.fillRect(0, 0, W, H * 0.25);
    g.strokeStyle = 'rgba(30,30,40,0.38)'; g.lineWidth = 1.1 * u;
    const ang = rnd(-0.35, 0.1);
    for (let i = 0; i < 520; i++) {
      const x = rnd(-0.2, 1.1) * W, y = rnd(-0.1, 1) * H, L = rnd(60, 160) * u;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(ang) * L, y + Math.cos(ang) * L); g.stroke();
    }
  }
  function snowfall(g, W, H, rnd, u) {
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 650; i++) circle(g, rnd(0, W), rnd(0, H), rnd(1.5, 5) * u);
  }

  function paperTexture(g, W, H, rnd, u) {
    // 木目(版木)の筋
    g.strokeStyle = 'rgba(90,60,30,0.035)'; g.lineWidth = 1;
    for (let y = 0; y < H; y += rnd(3, 9) * u) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + rnd(-4, 4) * u, W * 0.7, y + rnd(-4, 4) * u, W, y); g.stroke(); }
    // 和紙の斑点
    for (let i = 0; i < (W * H) / 500; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,248,230,0.07)' : 'rgba(80,55,30,0.06)';
      g.fillRect(rnd(0, W), rnd(0, H), rnd(1, 3) * u, rnd(1, 3) * u);
    }
    // 経年の焼け
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(240,220,170,0)'); v.addColorStop(1, 'rgba(150,110,50,0.28)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(241,228,198,0.08)'; g.fillRect(0, 0, W, H);
  }

  window.generateUkiyoe = generateUkiyoe;
  window.UKIYOE_PAPER = PAPER;
})();
