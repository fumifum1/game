// ミニゲーム: 国旗フラッシュ・シルエット当て・地球儀ダーツ・ありがとう聞き取り・名画スライド・首都の札合わせ
// 本体(app.js)が window.UKIYO に渡す道具を使う。1回1〜2分、結果に応じて小判(最大30枚)がもらえる
(function () {
  'use strict';
  const U = window.UKIYO;
  const { h, svgEl, $, store, Sound, vibrate, fmtTime, shuffle, openModal, closeModal, COUNTRIES, flagUrl } = U;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // 都道府県庁所在地(東京都は新宿区)
  const PREF_CAPITALS = {
    北海道: '札幌市', 青森県: '青森市', 岩手県: '盛岡市', 宮城県: '仙台市', 秋田県: '秋田市', 山形県: '山形市', 福島県: '福島市',
    茨城県: '水戸市', 栃木県: '宇都宮市', 群馬県: '前橋市', 埼玉県: 'さいたま市', 千葉県: '千葉市', 東京都: '東京（新宿区）', 神奈川県: '横浜市',
    新潟県: '新潟市', 富山県: '富山市', 石川県: '金沢市', 福井県: '福井市', 山梨県: '甲府市', 長野県: '長野市', 岐阜県: '岐阜市',
    静岡県: '静岡市', 愛知県: '名古屋市', 三重県: '津市', 滋賀県: '大津市', 京都府: '京都市', 大阪府: '大阪市', 兵庫県: '神戸市',
    奈良県: '奈良市', 和歌山県: '和歌山市', 鳥取県: '鳥取市', 島根県: '松江市', 岡山県: '岡山市', 広島県: '広島市', 山口県: '山口市',
    徳島県: '徳島市', 香川県: '高松市', 愛媛県: '松山市', 高知県: '高知市', 福岡県: '福岡市', 佐賀県: '佐賀市', 長崎県: '長崎市',
    熊本県: '熊本市', 大分県: '大分市', 宮崎県: '宮崎市', 鹿児島県: '鹿児島市', 沖縄県: '那覇市',
  };

  const GAMES = [
    { id: 'flag', name: '国旗フラッシュ', seal: '旗', desc: '60秒で国旗を何問当てられる？', unit: '問', start: startFlag },
    { id: 'shape', name: 'シルエット当て', seal: '形', desc: '影の形から県や国を当てよう', unit: '問', start: startShape },
    { id: 'darts', name: '地球儀ダーツ', seal: '的', desc: '地球儀を回して国の場所を突こう', unit: '点', start: startDarts },
    { id: 'thanks', name: 'ありがとう聞き取り', seal: '聴', desc: '何語の「ありがとう」か当てよう', unit: '問', start: startThanks },
    { id: 'slide', name: '名画スライド', seal: '絵', desc: '名画や自分の絵をずらして元の絵に戻そう', unit: '手', lowerBetter: true, subs: ['3×3', '4×4', '5×5'], start: startSlide },
    { id: 'memory', name: '首都の札合わせ', seal: '札', desc: '国と首都、県と県庁所在地をそろえよう', unit: '手', lowerBetter: true, start: startMemory },
  ];

  // ===== 画面 =====
  const scr = $('#mini'), body = $('#mini-body'), titleEl = $('#mini-title'), stat = $('#mini-stat');
  let cleanup = null, inGame = false;
  function stop() { cleanup?.(); cleanup = null; }
  function setGame(g) { stop(); inGame = true; titleEl.textContent = g.name; stat.textContent = ''; body.innerHTML = ''; }
  let from = 'title';
  function open() {
    Sound.ensure();
    from = $('#menu').hidden ? 'title' : 'picker';
    $('#title').hidden = true; $('#menu').hidden = true; $('#game').hidden = true;
    scr.hidden = false; showList();
  }
  function close() { stop(); inGame = false; scr.hidden = true; if (from === 'picker') U.showPicker(); else U.showTitle(); }
  function back() { if (inGame) showList(); else close(); }
  window.MINI = { back };
  $('#nav-mini').addEventListener('click', open);
  $('#mini-back').addEventListener('click', back);

  const bestKey = (g, sub) => 'mini:best:' + g.id + (sub ? ':' + sub : '');
  function bestText(g) {
    if (g.subs) {
      const parts = g.subs.map((sub) => [sub, store.get(bestKey(g, sub), null)]).filter(([, b]) => b != null);
      return parts.length ? 'ベスト ' + parts.map(([sub, b]) => `${sub} ${b}${g.unit}`).join('・') : 'まだ遊んでいません';
    }
    const b = store.get(bestKey(g), null);
    return b == null ? 'まだ遊んでいません' : `ベスト ${b}${g.unit}`;
  }
  function showList() {
    stop(); inGame = false;
    titleEl.textContent = '余興'; stat.textContent = '';
    body.innerHTML = '';
    body.append(h('p', 'mg-lead', '1回1〜2分。結果に応じて小判がもらえます（最大30枚）。'));
    const list = h('div', 'mg-list');
    for (const g of GAMES) {
      const b = h('button', 'mg-card'); b.type = 'button';
      b.append(h('span', 'mg-seal', g.seal), h('b', null, g.name), h('small', null, g.desc), h('span', 'mg-best', bestText(g)));
      b.addEventListener('click', () => g.start(g));
      list.append(b);
    }
    body.append(list);
  }

  // 結果(ベストを記録して小判を渡す)
  function finish(g, { score, detail, reward, sub }) {
    stop();
    const key = bestKey(g, sub), prev = store.get(key, null);
    const better = prev == null || (g.lowerBetter ? score < prev : score > prev);
    if (better) store.set(key, score);
    const gain = clamp(Math.round(reward), 0, 30);
    if (gain) U.addKoban(gain);
    const earned = U.checkBadges();
    Sound.finish(); if (gain) setTimeout(() => Sound.coin(), 700);
    const m = h('div', 'mg-result');
    m.append(h('h3', null, g.name), h('div', 'mg-score', `${score}${g.unit}`));
    if (detail) m.append(h('p', 'note', detail));
    m.append(h('p', better && prev != null ? 'new-best' : 'note', better && prev != null ? 'ベスト更新！' : `ベスト ${better ? score : prev}${g.unit}`));
    const k = h('p', 'gain'); k.append(h('span', 'koban'), document.createTextNode(` 小判 +${gain}枚`)); m.append(k);
    if (earned.length) m.append(h('p', 'new-best', `称号「${earned.map((b) => b.name).join('」「')}」を手に入れました`));
    openModal(m, [['もう一度', () => { closeModal(); g.start(g); }, 'btn-primary'], ['ほかのゲーム', () => { closeModal(); showList(); }]]);
  }

  // 4択ボタン
  function choices(labels, onPick) {
    const box = h('div', 'mg-choices'), btns = labels.map((t, i) => {
      const b = h('button', 'mg-choice', t); b.type = 'button';
      b.addEventListener('click', () => { if (box.dataset.locked) return; box.dataset.locked = '1'; onPick(i, b); });
      box.append(b); return b;
    });
    return { box, mark(correct, picked) { btns[correct].classList.add('ok'); if (picked !== correct) btns[picked]?.classList.add('ng'); } };
  }
  const answerFx = (ok) => { if (ok) Sound.snap(); else { Sound.pick(); vibrate(80); } };

  // 似た仲間(同じ地域)からまちがいの選択肢を選ぶ
  function distractors(correct, pool, sameKey, n = 3) {
    const same = shuffle(pool.filter((x) => x !== correct && x[sameKey] === correct[sameKey]));
    const other = shuffle(pool.filter((x) => x !== correct && x[sameKey] !== correct[sameKey]));
    return [...same.slice(0, 2), ...other].slice(0, n);
  }

  // ===== 1. 国旗フラッシュ =====
  function startFlag(g) {
    setGame(g);
    const LIMIT = 60000;
    let score = 0, miss = 0, end = performance.now() + LIMIT, busy = false;
    const bar = h('div', 'mg-timer'), fill = h('i'); bar.append(fill);
    const img = h('img', 'mg-flag'); img.alt = '国旗';
    const qbox = h('div', 'mg-q'); qbox.append(img);
    const area = h('div');
    body.append(bar, h('p', 'mg-hint', 'この国旗はどこの国？（まちがえると3秒へる）'), qbox, area);
    function next() {
      const c = pick(COUNTRIES), opts = shuffle([c, ...distractors(c, COUNTRIES, 'map')]);
      img.src = flagUrl(c);
      const ch = choices(opts.map((o) => o.name), (i) => {
        const ok = opts[i] === c; answerFx(ok);
        if (ok) score++; else { miss++; end -= 3000; }
        ch.mark(opts.indexOf(c), i);
        stat.textContent = `${score}問`;
        busy = true; setTimeout(() => { busy = false; if (performance.now() < end) next(); }, ok ? 350 : 900);
      });
      area.replaceChildren(ch.box);
    }
    const iv = setInterval(() => {
      const left = end - performance.now();
      fill.style.width = `${clamp(left / LIMIT, 0, 1) * 100}%`;
      if (left <= 0 && !busy) { clearInterval(iv); finish(g, { score, detail: `まちがい ${miss}回`, reward: score }); }
    }, 100);
    cleanup = () => clearInterval(iv);
    next();
  }

  // ===== 2. シルエット当て =====
  function modeSelect(g, opts, go, q = 'どちらで遊ぶ？') {
    body.append(h('p', 'mg-hint', q));
    const box = h('div', 'mg-modes');
    for (const [label, sub, v] of opts) {
      const b = h('button', 'mg-card'); b.type = 'button';
      b.append(h('b', null, label), h('small', null, sub)); b.addEventListener('click', () => go(v)); box.append(b);
    }
    body.append(box);
  }
  async function worldPieces() {
    const maps = await Promise.all(U.MAP_LIST.filter((m) => m.id !== 'japan').map((m) => U.loadMap(m.id)));
    const seen = new Set(), out = [];
    for (const m of maps) for (const p of m.pieces) {
      if (seen.has(p.name) || /領/.test(p.name) || p.bbox[2] * p.bbox[3] < 400) continue;
      seen.add(p.name); out.push({ ...p, group: m.id });
    }
    return out;
  }
  function silhouette(p) {
    const [x, y, w, hh] = p.bbox, pad = Math.max(w, hh) * 0.08;
    const svg = svgEl('svg', { viewBox: `${x - pad} ${y - pad} ${w + pad * 2} ${hh + pad * 2}`, preserveAspectRatio: 'xMidYMid meet', class: 'mg-sil' });
    svgEl('path', { d: p.d, 'fill-rule': 'evenodd' }, svg);
    return svg;
  }
  function startShape(g) {
    setGame(g);
    modeSelect(g, [['日本', '47都道府県', 'japan'], ['世界', '世界の国々', 'world']], async (mode) => {
      body.innerHTML = '';
      const pool = mode === 'japan' ? U.JAPAN.pieces.map((p) => ({ ...p, group: p.region })) : await worldPieces();
      const qs = shuffle(pool.slice()).slice(0, 10), t0 = performance.now();
      let i = 0, score = 0;
      const prog = h('p', 'mg-hint'), qbox = h('div', 'mg-q'), area = h('div');
      body.append(prog, qbox, area);
      const next = () => {
        if (i >= qs.length) {
          const sec = (performance.now() - t0) / 1000;
          return finish(g, { score, detail: `${mode === 'japan' ? '日本' : '世界'}・${fmtTime(sec)}`, reward: score * 2 + (score === 10 ? 5 : 0) });
        }
        const p = qs[i], opts = shuffle([p, ...distractors(p, pool, 'group')]);
        prog.textContent = `第${i + 1}問 / 10　この形はどこ？`;
        qbox.replaceChildren(silhouette(p));
        const ch = choices(opts.map((o) => o.name), (k) => {
          const ok = opts[k] === p; answerFx(ok); if (ok) score++;
          ch.mark(opts.indexOf(p), k); stat.textContent = `${score}問`;
          i++; setTimeout(next, ok ? 500 : 1100);
        });
        area.replaceChildren(ch.box);
      };
      next();
    });
  }

  // ===== 3. 地球儀ダーツ =====
  function distanceKm(a, b) {
    const R = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function startDarts(g) {
    setGame(g);
    const ROUNDS = 5, pool = COUNTRIES.filter((c) => c.shape && c.rarity <= 2);
    const qs = shuffle(pool.slice()).slice(0, ROUNDS);
    let i = 0, total = 0, locked = false;
    const prompt = h('p', 'mg-prompt'), hint = h('p', 'mg-hint', '地球儀をドラッグして回し、指でトンと突こう（150km以内で100点）'), res = h('p', 'mg-darts-res');
    const cv = h('canvas'); cv.className = 'mg-globe';
    body.append(prompt, cv, hint, res);
    const globe = new window.Globe(cv, { lon: 0, lat: 20 });
    globe.theme = U.settings.theme;
    // ドラッグで回す・タップで投げる
    let down = null;
    cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, lon: globe.lon, lat: globe.lat, moved: false }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) > 6) down.moved = true;
      if (!down.moved) return;
      const k = 180 / cv.getBoundingClientRect().width;
      globe.lon = down.lon - dx * k; globe.lat = clamp(down.lat + dy * k, -80, 80); globe.draw();
    });
    cv.addEventListener('pointerup', (e) => {
      const d = down; down = null;
      if (!d || d.moved || locked) return;
      const ll = globe.unproject(e.clientX, e.clientY);
      if (ll) throwDart({ lon: ll[0], lat: ll[1] });
    });
    function throwDart(hit) {
      locked = true;
      const c = qs[i], km = distanceKm(hit, c), pts = km <= 150 ? 100 : Math.max(0, Math.round(100 - (km - 150) / 50));
      total += pts; stat.textContent = `${total}点`;
      globe.pins = [{ ...hit, color: '#c3402b' }, { lon: c.lon, lat: c.lat, color: '#e0a23a' }];
      globe.setMarker(c.lon, c.lat);
      answerFx(pts >= 60);
      res.textContent = `${c.name}まで ${Math.round(km).toLocaleString()}km → ${pts}点`;
      globe.turnTo(c.lon, c.lat, 700);
      setTimeout(() => { i++; next(); }, 2200);
    }
    function next() {
      if (i >= ROUNDS) { globe.stop(); return finish(g, { score: total, detail: `${ROUNDS}回の合計（1回100点満点）`, reward: total / 20 }); }
      globe.pins = []; globe.setMarker(null); res.textContent = ''; locked = false;
      prompt.textContent = `第${i + 1}投：「${qs[i].name}」はどこ？`;
      globe.draw();
    }
    cleanup = () => globe.stop();
    next();
  }

  // ===== 4. ありがとう聞き取り =====
  function startThanks(g) {
    setGame(g);
    // 言葉ごとにまとめる(同じ言葉の国が選択肢に並ばないように)
    const byLang = new Map();
    for (const c of COUNTRIES) { if (!byLang.has(c.langName)) byLang.set(c.langName, []); byLang.get(c.langName).push(c); }
    const langs = [...byLang.keys()];
    const qs = shuffle(langs.slice()).slice(0, 8);
    let i = 0, score = 0;
    const prog = h('p', 'mg-hint'), play = h('button', 'btn mg-play'), note = h('p', 'tnote'), reveal = h('div', 'mg-reveal'), area = h('div');
    play.type = 'button';
    play.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/></svg>';
    play.append(document.createTextNode('もう一度聞く'));
    body.append(prog, play, note, reveal, area);
    let cur = null;
    // 案内文に言葉の名前が出ると答えがわかるので伏せる
    const say = () => U.speakThanks(cur, { set textContent(t) { note.textContent = t.split(cur.langName).join('その言葉'); } });
    play.addEventListener('click', () => cur && say());
    const next = () => {
      if (i >= qs.length) return finish(g, { score, detail: `${qs.length}問中`, reward: score * 2.5 });
      const lang = qs[i]; cur = pick(byLang.get(lang));
      const opts = shuffle([lang, ...shuffle(langs.filter((l) => l !== lang)).slice(0, 3)]);
      prog.textContent = `第${i + 1}問 / ${qs.length}　何語の「ありがとう」？`;
      reveal.replaceChildren();
      say();
      const ch = choices(opts, (k) => {
        const ok = opts[k] === lang; answerFx(ok); if (ok) score++;
        ch.mark(opts.indexOf(lang), k); stat.textContent = `${score}問`;
        const ex = byLang.get(lang).slice(0, 4).map((c) => c.name).join('・');
        reveal.append(h('b', null, `${cur.word}（${cur.yomi}）`), h('small', null, `${lang}：${ex}${byLang.get(lang).length > 4 ? 'など' : ''}`));
        i++; setTimeout(next, 2000);
      });
      area.replaceChildren(ch.box);
    };
    next();
  }

  // ===== 5. 名画スライド =====
  function startSlide(g) {
    setGame(g);
    const best = (n) => { const b = store.get(bestKey(g, `${n}×${n}`), null); return b == null ? '' : `・ベスト${b}手`; };
    modeSelect(g, [['3×3', 'かんたん' + best(3), 3], ['4×4', 'むずかしい' + best(4), 4], ['5×5', 'たいへん' + best(5), 5]], (N) => {
      body.innerHTML = '';
      modeSelect(g, [['ランダム', '持っている絵から', 'random'], ['絵画を選ぶ', '一覧から1枚えらぶ', 'choose'], ['写真', `1回・小判${U.PHOTO_PRICE}枚`, 'photo']], (kind) => {
        if (kind === 'random') return play(N, pick(U.pictureList()));
        if (kind === 'choose') return U.openArtChooser((art) => play(N, art));
        U.choosePhoto((art) => play(N, art));
      }, `${N}×${N}・どの絵で遊ぶ？`);
      const cards = body.querySelectorAll('.mg-modes .mg-card');
      cards[2]?.insertAdjacentHTML('afterbegin', `<span class="mg-photo-ico">${U.PHOTO_SVG}</span>`);
    }, 'どの大きさで遊ぶ？');
    function play(N, art) {
      setGame(g);
      const label = art.id === 'photo' ? 'あなたの写真' : art.frame ? `自分の絵「${art.title}」` : `${art.artist}「${art.title}」`;
      const info = h('p', 'mg-hint', `${label}を読み込み中…`);
      body.append(info);
      const img = new Image(); img.referrerPolicy = 'no-referrer';
      img.onerror = () => { info.textContent = '絵を読み込めませんでした。通信状態を確かめてください。'; };
      img.onload = () => build(img);
      img.src = art.url;
      function build(im) {
        info.textContent = `${label}　空いているところのとなりの札を押してずらそう`;
        const wrap = h('div', 'mg-slide-wrap'), board = h('div', 'mg-board'), mini = h('img', 'mg-sample'); mini.src = art.url; mini.alt = '見本';
        wrap.append(board, mini); body.append(wrap);
        const B = board.clientWidth, T = B / N, sc = Math.max(B / im.naturalWidth, B / im.naturalHeight);
        const iw = im.naturalWidth * sc, ihh = im.naturalHeight * sc, ox = (B - iw) / 2, oy = (B - ihh) / 2;
        // 解ける並びになるよう、そろった状態からランダムに動かして混ぜる
        let tiles = [...Array(N * N).keys()], empty = N * N - 1, prev = -1;
        const nbrs = (p) => [p - N, p + N, p % N ? p - 1 : -1, (p + 1) % N ? p + 1 : -1].filter((q) => q >= 0 && q < N * N);
        for (let k = 0; k < N * N * 30; k++) {
          const opts = nbrs(empty).filter((q) => q !== prev), q = pick(opts);
          [tiles[empty], tiles[q]] = [tiles[q], tiles[empty]]; prev = empty; empty = q;
        }
        let moves = 0; const t0 = performance.now();
        const els = [];
        for (let pos = 0; pos < N * N; pos++) {
          const el = h('button', 'mg-tile'); el.type = 'button';
          el.style.width = el.style.height = `${T}px`;
          el.addEventListener('click', () => move(pos));
          board.append(el); els.push(el);
        }
        function paint() {
          tiles.forEach((t, pos) => {
            const el = els[pos], r = Math.floor(pos / N), c = pos % N;
            el.style.left = `${c * T}px`; el.style.top = `${r * T}px`;
            if (t === N * N - 1) { el.classList.add('empty'); el.style.backgroundImage = 'none'; el.textContent = ''; return; }
            el.classList.remove('empty');
            const tr = Math.floor(t / N), tc = t % N;
            el.style.backgroundImage = `url("${art.url}")`;
            el.style.backgroundSize = `${iw}px ${ihh}px`;
            el.style.backgroundPosition = `${ox - tc * T}px ${oy - tr * T}px`;
            el.textContent = N >= 4 ? String(t + 1) : '';
          });
        }
        function move(pos) {
          if (!nbrs(empty).includes(pos)) return;
          [tiles[empty], tiles[pos]] = [tiles[pos], tiles[empty]]; empty = pos; moves++;
          Sound.pick(); stat.textContent = `${moves}手`; paint();
          if (tiles.every((t, k) => t === k)) {
            board.classList.add('done'); els[empty].style.backgroundImage = `url("${art.url}")`;
            const tt = N * N - 1; els[empty].style.backgroundSize = `${iw}px ${ihh}px`; els[empty].style.backgroundPosition = `${ox - (tt % N) * T}px ${oy - Math.floor(tt / N) * T}px`; els[empty].classList.remove('empty');
            const sec = (performance.now() - t0) / 1000;
            setTimeout(() => finish(g, { score: moves, detail: `${N}×${N}・${fmtTime(sec)}`, sub: `${N}×${N}`, reward: N === 3 ? clamp(25 - moves / 6, 5, 15) : N === 4 ? clamp(40 - moves / 8, 10, 30) : clamp(30 - moves / 25, 15, 30) }), 900);
          }
        }
        paint();
      }
    }
  }

  // ===== 6. 首都の札合わせ(神経衰弱) =====
  function startMemory(g) {
    setGame(g);
    modeSelect(g, [['日本', '県と県庁所在地', 'japan'], ['世界', '国と首都', 'world']], (mode) => {
      body.innerHTML = '';
      let pairs;
      if (mode === 'japan') {
        const prefs = U.JAPAN.pieces.map((p) => ({ name: p.name, cap: PREF_CAPITALS[p.name] }));
        const diff = shuffle(prefs.filter((p) => !p.cap.startsWith(p.name.replace(/[都道府県]$/, '')))), same = shuffle(prefs.filter((p) => !diff.includes(p)));
        pairs = shuffle([...diff.slice(0, 5), ...same.slice(0, 3)]).map((p) => [{ text: p.name }, { text: p.cap }]);
      } else {
        const ok = COUNTRIES.filter((c) => !/[（(]/.test(c.cap) && c.cap.length <= 10 && c.name.length <= 9 && c.cap !== c.name);
        pairs = shuffle(ok.slice()).slice(0, 8).map((c) => [{ text: c.name, flag: flagUrl(c) }, { text: c.cap }]);
      }
      const cards = shuffle(pairs.flatMap((pr, k) => pr.map((f, side) => ({ ...f, pair: k, side }))));
      body.append(h('p', 'mg-hint', mode === 'japan' ? '県と、その県庁所在地の札をそろえよう' : '国と、その首都の札をそろえよう'));
      const grid = h('div', 'mg-memory');
      let open = [], matched = 0, moves = 0, busy = false; const t0 = performance.now();
      for (const c of cards) {
        const el = h('button', 'mg-card2'); el.type = 'button';
        const front = h('span', 'face front'), backFace = h('span', 'face back', '浮');
        if (c.flag) { const im = h('img'); im.src = c.flag; im.alt = ''; front.append(im); }
        front.append(h('span', null, c.text));
        if (c.side === 1) front.classList.add('cap');
        el.append(backFace, front);
        el.addEventListener('click', () => flip(el, c));
        grid.append(el);
      }
      body.append(grid);
      function flip(el, c) {
        if (busy || el.classList.contains('open')) return;
        el.classList.add('open'); Sound.pick(); open.push({ el, c });
        if (open.length < 2) return;
        moves++; stat.textContent = `${moves}手`;
        const [a, b] = open; open = [];
        if (a.c.pair === b.c.pair) {
          a.el.classList.add('got'); b.el.classList.add('got'); Sound.snap(); matched++;
          if (matched === pairs.length) {
            const sec = (performance.now() - t0) / 1000;
            setTimeout(() => finish(g, { score: moves, detail: `${mode === 'japan' ? '日本' : '世界'}・${fmtTime(sec)}`, reward: clamp(30 - (moves - 8) * 1.5, 8, 25) }), 700);
          }
        } else {
          busy = true; vibrate(40);
          setTimeout(() => { a.el.classList.remove('open'); b.el.classList.remove('open'); busy = false; }, 900);
        }
      }
    });
  }
})();
