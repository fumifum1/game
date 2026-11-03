document.addEventListener('DOMContentLoaded', () => {
    // --- UI要素の取得 ---
    const canvas = document.getElementById('gameCanvas');
    const gameInfoEl = document.getElementById('game-info');
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesDisplayEl = document.getElementById('lives-display');
    const powerupEl = document.getElementById('powerup');
    const messageContainer = document.getElementById('message-container');
    const messageTitleEl = document.getElementById('message-title');
    const messageTextEl = document.getElementById('message-text');
    const restartButton = document.getElementById('restart-button');
    const hangarButton = document.getElementById('hangar-button');
    const messageCoinsEl = document.getElementById('message-coins');
    const pauseButton = document.getElementById('pause-button');
    const runCoinsEl = document.getElementById('run-coins');
    const hangarEl = document.getElementById('hangar');
    const hangarCoinCountEl = document.getElementById('hangar-coin-count');
    const shipGridEl = document.getElementById('ship-grid');
    const shipPreviewCanvas = document.getElementById('ship-preview');
    const shipNameEl = document.getElementById('ship-name');
    const shipDescEl = document.getElementById('ship-desc');
    const shipStatsEl = document.getElementById('ship-stats');
    const launchButton = document.getElementById('launch-button');

    // オーディオ要素
    const sounds = {
        bgm: new Audio('sounds/bgm.mp3'),
        shoot: new Audio('sounds/shoot.wav'),
        explosion: new Audio('sounds/explosion.wav'),
        playerHit: new Audio('sounds/player_hit.wav'),
        itemGet: new Audio('sounds/item_get.wav'),
        gameOver: new Audio('sounds/game_over.wav'),
        levelClear: new Audio('sounds/level_clear.wav')
    };
    sounds.bgm.loop = true;
    sounds.bgm.volume = 0.7;
    Object.values(sounds).forEach(sound => {
        if (sound !== sounds.bgm) {
            sound.volume = 0.9;
        }
        sound.load();
    });

    const playSound = (sound) => {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Sound play failed.", e));
    };

    // ゲーム設定
    const PLAYER_WIDTH = 40;
    const PLAYER_HEIGHT = 40;
    const BULLET_SPEED = 8;
    const HOMING_LIFETIME = 180; // 追尾ミサイルの寿命(フレーム)。敵の周りを回り続けるのを防ぐ
    const INVADER_WIDTH = 30;
    const INVADER_HEIGHT = 24;
    const INVADER_PADDING = 10;
    const INVADER_OFFSET_TOP = 50;
    const FORMATION_DROP = 8; // 編隊が端で折り返すときに下がる量
    const INVADER_BULLET_SPEED = 4;
    const INVADER_SHOOT_PROBABILITY = 0.0008;
    const ITEM_DROP_CHANCE = 0.25;
    const ITEM_SPEED = 3;
    const POWERUP_DURATION = 7000;
    const ITEM_TYPES = { SHIELD: 'SHIELD', DOUBLE_SHOT: '2-SHOT', RAPID_FIRE: 'RAPID', LIFE_UP: 'LIFE_UP', COIN: 'COIN' };
    const COIN_DROP_CHANCE = 0.3;
    const SCORE_PER_COIN = 200;   // ゲーム終了時、スコア200ごとに1コイン
    const CLEAR_BONUS_COINS = 100;
    const DEFENSE_LINE = canvas.height - PLAYER_HEIGHT - 30; // インベーダーがここまで来たらゲームオーバー
    const PLAYER_MIN_Y = canvas.height * 0.4; // 自機が上がれる上限 (敵編隊の上に回り込めないように)
    const MAGNET_RANGE = 130;
    const SAVE_KEY = 'arcadeInvade.save';

    // --- 機体の形 (40x40の座標系。part: wing / pod / body / cockpit の順に描画) ---
    const SHIP_SHAPES = {
        fighter: [
            ['wing', "M 14 20 L 2 28 L 2 36 L 14 32 Z"], ['wing', "M 26 20 L 38 28 L 38 36 L 26 32 Z"],
            ['pod', "M 7 15 L 4 25 L 4 35 L 10 35 L 10 25 Z"], ['pod', "M 33 15 L 30 25 L 30 35 L 36 35 L 36 25 Z"],
            ['body', "M 20 0 Q 25 10 25 25 L 25 35 L 28 38 L 22 40 L 20 38 L 18 40 L 12 38 L 15 35 L 15 25 Q 15 10 20 0 Z"],
            ['cockpit', "M 20 10 Q 22 15 22 20 L 18 20 Q 18 15 20 10 Z"],
        ],
        dart: [
            ['wing', "M 20 8 L 36 36 L 24 32 Z"], ['wing', "M 20 8 L 4 36 L 16 32 Z"],
            ['body', "M 20 0 L 24 14 L 24 34 L 20 40 L 16 34 L 16 14 Z"],
            ['cockpit', "M 20 8 L 22 16 L 18 16 Z"],
        ],
        heavy: [
            ['wing', "M 12 14 L 2 20 L 2 36 L 12 34 Z"], ['wing', "M 28 14 L 38 20 L 38 36 L 28 34 Z"],
            ['pod', "M 3 12 L 7 12 L 7 22 L 3 22 Z"], ['pod', "M 33 12 L 37 12 L 37 22 L 33 22 Z"],
            ['body', "M 14 2 L 26 2 L 29 10 L 29 36 L 24 40 L 16 40 L 11 36 L 11 10 Z"],
            ['cockpit', "M 17 8 L 23 8 L 23 16 L 17 16 Z"],
        ],
        twin: [
            ['wing', "M 14 16 L 26 16 L 26 28 L 14 28 Z"], ['wing', "M 6 22 L 0 32 L 0 38 L 6 34 Z"], ['wing', "M 34 22 L 40 32 L 40 38 L 34 34 Z"],
            ['body', "M 10 0 L 14 8 L 14 36 L 10 40 L 6 36 L 6 8 Z"], ['body', "M 30 0 L 34 8 L 34 36 L 30 40 L 26 36 L 26 8 Z"],
            ['cockpit', "M 17 18 L 23 18 L 23 26 L 17 26 Z"],
        ],
        trident: [
            ['wing', "M 16 18 L 9 20 L 9 30 L 16 30 Z"], ['wing', "M 24 18 L 31 20 L 31 30 L 24 30 Z"],
            ['pod', "M 6 6 L 9 14 L 9 32 L 3 32 L 3 14 Z"], ['pod', "M 34 6 L 37 14 L 37 32 L 31 32 L 31 14 Z"],
            ['body', "M 20 0 L 24 10 L 24 36 L 20 40 L 16 36 L 16 10 Z"],
            ['cockpit', "M 20 8 Q 22 13 22 18 L 18 18 Q 18 13 20 8 Z"],
        ],
        saucer: [
            ['wing', "M 2 24 Q 20 10 38 24 Q 20 38 2 24 Z"],
            ['pod', "M 3 28 L 8 28 L 8 36 L 3 36 Z"], ['pod', "M 32 28 L 37 28 L 37 36 L 32 36 Z"],
            ['body', "M 10 26 Q 10 8 20 8 Q 30 8 30 26 Z"],
            ['cockpit', "M 15 18 Q 20 11 25 18 L 25 21 L 15 21 Z"],
        ],
        lancer: [
            ['wing', "M 18 20 L 4 34 L 4 38 L 18 32 Z"], ['wing', "M 22 20 L 36 34 L 36 38 L 22 32 Z"],
            ['pod', "M 8 10 L 10 10 L 10 26 L 8 28 Z"], ['pod', "M 30 10 L 32 10 L 32 28 L 30 26 Z"],
            ['body', "M 20 0 L 22 6 L 22 30 L 26 36 L 20 40 L 14 36 L 18 30 L 18 6 Z"],
            ['cockpit', "M 20 14 L 21.5 22 L 18.5 22 Z"],
        ],
        seeker: [
            ['wing', "M 16 16 L 4 4 L 2 20 L 8 34 L 16 30 Z"], ['wing', "M 24 16 L 36 4 L 38 20 L 32 34 L 24 30 Z"],
            ['pod', "M 6 10 L 8 7 L 10 10 L 10 22 L 6 22 Z"], ['pod', "M 30 10 L 32 7 L 34 10 L 34 22 L 30 22 Z"],
            ['body', "M 20 4 L 24 14 L 24 34 L 20 38 L 16 34 L 16 14 Z"],
            ['cockpit', "M 20 10 L 22 18 L 18 18 Z"],
        ],
        phantom: [
            ['wing', "M 20 2 L 40 34 L 30 32 L 20 38 L 10 32 L 0 34 Z"],
            ['body', "M 20 6 L 24 20 L 22 34 L 20 36 L 18 34 L 16 20 Z"],
            ['cockpit', "M 20 12 L 22 20 L 18 20 Z"],
        ],
        nova: [
            ['wing', "M 20 6 L 38 26 L 30 28 L 34 38 L 20 32 L 6 38 L 10 28 L 2 26 Z"],
            ['pod', "M 0 18 L 4 14 L 6 26 L 2 28 Z"], ['pod', "M 40 18 L 36 14 L 34 26 L 38 28 Z"],
            ['body', "M 20 0 Q 26 10 26 22 L 24 36 L 20 40 L 16 36 L 14 22 Q 14 10 20 0 Z"],
            ['cockpit', "M 20 8 Q 23 14 22 20 L 18 20 Q 17 14 20 8 Z"],
        ],
    };
    const SHIP_PATHS = {};
    Object.entries(SHIP_SHAPES).forEach(([key, parts]) => {
        SHIP_PATHS[key] = parts.map(([part, d]) => ({ part, d, path: new Path2D(d) }));
    });

    // --- 機体の性能 ---
    // shot: single / double / triple / pierce / homing / nova
    // rating: 選択画面で表示する SPD / POW / DEF (1-5)
    const SHIPS = [
        { id: 'striker', name: 'STRIKER', shape: 'fighter', cost: 0, speed: 6, cooldown: 330, lives: 3, shot: 'single',
          colors: { wing: '#00aa00', pod: '#ccc', body: '#0f0', cockpit: '#aff', glow: '#0f0', bullet: '#ff0' },
          rating: [3, 2, 3], desc: 'バランス型の標準機。クセがなく扱いやすい。' },
        { id: 'swift', name: 'SWIFT', shape: 'dart', cost: 0, speed: 8.5, cooldown: 200, lives: 2, shot: 'single',
          colors: { wing: '#0088aa', pod: '#ccc', body: '#0ff', cockpit: '#fff', glow: '#0ff', bullet: '#0ff' },
          rating: [5, 3, 1], desc: '高速移動と速射が武器。ただしライフは2。' },
        { id: 'guardian', name: 'GUARDIAN', shape: 'heavy', cost: 0, speed: 4.5, cooldown: 400, lives: 4, shot: 'single', shieldRegen: 12000,
          colors: { wing: '#335599', pod: '#8af', body: '#6af', cockpit: '#ff0', glow: '#48f', bullet: '#8cf' },
          rating: [1, 2, 5], desc: '重装甲。シールドを常備し、壊れても12秒で回復。' },
        { id: 'twin', name: 'TWIN', shape: 'twin', cost: 40, speed: 6, cooldown: 350, lives: 3, shot: 'double',
          colors: { wing: '#aa5500', pod: '#ccc', body: '#f90', cockpit: '#ffe', glow: '#f90', bullet: '#fc0' },
          rating: [3, 3, 3], desc: '常に2連装ショットを撃つ双胴機。' },
        { id: 'trident', name: 'TRIDENT', shape: 'trident', cost: 80, speed: 5.5, cooldown: 420, lives: 3, shot: 'triple',
          colors: { wing: '#990099', pod: '#ddd', body: '#f0f', cockpit: '#aff', glow: '#f0f', bullet: '#f8f' },
          rating: [3, 4, 3], desc: '3方向に広がる拡散ショット。' },
        { id: 'magnet', name: 'MAGNET', shape: 'saucer', cost: 120, speed: 6, cooldown: 330, lives: 3, shot: 'single', magnet: true, coinMult: 2,
          colors: { wing: '#aa8800', pod: '#f44', body: '#fd0', cockpit: '#aff', glow: '#fd0', bullet: '#ffd' },
          rating: [3, 2, 3], desc: 'アイテムとコインを吸い寄せる。コイン2倍。' },
        { id: 'lancer', name: 'LANCER', shape: 'lancer', cost: 180, speed: 5.5, cooldown: 500, lives: 3, shot: 'pierce',
          colors: { wing: '#888', pod: '#ccc', body: '#eee', cockpit: '#f44', glow: '#fff', bullet: '#fff' },
          rating: [3, 4, 3], desc: '敵を貫通する槍弾。ボスに3倍ダメージ。' },
        { id: 'seeker', name: 'SEEKER', shape: 'seeker', cost: 250, speed: 6, cooldown: 450, lives: 3, shot: 'homing',
          colors: { wing: '#aa0000', pod: '#ddd', body: '#f33', cockpit: '#ff0', glow: '#f33', bullet: '#f84' },
          rating: [3, 4, 3], desc: '敵を自動で追いかけるミサイルを2発同時発射。' },
        { id: 'phantom', name: 'PHANTOM', shape: 'phantom', cost: 350, speed: 7, cooldown: 300, lives: 3, shot: 'single', dodge: 0.3, invincibleTime: 3000,
          colors: { wing: '#442266', pod: '#aaa', body: '#a6f', cockpit: '#0ff', glow: '#a6f', bullet: '#c9f' },
          rating: [4, 2, 4], desc: '敵弾を30%の確率ですり抜け、被弾後の無敵も長い。' },
        { id: 'nova', name: 'NOVA', shape: 'nova', cost: 500, speed: 6.5, cooldown: 380, lives: 3, shot: 'nova', bomb: 15000,
          colors: { wing: '#ff4400', pod: '#ff0', body: '#fff', cockpit: '#0ff', glow: '#fa0', bullet: '#fa0' },
          rating: [4, 5, 4], desc: '5方向ショット＋15秒ごとに敵弾を消し飛ばすノヴァ爆発。' },
    ];

    // --- セーブデータ (コインと解放済み機体) ---
    function loadSave() {
        try {
            const data = JSON.parse(localStorage.getItem(SAVE_KEY));
            if (data) {
                return {
                    coins: Math.max(0, data.coins | 0),
                    unlocked: Array.isArray(data.unlocked) ? data.unlocked : [],
                    selected: data.selected || SHIPS[0].id,
                };
            }
        } catch (e) { /* 読めなければ新規 */ }
        return { coins: 0, unlocked: [], selected: SHIPS[0].id };
    }
    function persist() {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* 保存できない環境 */ }
    }
    const save = loadSave();
    const isUnlocked = (ship) => ship.cost === 0 || save.unlocked.includes(ship.id);
    let currentShip = SHIPS.find(s => s.id === save.selected && isUnlocked(s)) || SHIPS[0];

    // --- 敵の種類 ---
    // path: 見た目 / fire: 撃ち方 (single・rapid・spread・aim・none) / hp: 耐久 (省略時1)
    // move: dive(急降下して戻る) / rush(溜めてから自機へ突進) / blink(瞬間移動) / split(倒すと2体に分裂)
    const INVADER_TYPES = {
        NORMAL:   { color: '#f00', path: 'alien', fire: 'single' },
        RAPID:    { color: '#f0f', path: 'alien', fire: 'rapid' },  // 弾を2連射
        SPREAD:   { color: '#0f0', path: 'alien', fire: 'spread' }, // 3方向拡散弾
        SNIPER:   { color: '#ff0', path: 'alien', fire: 'aim' },    // 自機を狙い撃つ
        DIVER:    { color: '#0ff', path: 'diver', fire: 'single', move: 'dive' },
        ARMOR:    { color: '#f80', path: 'armor', fire: 'single', hp: 3 },
        BLINKER:  { color: '#c8f', path: 'squid', fire: 'single', move: 'blink' },
        KAMIKAZE: { color: '#f55', path: 'arrow', fire: 'none', move: 'rush' },
        SPLITTER: { color: '#af0', path: 'squid', fire: 'single', move: 'split' },
        MINI:     { color: '#af0', path: 'alien', fire: 'none' },   // SPLITTERの分身
    };
    // ステージ配置表の1文字 → 敵の種類
    const INVADER_CODES = { N: 'NORMAL', R: 'RAPID', S: 'SPREAD', P: 'SNIPER', D: 'DIVER', A: 'ARMOR', B: 'BLINKER', K: 'KAMIKAZE', X: 'SPLITTER' };
    // 30x24の座標系。アニメーション用に2コマずつ
    const INVADER_PATHS = {
        alien: [
            new Path2D("M2 8 L2 20 L6 20 L6 24 L24 24 L24 20 L28 20 L28 8 L24 8 L24 4 L20 4 L20 0 L10 0 L10 4 L6 4 L6 8 Z M8 12 L12 12 L12 16 L8 16 Z M18 12 L22 12 L22 16 L18 16 Z"),
            new Path2D("M8 0 L22 0 L22 4 L26 4 L26 8 L30 8 L30 20 L26 20 L26 24 L22 24 L22 20 L18 20 L18 16 L12 16 L12 20 L8 20 L8 24 L4 24 L4 20 L0 20 L0 8 L4 8 L4 4 L8 4 Z M8 8 L12 8 L12 12 L8 12 Z M18 8 L22 8 L22 12 L18 12 Z"),
        ],
        diver: [
            new Path2D("M15 0 L25 10 L25 18 L20 24 L10 24 L5 18 L5 10 Z M15 4 L21 10 L18 13 L12 13 L9 10 Z"),
            new Path2D("M15 0 L27 10 L25 18 L20 24 L10 24 L5 18 L3 10 Z M15 4 L21 10 L18 13 L12 13 L9 10 Z"),
        ],
        armor: [
            new Path2D("M8 0 L22 0 L30 8 L30 18 L22 24 L8 24 L0 18 L0 8 Z M10 8 L20 8 L20 14 L10 14 Z"),
            new Path2D("M8 0 L22 0 L30 8 L30 18 L22 24 L8 24 L0 18 L0 8 Z M11 9 L19 9 L19 13 L11 13 Z"),
        ],
        squid: [
            new Path2D("M10 0 L20 0 L20 4 L24 4 L24 8 L28 8 L28 16 L24 16 L28 24 L22 24 L20 18 L10 18 L8 24 L2 24 L6 16 L2 16 L2 8 L6 8 L6 4 L10 4 Z M9 8 L13 8 L13 12 L9 12 Z M17 8 L21 8 L21 12 L17 12 Z"),
            new Path2D("M10 0 L20 0 L20 4 L24 4 L24 8 L28 8 L28 16 L24 16 L24 20 L20 24 L18 18 L12 18 L10 24 L6 20 L6 16 L2 16 L2 8 L6 8 L6 4 L10 4 Z M9 8 L13 8 L13 12 L9 12 Z M17 8 L21 8 L21 12 L17 12 Z"),
        ],
        arrow: [
            new Path2D("M0 0 L15 8 L30 0 L22 14 L15 24 L8 14 Z M13 10 L17 10 L15 16 Z"),
            new Path2D("M2 2 L15 8 L28 2 L22 14 L15 24 L8 14 Z M13 10 L17 10 L15 16 Z"),
        ],
    };

    // --- ステージ構成 ---
    // map: 1文字が敵1体 (INVADER_CODES を参照。'.' は空き)。wave: 編隊が波打つ
    // boss: ボス戦 (mid: 中ボス / final: ラスボス)
    const STAGES = [
        /*  1 */ { map: ['NNNNN', 'NNNNN', 'NNNNN', 'NNNNN'] },
        /*  2 */ { map: ['NDNDN', 'NNNNN', 'NNNNN', 'NNNNN'] },
        /*  3 */ { map: ['PNPNP', 'RRRRR', 'NNNNN', 'NNNNN', 'NNNNN'] },
        /*  4 */ { map: ['D.....D', 'ND...DN', '.NR.RN.', '..NAN..', '...A...'], wave: true },
        /*  5 */ { map: ['SSSSS', 'AAAAA', 'RRRRR', 'NNNNN', 'NNNNN'] },
        /*  6 */ { map: ['...B...', '..PNP..', '.RNDNR.', '..NAN..', '...B...'], wave: true },
        /*  7 */ { map: ['KDKDK', 'PPPPP', 'RRRRR', 'NNNNN', 'NNNNN'] },
        /*  8 */ { map: ['X.X.X.X', 'N.N.N.N', 'A.A.A.A', 'R.R.R.R', 'N.N.N.N'], wave: true },
        /*  9 */ { map: ['BSBSBS', 'AAAAAA', 'PRPRPR', 'DNNNND', 'NNNNNN'] },
        /* 10 */ { boss: 'mid' },
        /* 11 */ { map: ['KKKKK', 'SPSPS', 'AAAAA', 'DRDRD', 'NNNNN'] },
        /* 12 */ { map: ['XXXXXX', 'BNNNNB', 'PAAAAP', 'RRRRRR', 'DNNNND'], wave: true },
        /* 13 */ { map: ['K.....K', 'SA...AS', '.DP.PD.', '..XAX..', '...B...'], wave: true },
        /* 14 */ { map: ['PPPPPP', 'KAAAAK', 'SBSBSB', 'XRRRRX', 'DDDDDD'] },
        /* 15 */ { map: ['...K...', '..SAS..', '.PBXBP.', 'DAAAAAD', '.RRRRR.', '..NNN..'] },
        /* 16 */ { map: ['A.A.A.A', '.K.K.K.', 'P.X.X.P', '.D.D.D.', 'B.R.R.B'], wave: true },
        /* 17 */ { map: ['KKKKKKK', 'SPSPSPS', 'AAAAAAA', 'XBXBXBX', 'DDDDDDD'] },
        /* 18 */ { map: ['BKBKBK', 'PAPAPA', 'XSXSXS', 'AAAAAA', 'DRDRDR', 'NNNNNN'], wave: true },
        /* 19 */ { map: ['KSPKPSK', 'AAAAAAA', 'XBDXDBX', 'PAPAPAP', 'RRRRRRR', 'DDDDDDD'] },
        /* 20 */ { boss: 'final' },
    ];
    const MAX_LEVEL = STAGES.length;
    // hue: 画像の色相をずらして中ボスとラスボスを見分ける / rage: HPが半分を切ると速くなる
    const BOSS_TYPES = {
        mid:   { width: 160, hp: 150, speed: 1.5, cooldownScale: 1,   patterns: ['spread', 'snipe', 'laser'], hue: 140, rage: false, rewardCoins: 15 },
        final: { width: 200, hp: 350, speed: 2,   cooldownScale: 0.7, patterns: ['spread', 'snipe', 'laser', 'ring'], hue: 0, rage: true },
    };
    // ステージが進むほど速く・よく撃ち・よく襲ってくる
    function stageParams(lv) {
        return {
            speed: Math.min(0.5 + (lv - 1) * 0.09, 2),
            fire: INVADER_SHOOT_PROBABILITY * (1 + lv * 0.35),
            attackChance: 0.0015 + lv * 0.00015, // 1フレームごとに編隊から飛び出す確率
            maxAttackers: 1 + Math.floor(lv / 4), // 同時に編隊を離れる敵の上限
            armorHp: lv > 10 ? 4 : 3,
        };
    }

    // Boss Image
    const bossImage = new Image();
    bossImage.src = 'images/Boss.png';

    // ゲーム状態
    let ctx, player, bullets, invaderBullets, items, invaders, score, level, gameOver, lastShotTime, formation, stage, stageSlots, animationFrameId, boss, isPaused;
    let effects = [], runCoins = 0, lastEarnedCoins = 0, lastBombTime = 0, pausedAt = 0, isHangarOpen = false;
    // 移動キー (矢印キー / WASD)
    const KEY_DIRECTIONS = {
        arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right',
        arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down',
    };
    let keys = { left: false, right: false, up: false, down: false };

    // ゲーム初期化
    function init() {
        isPaused = false;
        ctx = canvas.getContext('2d');
        boss = null; // ボスをリセット
        if (player) clearTimeout(player.shieldRegenTimer);
        player = {
            x: canvas.width / 2 - PLAYER_WIDTH / 2,
            y: DEFENSE_LINE,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            speed: currentShip.speed,
            activePowerUps: [], // 複数のパワーアップを管理
            lives: currentShip.lives,
            invincible: false,
            invincibleTimer: null,
            innateShield: !!currentShip.shieldRegen, // GUARDIANの常備シールド
            shieldRegenTimer: null,
        };
        bullets = [];
        invaderBullets = [];
        items = [];
        effects = [];
        score = 0;
        level = 1;
        gameOver = false;
        lastShotTime = 0;
        lastBombTime = Date.now();
        runCoins = 0;
        keys = { left: false, right: false, up: false, down: false };

        setupLevel();
        updateUI();

        // UIの表示切り替え
        isHangarOpen = false;
        hangarEl.classList.add('hidden');
        messageContainer.classList.add('hidden');
        gameInfoEl.classList.remove('hidden');
        canvas.classList.remove('hidden');
        pauseButton.textContent = '❚❚';
        pauseButton.classList.remove('hidden');

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        gameLoop();
    }

    // ステージ設定
    function setupLevel() {
        const config = STAGES[level - 1];
        stage = stageParams(level);
        boss = null;
        invaders = [];
        bullets = [];
        invaderBullets = [];
        items = [];
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
        player.y = DEFENSE_LINE;

        if (config.boss) {
            setupBossFight(config.boss);
            showBanner('WARNING', '#f33');
            return;
        }

        const cellW = INVADER_WIDTH + INVADER_PADDING, cellH = INVADER_HEIGHT + INVADER_PADDING;
        const cols = Math.max(...config.map.map(row => row.length));
        formation = { x: (canvas.width - (cols * cellW - INVADER_PADDING)) / 2, y: INVADER_OFFSET_TOP, dir: 1, t: 0, wave: !!config.wave };
        stageSlots = []; // BLINKERのワープ先にもなる配置マス
        const now = Date.now();
        config.map.forEach((row, r) => {
            [...row].forEach((code, c) => {
                const slot = { x: c * cellW, y: r * cellH };
                stageSlots.push(slot);
                if (INVADER_CODES[code]) invaders.push(createInvader(INVADER_CODES[code], slot, now));
            });
        });
        showBanner(`STAGE ${level}`, '#0f0');
    }
    function createInvader(type, slot, now) {
        const hp = type === 'ARMOR' ? stage.armorHp : (INVADER_TYPES[type].hp || 1);
        return {
            type, slotX: slot.x, slotY: slot.y,
            x: formation.x + slot.x, y: formation.y + slot.y, width: INVADER_WIDTH, height: INVADER_HEIGHT,
            status: 1, hp, maxHp: hp,
            mode: 'formation', vx: 0, vy: 0,
            timer: now + 1500 + Math.random() * 2500, // BLINKERのワープ・KAMIKAZEの溜めに使う
            flash: 0,
        };
    }
    function showBanner(text, color) {
        effects.push({ type: 'banner', text, color, start: Date.now(), duration: 1600 });
    }

    // ボス戦設定
    function setupBossFight(kind) {
        const def = BOSS_TYPES[kind];
        const bossWidth = def.width;
        let bossHeight = bossWidth * 0.8; // 画像が読めていない時の高さ
        // 画像が読み込み済みであれば、アスペクト比を維持して高さを計算
        if (bossImage.complete && bossImage.naturalWidth > 0) {
            bossHeight = bossWidth * bossImage.naturalHeight / bossImage.naturalWidth;
        }

        boss = {
            kind, def,
            x: canvas.width / 2 - bossWidth / 2,
            y: -bossHeight, // 画面上部から登場
            width: bossWidth,
            height: bossHeight,
            direction: 1,
            hp: def.hp,
            maxHp: def.hp,
            active: true,
            pattern: 'spread',
            patternTimer: Date.now(),
            shootCooldown: 0,
        };
    }
    const isBossRaging = () => boss.def.rage && boss.hp < boss.maxHp / 2;
    // UI更新
    function updateUI() {
        scoreEl.textContent = score;
        levelEl.textContent = `LV${level}`;

        runCoinsEl.textContent = runCoins;

        // ライフ表示 (使用中の機体のシルエット)
        const livesCount = player.lives > 0 ? player.lives : 0;
        const iconPaths = SHIP_PATHS[currentShip.shape]
            .filter(p => p.part === 'wing' || p.part === 'body')
            .map(p => `<path d="${p.d}" fill="${currentShip.colors[p.part]}"></path>`)
            .join('');
        livesDisplayEl.innerHTML = `<svg width="20" height="20" viewBox="0 0 40 40" style="margin: 0 2px; vertical-align: middle;">${iconPaths}</svg>`.repeat(livesCount);

        const powerUpTexts = player.activePowerUps.map(p => {
            switch (p.type) {
                case ITEM_TYPES.SHIELD: return 'S';
                case ITEM_TYPES.DOUBLE_SHOT: return 'D';
                case ITEM_TYPES.RAPID_FIRE: return 'R';
                default: return '';
            }
        });
        if (player.innateShield) powerUpTexts.unshift('S');
        powerupEl.textContent = powerUpTexts.length > 0 ? powerUpTexts.join(' ') : '---';
    }

    // 機体を描画 (ゲーム画面・格納庫の両方で使う)
    function drawShip(c, ship, x, y, size, withFlame = true) {
        const SHADOW_BLUR = { wing: 5, pod: 2, body: 10, cockpit: 5 };
        c.save();
        c.translate(x, y);
        c.scale(size / 40, size / 40);
        SHIP_PATHS[ship.shape].forEach(({ part, path }) => {
            c.fillStyle = ship.colors[part];
            c.shadowColor = part === 'pod' ? '#fff' : ship.colors[part === 'wing' ? 'glow' : part];
            c.shadowBlur = SHADOW_BLUR[part];
            c.fill(path);
        });
        if (withFlame) {
            c.fillStyle = '#ff0';
            c.shadowColor = '#f00';
            c.shadowBlur = 15;
            c.fillRect(18, 38, 4, 4);
        }
        c.restore();
    }

    // --- 描画関数群 ---
    function drawPlayer() {
        if (player.invincible && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.save();
        if (currentShip.dodge) ctx.globalAlpha = 0.65 + Math.sin(Date.now() / 150) * 0.15; // PHANTOMは半透明
        if (hasShield()) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width * 0.625, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        if (currentShip.magnet) {
            ctx.strokeStyle = 'rgba(255, 220, 0, 0.15)';
            ctx.setLineDash([4, 6]);
            ctx.beginPath();
            ctx.arc(player.x + player.width / 2, player.y + player.height / 2, MAGNET_RANGE, 0, Math.PI * 2);
            ctx.stroke();
        }
        drawShip(ctx, currentShip, player.x, player.y, player.width);
        ctx.restore();
    }
    function drawBullets() {
        ctx.save();
        ctx.shadowBlur = 5;
        bullets.forEach(bullet => {
            const color = currentShip.shot === 'nova' ? `hsl(${(bullet.y * 2) % 360}, 100%, 60%)` : (bullet.color || currentShip.colors.bullet);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            if (bullet.homing) {
                ctx.beginPath();
                ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
            }
        });
        ctx.restore();
    }
    function drawEffects() {
        const now = Date.now();
        effects = effects.filter(e => now - e.start < e.duration);
        effects.forEach(e => {
            const t = (now - e.start) / e.duration;
            ctx.save();
            ctx.globalAlpha = 1 - t;
            if (e.type === 'ring') {
                ctx.strokeStyle = e.color;
                ctx.shadowColor = e.color;
                ctx.shadowBlur = 15;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(e.x, e.y, 10 + t * e.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (e.type === 'banner') {
                ctx.fillStyle = e.color;
                ctx.shadowColor = e.color;
                ctx.shadowBlur = 10;
                ctx.font = "22px 'Press Start 2P'";
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
                ctx.fillText(e.text, canvas.width / 2, canvas.height / 2 + 20);
            } else if (e.type === 'text') {
                ctx.fillStyle = e.color;
                ctx.font = "8px 'Press Start 2P'";
                ctx.textAlign = 'center';
                ctx.fillText(e.text, e.x, e.y - t * 20);
            }
            ctx.restore();
        });
    }
    function drawCoin(c, x, y, r) {
        c.save();
        c.fillStyle = '#fc0';
        c.shadowColor = '#fd0';
        c.shadowBlur = 8;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#a70';
        c.shadowBlur = 0;
        c.fillRect(x - r * 0.2, y - r * 0.55, r * 0.4, r * 1.1);
        c.restore();
    }
    function drawInvaderBullets() {
        ctx.save();
        ctx.shadowBlur = 5;
        invaderBullets.forEach(bullet => {
            ctx.fillStyle = ctx.shadowColor = bullet.color || '#f5a';
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });
        ctx.restore();
    }
    function drawItems() {
        items.forEach(item => {
            if (item.type === ITEM_TYPES.COIN) {
                drawCoin(ctx, item.x + item.width / 2, item.y + item.height / 2, item.width / 2);
                return;
            }
            ctx.save();
            ctx.font = "bold 20px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let char = '', color = '';
            switch (item.type) {
                case ITEM_TYPES.SHIELD: color = '#0af'; char = 'S'; break;
                case ITEM_TYPES.DOUBLE_SHOT: color = '#f90'; char = 'D'; break;
                case ITEM_TYPES.RAPID_FIRE: color = '#f0f'; char = 'R'; break;
                case ITEM_TYPES.LIFE_UP: color = '#0f0'; char = '+'; break;
            }
            if (char) {
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 10;
                ctx.fillText(char, item.x + item.width / 2, item.y + item.height / 2);
            }
            ctx.restore();
        });
    }
    function drawInvaders() {
        const now = Date.now();
        const animToggle = Math.floor(now / 500) % 2 === 0;
        invaders.forEach(invader => {
            if (invader.status !== 1) return;
            const def = INVADER_TYPES[invader.type];
            const pathSet = INVADER_PATHS[def.path];
            const color = invader.flash > now ? '#fff' : def.color; // 被弾した瞬間は白く光る

            ctx.save();
            ctx.translate(invader.x, invader.y);
            ctx.scale(invader.width / 30, invader.height / 24);
            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 5;
            ctx.fill(animToggle ? pathSet[0] : pathSet[1], 'evenodd');
            if (invader.maxHp > 1) { // 耐久ゲージ
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#400';
                ctx.fillRect(2, 26, 26, 3);
                ctx.fillStyle = '#fc0';
                ctx.fillRect(2, 26, 26 * invader.hp / invader.maxHp, 3);
            }
            ctx.restore();

            if (invader.mode === 'aim') { // 突進の予告
                ctx.save();
                ctx.fillStyle = '#f33';
                ctx.font = "10px 'Press Start 2P'";
                ctx.textAlign = 'center';
                ctx.fillText('!', invader.x + invader.width / 2, invader.y - 4);
                ctx.restore();
            }
        });
    }
    function drawBoss() {
        if (!boss || !boss.active) return;

        ctx.save();
        // ボス画像が読み込み済みの場合のみ描画
        if (bossImage.complete) {
            if (boss.def.hue) ctx.filter = `hue-rotate(${boss.def.hue}deg)`;
            ctx.shadowColor = isBossRaging() ? '#f00' : '#a0f';
            ctx.shadowBlur = 20;
            ctx.drawImage(bossImage, boss.x, boss.y, boss.width, boss.height);
        }
        ctx.restore();

        // HPバー
        if (!gameOver) { // ゲームオーバー（エンディング含む）時はHPバーを表示しない
            const barWidth = 200;
            const barHeight = 10;
            const barX = canvas.width / 2 - barWidth / 2;
            const barY = 15;
            const hpRatio = boss.hp / boss.maxHp;

            ctx.save();
            ctx.fillStyle = '#500';
            ctx.fillRect(barX, barY, barWidth, barHeight);
            ctx.fillStyle = '#f00';
            ctx.shadowColor = '#f00';
            ctx.shadowBlur = 5;
            ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(barX, barY, barWidth, barHeight);
            ctx.restore();
        }
    }
    function drawPauseScreen() {
        if (!isPaused) return;
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = "30px 'Press Start 2P'";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }
    // 一時停止機能
    function togglePause() {
        if (gameOver || !ctx || isHangarOpen) return;
        isPaused = !isPaused;
        if (isPaused) {
            pausedAt = Date.now();
            sounds.bgm.pause();
            pauseButton.textContent = '▶'; // 再開アイコン
            // ポーズした瞬間にオーバーレイを描画
            drawPauseScreen();
        } else {
            lastBombTime += Date.now() - pausedAt;
            sounds.bgm.play().catch(e => console.error("BGM play failed on resume:", e));
            pauseButton.textContent = '❚❚'; // 一時停止アイコン
            // ゲームループを再開
            gameLoop();
        }
    }

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    function clampPlayer() {
        player.x = clamp(player.x, 0, canvas.width - player.width);
        player.y = clamp(player.y, PLAYER_MIN_Y, canvas.height - player.height);
    }
    // 上下左右の自由移動 (斜めは速くなりすぎないよう補正)
    function movePlayer() {
        let dx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        let dy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
        if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
        player.x += dx * player.speed;
        player.y += dy * player.speed;
        clampPlayer();
    }
    function shoot() {
        const currentTime = Date.now();
        const hasRapid = player.activePowerUps.some(p => p.type === ITEM_TYPES.RAPID_FIRE);
        const hasDouble = player.activePowerUps.some(p => p.type === ITEM_TYPES.DOUBLE_SHOT);
        const currentCooldown = hasRapid ? currentShip.cooldown / 2 : currentShip.cooldown;
        if (currentTime - lastShotTime <= currentCooldown) return;

        const cx = player.x + player.width / 2;
        // offsetX: 機体中心からの横位置, angle: 真上からの角度(度)
        const fire = (offsetX, angle, opts = {}) => {
            const w = opts.width || 5, h = opts.height || 10, speed = opts.speed || BULLET_SPEED;
            const rad = angle * Math.PI / 180;
            bullets.push({
                x: cx + offsetX - w / 2, y: player.y, width: w, height: h,
                vx: Math.sin(rad) * speed, vy: -Math.cos(rad) * speed, damage: 1, ...opts,
            });
        };
        const edge = player.width / 2 - 2.5;
        switch (currentShip.shot) {
            case 'double':
                fire(-8, 0); fire(8, 0);
                break;
            case 'triple':
                fire(0, 0); fire(-4, -14); fire(4, 14);
                break;
            case 'nova':
                [-24, -12, 0, 12, 24].forEach(a => fire(0, a));
                break;
            case 'pierce':
                fire(0, 0, { width: 4, height: 22, speed: BULLET_SPEED * 1.3, pierce: true, damage: 3 });
                break;
            case 'homing':
                fire(-12, -25, { width: 7, height: 7, speed: 6, homing: true });
                fire(12, 25, { width: 7, height: 7, speed: 6, homing: true });
                break;
            default: // single (2-SHOT中は両翼から撃つので中央は撃たない)
                if (!hasDouble) fire(0, 0);
        }
        if (hasDouble) { fire(-edge, 0); fire(edge, 0); }
        lastShotTime = currentTime;
        playSound(sounds.shoot);
    }

    // 追尾ミサイルの狙う先 (一番近い敵 or ボス)
    function findHomingTarget(bullet) {
        if (boss && boss.active) return { x: boss.x + boss.width / 2, y: boss.y + boss.height / 2 };
        let best = null, bestDist = Infinity;
        invaders.forEach(inv => {
            if (inv.status !== 1) return;
            const tx = inv.x + inv.width / 2, ty = inv.y + inv.height / 2;
            const dist = Math.hypot(tx - bullet.x, ty - bullet.y);
            if (dist < bestDist) { bestDist = dist; best = { x: tx, y: ty }; }
        });
        return best;
    }

    function moveBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (b.homing) {
                b.life = (b.life || 0) + 1;
                if (b.life > HOMING_LIFETIME) { bullets.splice(i, 1); continue; }
                const target = findHomingTarget(b);
                if (target) {
                    const speed = Math.hypot(b.vx, b.vy);
                    const current = Math.atan2(b.vy, b.vx);
                    const desired = Math.atan2(target.y - b.y, target.x - b.x);
                    let diff = desired - current;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    const angle = current + clamp(diff, -0.12, 0.12);
                    b.vx = Math.cos(angle) * speed;
                    b.vy = Math.sin(angle) * speed;
                }
            }
            b.x += b.vx;
            b.y += b.vy;
            if (b.y < -b.height || b.y > canvas.height || b.x < -b.width || b.x > canvas.width) bullets.splice(i, 1);
        }
    }

    // NOVA: 一定時間ごとに敵弾を一掃する
    function updateNovaBomb() {
        if (!currentShip.bomb) return;
        const now = Date.now();
        if (now - lastBombTime < currentShip.bomb) return;
        lastBombTime = now;
        invaderBullets = [];
        effects.push({ type: 'ring', x: player.x + player.width / 2, y: player.y + player.height / 2, radius: 400, color: '#fa0', start: now, duration: 700 });
        playSound(sounds.explosion);
    }
    function moveInvaderBullets() {
        for (let i = invaderBullets.length - 1; i >= 0; i--) {
            const bullet = invaderBullets[i];
            if (bullet.dx !== undefined && bullet.dy !== undefined) {
                bullet.x += bullet.dx;
                bullet.y += bullet.dy;
            } else { // 古い形式の弾やレーザーのためのフォールバック
                bullet.y += bullet.speed;
            }
            if (bullet.y > canvas.height || bullet.y < -bullet.height || bullet.x < -bullet.width || bullet.x > canvas.width) invaderBullets.splice(i, 1);
        }
    }
    function moveItems() {
        const px = player.x + player.width / 2, py = player.y + player.height / 2;
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            const ix = item.x + item.width / 2, iy = item.y + item.height / 2;
            const dist = Math.hypot(px - ix, py - iy);
            if (currentShip.magnet && dist < MAGNET_RANGE && dist > 0) { // MAGNETは吸い寄せる
                item.x += (px - ix) / dist * 5;
                item.y += (py - iy) / dist * 5;
            } else {
                item.y += item.speed;
            }
            if (item.y > canvas.height) items.splice(i, 1);
        }
    }
    function invaderShoot() {
        if (boss && boss.active) return; // ボス戦中はインベーダーは撃たない
        invaders.forEach(invader => {
            if (invader.status !== 1 || invader.mode === 'return' || invader.y < 0) return;
            const fire = INVADER_TYPES[invader.type].fire;
            if (fire === 'none' || Math.random() >= stage.fire) return;

            const x = invader.x + invader.width / 2 - 2, y = invader.y + invader.height;
            switch (fire) {
                case 'rapid': // 2連射
                    invaderBullets.push({ x, y, width: 4, height: 8, dx: 0, dy: INVADER_BULLET_SPEED });
                    setTimeout(() => {
                        // インベーダーがまだ生きていれば2発目を発射
                        if (invader.status === 1 && !gameOver) {
                            invaderBullets.push({ x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height, width: 4, height: 8, dx: 0, dy: INVADER_BULLET_SPEED });
                        }
                    }, 150);
                    break;
                case 'spread': // 3方向拡散弾
                    [-1, 0, 1].forEach(dir => {
                        invaderBullets.push({ x, y, width: 5, height: 5, dx: dir * (INVADER_BULLET_SPEED / 2), dy: INVADER_BULLET_SPEED * 0.8 });
                    });
                    break;
                case 'aim': { // 自機を狙い撃ち
                    const angle = Math.atan2(player.y + player.height / 2 - y, player.x + player.width / 2 - x);
                    const speed = INVADER_BULLET_SPEED * 1.1;
                    invaderBullets.push({ x, y, width: 6, height: 6, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, color: '#ff0' });
                    break;
                }
                default:
                    invaderBullets.push({ x, y, width: 4, height: 8, dx: 0, dy: INVADER_BULLET_SPEED });
            }
        });
    }
    function bossShoot() {
        if (!boss || !boss.active || boss.y < 0) return;

        const now = Date.now();
        const scale = boss.def.cooldownScale * (isBossRaging() ? 0.75 : 1);

        // パターン切り替え
        if (now - boss.patternTimer > 8000) {
            const patterns = boss.def.patterns;
            boss.pattern = patterns[Math.floor(Math.random() * patterns.length)];
            boss.patternTimer = now;
            boss.shootCooldown = now + 1000 * scale; // パターン変更後少し待つ
        }

        if (now < boss.shootCooldown) return;

        const cx = boss.x + boss.width / 2, cy = boss.y + boss.height / 2;
        switch (boss.pattern) {
            case 'spread': // 拡散弾
                boss.shootCooldown = now + 800 * scale;
                for (let i = -2; i <= 2; i++) {
                    const angle = i * (Math.PI / 12);
                    invaderBullets.push({
                        x: cx, y: cy - 40, // 発射位置を少し上に変更
                        width: 6, height: 6,
                        dx: Math.sin(angle) * INVADER_BULLET_SPEED,
                        dy: Math.cos(angle) * INVADER_BULLET_SPEED
                    });
                }
                break;
            case 'snipe': { // 狙い撃ち
                boss.shootCooldown = now + 500 * scale;
                const angle = Math.atan2(player.y + player.height / 2 - cy, player.x + player.width / 2 - cx);
                invaderBullets.push({
                    x: cx, y: cy, // 発射位置をボスの中心に変更
                    width: 8, height: 8,
                    dx: Math.cos(angle) * INVADER_BULLET_SPEED * 1.5,
                    dy: Math.sin(angle) * INVADER_BULLET_SPEED * 1.5
                });
                break;
            }
            case 'ring': { // 回転しながら全方位に撃つ
                boss.shootCooldown = now + 1200 * scale;
                const offset = now / 400;
                for (let i = 0; i < 14; i++) {
                    const angle = offset + i * Math.PI * 2 / 14;
                    invaderBullets.push({ x: cx, y: cy, width: 6, height: 6, dx: Math.cos(angle) * 3, dy: Math.sin(angle) * 3, color: '#f80' });
                }
                break;
            }
            case 'laser':
                boss.shootCooldown = now + 3000 * scale;
                invaderBullets.push({
                    x: cx - 5, y: boss.y + boss.height,
                    width: 10, height: canvas.height, speed: 0,
                    isLaser: true,
                    timer: now
                });
                break;
        }
    }
    function moveInvaders() {
        if (boss && boss.active) { // ボス戦の動き
            if (boss.y < 50) {
                boss.y += 1; // 登場シーン
            } else {
                boss.x += boss.def.speed * (isBossRaging() ? 1.5 : 1) * boss.direction;
                if (boss.x < 0 || boss.x + boss.width > canvas.width) {
                    boss.direction *= -1;
                    boss.x = clamp(boss.x, 0, canvas.width - boss.width);
                }
            }
            return;
        }

        // 編隊の左右移動 (飛び出している敵も含めた、配置マスの端で折り返す)
        const slotted = invaders.filter(inv => inv.status === 1 && inv.slotX !== undefined);
        formation.x += stage.speed * formation.dir;
        formation.t++;
        if (slotted.length > 0) {
            const minX = Math.min(...slotted.map(inv => formation.x + inv.slotX));
            const maxX = Math.max(...slotted.map(inv => formation.x + inv.slotX + inv.width));
            if (minX < 0 || maxX > canvas.width) {
                formation.x -= stage.speed * formation.dir;
                formation.dir *= -1;
                formation.y += FORMATION_DROP;
            }
        }

        const now = Date.now();
        const px = player.x + player.width / 2, py = player.y + player.height / 2;
        let attackers = invaders.filter(inv => inv.status === 1 && ['aim', 'rush', 'dive'].includes(inv.mode)).length;
        let reachedLine = false;

        invaders.forEach(inv => {
            if (inv.status !== 1) return;
            const def = INVADER_TYPES[inv.type];
            const homeX = formation.x + inv.slotX;
            const homeY = formation.y + inv.slotY + (formation.wave ? Math.sin(formation.t * 0.05 + inv.slotX * 0.04) * 10 : 0);

            switch (inv.mode) {
                case 'formation':
                    inv.x = homeX;
                    inv.y = homeY;
                    if (inv.y + inv.height > DEFENSE_LINE) reachedLine = true;
                    if ((def.move === 'dive' || def.move === 'rush') && attackers < stage.maxAttackers && Math.random() < stage.attackChance) {
                        attackers++;
                        if (def.move === 'dive') {
                            inv.mode = 'dive';
                            inv.vx = (px > inv.x ? 1 : -1) * 1.5;
                            inv.vy = -2; // 一度ふわっと上がってから落ちる
                        } else {
                            inv.mode = 'aim';
                            inv.timer = now + 600;
                        }
                    }
                    if (def.move === 'blink' && now > inv.timer) blinkInvader(inv, now);
                    break;
                case 'dive': { // 自機の方へ弧を描いて急降下
                    const targetX = px - inv.width / 2;
                    inv.vx = clamp(inv.vx + clamp((targetX - inv.x) * 0.004, -0.15, 0.15), -3, 3);
                    inv.vy = Math.min(inv.vy + 0.12, 3.5 + level * 0.05);
                    inv.x += inv.vx;
                    inv.y += inv.vy;
                    if (inv.y > canvas.height) {
                        inv.mode = 'return';
                        inv.x = homeX;
                        inv.y = -inv.height;
                    }
                    break;
                }
                case 'aim': // 突進前の溜め (その場で震える)
                    inv.x = homeX + Math.sin(now / 20) * 2;
                    inv.y = homeY;
                    if (now > inv.timer) {
                        const dx = px - (inv.x + inv.width / 2), dy = py - (inv.y + inv.height / 2);
                        const dist = Math.hypot(dx, dy) || 1;
                        const speed = 4 + level * 0.08;
                        inv.vx = dx / dist * speed;
                        inv.vy = dy / dist * speed;
                        inv.mode = 'rush';
                    }
                    break;
                case 'rush': // 一直線に突進
                    inv.x += inv.vx;
                    inv.y += inv.vy;
                    if (inv.y > canvas.height || inv.x < -inv.width || inv.x > canvas.width) {
                        inv.mode = 'return';
                        inv.x = homeX;
                        inv.y = -inv.height;
                    }
                    break;
                case 'return': { // 画面の上から自分の配置マスへ戻る
                    const dx = homeX - inv.x, dy = homeY - inv.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist < 4) {
                        inv.mode = 'formation';
                    } else {
                        inv.x += dx / dist * 3;
                        inv.y += dy / dist * 3;
                    }
                    break;
                }
                case 'free': // SPLITTERの分身: 画面内を跳ね回る
                    inv.x += inv.vx;
                    inv.y += inv.vy;
                    if (inv.x < 0 || inv.x + inv.width > canvas.width) inv.vx *= -1;
                    if (inv.y < INVADER_OFFSET_TOP || inv.y + inv.height > canvas.height - 10) inv.vy *= -1;
                    inv.x = clamp(inv.x, 0, canvas.width - inv.width);
                    inv.y = clamp(inv.y, INVADER_OFFSET_TOP, canvas.height - 10 - inv.height);
                    break;
            }
        });

        if (reachedLine) endGame(false); // 編隊が防衛ラインまで来たらゲームオーバー
    }
    // BLINKER: 空いている配置マスへ瞬間移動する
    function blinkInvader(inv, now) {
        inv.timer = now + 2500 + Math.random() * 2000;
        const freeSlots = stageSlots.filter(slot => !invaders.some(other =>
            other !== inv && other.status === 1 && other.slotX === slot.x && other.slotY === slot.y));
        if (freeSlots.length === 0) return;
        const slot = freeSlots[Math.floor(Math.random() * freeSlots.length)];
        const ring = (x, y) => effects.push({ type: 'ring', x, y, radius: 20, color: '#c8f', start: now, duration: 300 });
        ring(inv.x + inv.width / 2, inv.y + inv.height / 2);
        inv.slotX = slot.x;
        inv.slotY = slot.y;
        inv.x = formation.x + slot.x;
        inv.y = formation.y + slot.y;
        ring(inv.x + inv.width / 2, inv.y + inv.height / 2);
    }
    const pointInRect = (x, y, r) => x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height;
    const rectsOverlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    // 自由移動で避けやすいよう、当たり判定は見た目より少し小さめ
    function playerHitbox() {
        return { x: player.x + 6, y: player.y + 4, width: player.width - 12, height: player.height - 8 };
    }

    function hasShield() {
        return player.innateShield || player.activePowerUps.some(p => p.type === ITEM_TYPES.SHIELD);
    }
    // シールドがあれば消費して true を返す
    function consumeShield() {
        if (player.activePowerUps.some(p => p.type === ITEM_TYPES.SHIELD)) {
            removePowerUp(ITEM_TYPES.SHIELD);
        } else if (player.innateShield) {
            player.innateShield = false;
            updateUI();
            clearTimeout(player.shieldRegenTimer);
            player.shieldRegenTimer = setTimeout(() => {
                if (gameOver) return;
                player.innateShield = true;
                updateUI();
            }, currentShip.shieldRegen);
        } else {
            return false;
        }
        activateInvincibility(500);
        return true;
    }
    // 被弾処理 (canDodge: PHANTOMのすり抜け判定をするか)
    function damagePlayer(canDodge) {
        if (player.invincible || gameOver) return;
        if (canDodge && currentShip.dodge && Math.random() < currentShip.dodge) {
            effects.push({ type: 'text', text: 'MISS', color: '#c9f', x: player.x + player.width / 2, y: player.y, start: Date.now(), duration: 600 });
            return;
        }
        if (consumeShield()) return;
        playSound(sounds.playerHit);
        player.lives--;
        updateUI();
        if (player.lives <= 0) {
            endGame(false);
        } else {
            activateInvincibility(currentShip.invincibleTime);
        }
    }

    function dropCoin(x, y) {
        items.push({ x: x - 8, y, width: 16, height: 16, speed: ITEM_SPEED, type: ITEM_TYPES.COIN });
    }
    function killInvader(invader) {
        invader.status = 0;
        score += invader.type === 'MINI' ? 5 * level : 10 * level * invader.maxHp;
        playSound(sounds.explosion);
        updateUI();
        if (INVADER_TYPES[invader.type].move === 'split') { // 2体の分身に分かれて跳ね回る
            [-1, 1].forEach(dir => invaders.push({
                type: 'MINI', x: invader.x + 6, y: invader.y + 5, width: 18, height: 14,
                status: 1, hp: 1, maxHp: 1, mode: 'free', vx: dir * (1.5 + level * 0.05), vy: 1.2, flash: 0,
            }));
        }
        if (invader.type === 'MINI') return; // 分身はアイテムを落とさない

        const cx = invader.x + invader.width / 2;
        if (Math.random() < ITEM_DROP_CHANCE) {
            let itemType;
            // レベル5以上で、20%の確率でライフアップアイテムが出現
            if (level >= 5 && Math.random() < 0.2) {
                itemType = ITEM_TYPES.LIFE_UP;
            } else {
                const powerUpTypes = [ITEM_TYPES.SHIELD, ITEM_TYPES.DOUBLE_SHOT, ITEM_TYPES.RAPID_FIRE];
                itemType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
            }
            items.push({ x: cx - 10, y: invader.y, width: 20, height: 20, speed: ITEM_SPEED, type: itemType });
            if (Math.random() < COIN_DROP_CHANCE) dropCoin(cx + 14, invader.y);
        } else if (Math.random() < COIN_DROP_CHANCE) {
            dropCoin(cx, invader.y);
        }
    }
    function hitInvader(invader, damage) {
        invader.hp -= damage;
        if (invader.hp <= 0) {
            killInvader(invader);
        } else {
            invader.flash = Date.now() + 80;
        }
    }
    // ボス撃破: ラスボスならエンディング、中ボスならコインをもらって次のステージへ
    function defeatBoss() {
        if (boss.kind === 'final') {
            endGame(true);
            return;
        }
        const reward = boss.def.rewardCoins * (currentShip.coinMult || 1);
        runCoins += reward;
        score += 2000;
        playSound(sounds.levelClear);
        effects.push({ type: 'ring', x: boss.x + boss.width / 2, y: boss.y + boss.height / 2, radius: 300, color: '#fd0', start: Date.now(), duration: 800 });
        effects.push({ type: 'text', text: `+${reward} COINS`, color: '#fd0', x: canvas.width / 2, y: canvas.height / 2 - 40, start: Date.now(), duration: 1500 });
        boss = null;
        level++;
        setupLevel();
        updateUI();
    }

    function checkCollisions() {
        // プレイヤーの弾と敵の衝突判定
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const bx = bullet.x + bullet.width / 2, by = bullet.y + bullet.height / 2;

            if (boss && boss.active) {
                if (!pointInRect(bx, by, boss)) continue;
                bullets.splice(i, 1);
                boss.hp -= bullet.damage || 1;
                score += 50;
                if (boss.hp <= 0) { defeatBoss(); return; }

                // ボスヒット時に低確率でアイテム・コインをドロップ
                if (Math.random() < 0.05) { // 5%の確率
                    let itemType;
                    if (Math.random() < 0.25) { // ライフアップはさらに低確率(全体の約1.25%)
                        itemType = ITEM_TYPES.LIFE_UP;
                    } else {
                        const powerUpTypes = [ITEM_TYPES.SHIELD, ITEM_TYPES.DOUBLE_SHOT, ITEM_TYPES.RAPID_FIRE];
                        itemType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                    }
                    items.push({ x: bx - 10, y: by, width: 20, height: 20, speed: ITEM_SPEED, type: itemType });
                } else if (Math.random() < 0.08) {
                    dropCoin(bx, by);
                }
                continue;
            }

            // 分裂で増えた敵をこの弾でそのまま撃たないよう、今いる敵だけを見る
            for (const invader of invaders.slice()) {
                if (invader.status !== 1 || !pointInRect(bx, by, invader)) continue;
                if (bullet.pierce) { // 貫通弾はそのまま進む (同じ敵には1回だけ当たる)
                    bullet.hits = bullet.hits || new Set();
                    if (bullet.hits.has(invader)) continue;
                    bullet.hits.add(invader);
                    hitInvader(invader, bullet.damage);
                } else {
                    hitInvader(invader, bullet.damage);
                    bullets.splice(i, 1);
                    break;
                }
            }
        }

        const hitbox = playerHitbox();

        // 自機とインベーダー・ボスの体当たり (無敵中はすり抜ける)
        if (!player.invincible) {
            for (const invader of invaders.slice()) {
                if (invader.status === 1 && rectsOverlap(hitbox, invader)) {
                    killInvader(invader);
                    damagePlayer(false);
                    break; // 被弾で無敵になるので、1フレームに1体だけ
                }
            }
            if (boss && boss.active && boss.y > 0 && rectsOverlap(hitbox, boss)) damagePlayer(false);
            if (gameOver) return;
        }

        for (let i = invaderBullets.length - 1; i >= 0; i--) {
            const bullet = invaderBullets[i];

            // レーザーの処理
            if (bullet.isLaser) {
                const laserActiveTime = 1000;
                const now = Date.now();
                if (now - bullet.timer > laserActiveTime) {
                    invaderBullets.splice(i, 1);
                    continue;
                }
                // レーザーの描画はdrawInvaderBulletsで行う
                if (rectsOverlap(hitbox, bullet) && !player.invincible && !consumeShield()) {
                    player.lives = 0; // レーザーは即死 (シールドがあれば身代わりになって壊れる)
                    updateUI();
                    endGame(false);
                    return;
                }
                continue; // 通常の弾の処理はスキップ
            }

            const bx = bullet.x + bullet.width / 2, by = bullet.y + bullet.height / 2;
            if (pointInRect(bx, by, hitbox)) {
                invaderBullets.splice(i, 1);
                damagePlayer(true);
                if (gameOver) return;
            }
        }
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (rectsOverlap(item, player)) {
                items.splice(i, 1);
                playSound(sounds.itemGet);
                if (item.type === ITEM_TYPES.COIN) {
                    const gain = currentShip.coinMult || 1;
                    runCoins += gain;
                    score += 20;
                    effects.push({ type: 'text', text: `+${gain}`, color: '#fd0', x: item.x + item.width / 2, y: item.y, start: Date.now(), duration: 500 });
                } else {
                    score += 100;
                    if (item.type === ITEM_TYPES.LIFE_UP) {
                        if (player.lives < 6) player.lives++; // ライフ上限を6に設定
                    } else {
                        addPowerUp(item.type);
                    }
                }
                updateUI();
            }
        }
    }
    function checkLevelClear() {
        const allDead = invaders.every(invader => invader.status === 0);
        if (allDead && !(boss && boss.active)) {
            playSound(sounds.levelClear);
            if (level < MAX_LEVEL) {
                level++;
                updateUI();
                setupLevel(); // ボスのステージならボス戦の準備になる
            }
        }
    }
    function activateInvincibility(duration = 1500) {
        player.invincible = true;
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        player.invincibleTimer = setTimeout(() => { player.invincible = false; }, duration);
    }
    function addPowerUp(type) {
        const existingIndex = player.activePowerUps.findIndex(p => p.type === type);
        if (existingIndex !== -1) {
            clearTimeout(player.activePowerUps[existingIndex].timer);
            player.activePowerUps.splice(existingIndex, 1);
        } else if (player.activePowerUps.length >= 2) { // 最大2つまで
            const removed = player.activePowerUps.shift();
            clearTimeout(removed.timer);
        }
        const timer = setTimeout(() => removePowerUp(type), POWERUP_DURATION);
        player.activePowerUps.push({ type, timer });
        updateUI();
    }
    function removePowerUp(type) {
        const index = player.activePowerUps.findIndex(p => p.type === type);
        if (index !== -1) {
            clearTimeout(player.activePowerUps[index].timer);
            player.activePowerUps.splice(index, 1);
            updateUI();
        }
    }

    // ゲーム終了
    function endGame(isWin) {
        if (gameOver) return; // 同じフレームで二重に呼ばれてもコインを二重加算しない
        sounds.bgm.pause();
        gameOver = true;
        pauseButton.classList.add('hidden');
        player.activePowerUps.forEach(p => clearTimeout(p.timer));
        player.activePowerUps = [];
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        clearTimeout(player.shieldRegenTimer);
        cancelAnimationFrame(animationFrameId);
        keys = { left: false, right: false, up: false, down: false };

        // コイン精算: 拾ったコイン + スコアボーナス (+ クリアボーナス)
        const earned = runCoins + Math.floor(score / SCORE_PER_COIN) + (isWin ? CLEAR_BONUS_COINS : 0);
        save.coins += earned;
        lastEarnedCoins = earned;
        persist();

        if (isWin) {
            startEndingSequence();
        } else {
            gameInfoEl.classList.add('hidden');
            canvas.classList.add('hidden');
            playSound(sounds.gameOver);
            messageTitleEl.textContent = 'GAME OVER';
            messageTextEl.textContent = `YOUR SCORE: ${score}`;
            messageCoinsEl.innerHTML = `<i class="coin-icon"></i>+${earned} <small>(TOTAL ${save.coins})</small>`;
            messageContainer.classList.remove('hidden');
        }
    }

    let endingStartTime = 0;

    function startEndingSequence() {
        endingStartTime = Date.now();
        
        // エンディング用にプレイヤーとボスを再配置//
        player.x = canvas.width / 2 - player.width / 2;
        player.y = DEFENSE_LINE;
        bullets = [];
        invaderBullets = [];
        items = [];
        
        // ボスを少し上に再配置
        if (boss) {
            boss.x = canvas.width / 2 - boss.width / 2;
            boss.y = 50;
            boss.hp = boss.maxHp; 
            boss.active = true;
        }

        // UIを隠す (canvasは表示したまま)
        gameInfoEl.classList.add('hidden');
        
        // クリア音
        playSound(sounds.levelClear);

        endingLoop();
    }

    function endingLoop() {
        const currentTime = Date.now();
        const elapsedTime = currentTime - endingStartTime;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (elapsedTime < 6000) {
            // Phase 1: 自動戦闘デモ (0-6秒)
            // GAME CLEAR テキスト
            ctx.save();
            ctx.fillStyle = '#ff0';
            ctx.font = "28px 'Press Start 2P'"; // 40pxだと画面幅からはみ出していた
            ctx.textAlign = 'center';
            ctx.shadowColor = '#f00';
            ctx.shadowBlur = 10;
            ctx.fillText('GAME CLEAR!', canvas.width / 2, canvas.height / 2 - 80);
            ctx.restore();

            // プレイヤー自動操作 (左右に揺れる)
            player.x = canvas.width / 2 - player.width / 2 + Math.sin(elapsedTime / 400) * 100;
            // プレイヤー射撃
            if (elapsedTime % 400 < 20) {
                 bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y, width: 5, height: 10, vx: 0, vy: -BULLET_SPEED });
                 playSound(sounds.shoot);
            }
            
            // ボス自動操作 (左右に揺れる)
            if (boss) {
                boss.x = canvas.width / 2 - boss.width / 2 + Math.sin(elapsedTime / 600) * 50;
                // ボス射撃
                if (elapsedTime % 600 < 20) {
                     invaderBullets.push({
                        x: boss.x + boss.width / 2, y: boss.y + boss.height / 2,
                        width: 6, height: 6, speed: INVADER_BULLET_SPEED,
                        dx: 0, dy: INVADER_BULLET_SPEED
                    });
                }
            }

            // 移動処理
            moveBullets();
            moveInvaderBullets();
            
            // 描画処理
            drawBullets();
            drawInvaderBullets();
            drawPlayer();
            if (boss) drawBoss();

        } else if (elapsedTime < 12000) {
            // Phase 2: ボス紹介 (6-12秒)
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // 背景を暗く
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            if (boss) {
                const centerX = canvas.width / 2 - boss.width / 2;
                const centerY = canvas.height / 2 - boss.height / 2 - 60;
                ctx.save();
                if (bossImage.complete) {
                    ctx.shadowColor = '#a0f';
                    ctx.shadowBlur = 20;
                    ctx.drawImage(bossImage, centerX, centerY, boss.width, boss.height);
                }
                ctx.restore();
            }

            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#fff';
            ctx.shadowBlur = 5;
            
            ctx.font = "20px 'Press Start 2P'";
            ctx.fillText("BOSS: CNP/MITAMA", canvas.width / 2, canvas.height / 2 + 60);
            
            ctx.font = "10px 'Press Start 2P'";
            ctx.fillStyle = '#aaa';
            ctx.fillText("The ultimate weapon", canvas.width / 2, canvas.height / 2 + 90);
            ctx.fillText("of the invader fleet.", canvas.width / 2, canvas.height / 2 + 110);
            ctx.restore();

        } else if (elapsedTime < 16000) {
            // Phase 3: THE END (12-16秒)
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.save();
            ctx.fillStyle = '#fff';
            ctx.font = "40px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.shadowColor = '#0f0';
            ctx.shadowBlur = 10;
            ctx.fillText("THE END", canvas.width / 2, canvas.height / 2);
            
            ctx.font = "15px 'Press Start 2P'";
            ctx.fillStyle = '#ff0';
            ctx.shadowColor = '#ff0';
            ctx.fillText(`FINAL SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 50);
            ctx.fillStyle = '#fd0';
            ctx.font = "12px 'Press Start 2P'";
            ctx.fillText(`COINS +${lastEarnedCoins}`, canvas.width / 2, canvas.height / 2 + 80);
            ctx.restore();

        } else {
            // Phase 4: リセット
            location.reload();
            return;
        }

        animationFrameId = requestAnimationFrame(endingLoop);
    }

    // ゲームループ
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!isPaused) {
            movePlayer(); // プレイヤーの移動
            shoot();      // プレイヤーの射撃
            moveBullets();
            moveInvaderBullets();
            moveItems();
            moveInvaders(); // ボスがいてもいなくてもインベーダー（またはボス）の移動処理は必要
            invaderShoot(); // 通常インベーダーの射撃
            bossShoot();    // ボスの射撃
            updateNovaBomb();
        }
        
        // 描画
        if (boss && boss.active) {
            drawBoss();
        } else {
            drawInvaders();
        }

        if (!isPaused) {
            checkCollisions();
            if (!boss || !boss.active) {
                checkLevelClear();
            }
        }

        drawPlayer();
        drawBullets();
        drawInvaderBullets();
        drawItems();
        drawEffects();

        drawPauseScreen(); // ポーズ中ならオーバーレイを描画
        
        // isPausedがtrueの場合、またはgameOverがtrueの場合、次のフレームの要求を停止する
        if (!gameOver && !isPaused) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }


    // --- タッチ / マウスのドラッグ操作 (指を動かした分だけ機体が動く) ---
    let dragAnchor = null;
    function handlePointerDown(e) {
        if (gameOver || isPaused || !player) return;
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        dragAnchor = { id: e.pointerId, sx: e.clientX, sy: e.clientY, px: player.x, py: player.y };
    }
    function handlePointerMove(e) {
        if (!dragAnchor || dragAnchor.id !== e.pointerId || gameOver || isPaused) return;
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        player.x = dragAnchor.px + (e.clientX - dragAnchor.sx) * (canvas.width / rect.width);
        player.y = dragAnchor.py + (e.clientY - dragAnchor.sy) * (canvas.height / rect.height);
        clampPlayer();
    }
    function handlePointerUp(e) {
        if (dragAnchor && dragAnchor.id === e.pointerId) dragAnchor = null;
    }

    // --- 格納庫 (機体選択画面) ---
    let hangarIndex = 0; // 格納庫を開くたびに使用中の機体に合わせる
    const shipCards = SHIPS.map((ship, index) => {
        const card = document.createElement('button');
        card.className = 'ship-card';
        card.innerHTML = `<canvas width="80" height="80"></canvas><span class="ship-card-label"></span>`;
        card.addEventListener('click', () => {
            hangarIndex = index;
            renderHangar();
        });
        shipGridEl.appendChild(card);
        return card;
    });

    function drawShipIcon(c, ship, locked) {
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
        const size = c.canvas.width * 0.75;
        const offset = (c.canvas.width - size) / 2;
        if (locked) {
            c.save();
            c.globalAlpha = 0.25;
            drawShip(c, ship, offset, offset, size, false);
            c.restore();
        } else {
            drawShip(c, ship, offset, offset, size, false);
        }
    }

    function renderHangar() {
        hangarCoinCountEl.textContent = save.coins;
        shipCards.forEach((card, index) => {
            const ship = SHIPS[index];
            const locked = !isUnlocked(ship);
            card.classList.toggle('locked', locked);
            card.classList.toggle('focused', index === hangarIndex);
            card.classList.toggle('equipped', ship === currentShip);
            card.classList.toggle('affordable', locked && save.coins >= ship.cost);
            card.querySelector('.ship-card-label').innerHTML = locked
                ? `<i class="coin-icon"></i>${ship.cost}`
                : ship.name;
            drawShipIcon(card.querySelector('canvas').getContext('2d'), ship, locked);
        });

        const ship = SHIPS[hangarIndex];
        const locked = !isUnlocked(ship);
        const previewCtx = shipPreviewCanvas.getContext('2d');
        drawShipIcon(previewCtx, ship, false);
        shipNameEl.textContent = ship.name;
        shipDescEl.textContent = ship.desc;
        shipStatsEl.innerHTML = ['SPD', 'POW', 'DEF'].map((label, i) =>
            `<div class="stat-row"><span>${label}</span><span class="pips">${'<i class="on"></i>'.repeat(ship.rating[i])}${'<i></i>'.repeat(5 - ship.rating[i])}</span></div>`
        ).join('');

        launchButton.disabled = false;
        launchButton.classList.toggle('unlock', locked);
        if (!locked) {
            launchButton.textContent = 'LAUNCH';
        } else if (save.coins >= ship.cost) {
            launchButton.innerHTML = `UNLOCK <i class="coin-icon"></i>${ship.cost}`;
        } else {
            launchButton.innerHTML = `NEED <i class="coin-icon"></i>${ship.cost}`;
            launchButton.disabled = true;
        }
    }

    function openHangar() {
        cancelAnimationFrame(animationFrameId);
        isHangarOpen = true;
        hangarIndex = Math.max(0, SHIPS.indexOf(currentShip));
        messageContainer.classList.add('hidden');
        gameInfoEl.classList.add('hidden');
        canvas.classList.add('hidden');
        hangarEl.classList.remove('hidden');
        renderHangar();
    }

    // 解放済みなら出撃、未解放ならコインを払って解放
    function handleLaunch() {
        const ship = SHIPS[hangarIndex];
        if (!isUnlocked(ship)) {
            if (save.coins < ship.cost) return;
            save.coins -= ship.cost;
            save.unlocked.push(ship.id);
            persist();
            playSound(sounds.levelClear);
            renderHangar();
            return;
        }
        currentShip = ship;
        save.selected = ship.id;
        persist();
        startGame();
    }

    // --- イベントリスナー ---
    function startGame() {
        sounds.bgm.pause();
        sounds.bgm.currentTime = 0;
        sounds.bgm.play().catch(e => console.error("BGM play failed on start:", e));
        init();
    }

    // ローディング画面からの開始イベントで格納庫へ
    document.addEventListener('start-game-event', openHangar);

    restartButton.addEventListener('click', startGame);
    hangarButton.addEventListener('click', openHangar);
    launchButton.addEventListener('click', handleLaunch);
    pauseButton.addEventListener('click', () => { togglePause(); pauseButton.blur(); });
    pauseButton.addEventListener('touchstart', (e) => { e.preventDefault(); togglePause(); });

    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        if (isHangarOpen) {
            const moves = { arrowleft: -1, arrowright: 1, arrowup: -5, arrowdown: 5 };
            if (key in moves) {
                e.preventDefault();
                hangarIndex = (hangarIndex + moves[key] + SHIPS.length) % SHIPS.length;
                renderHangar();
            } else if (key === 'enter') {
                e.preventDefault();
                handleLaunch();
            }
            return;
        }
        if (key === 'enter' && gameOver && !messageContainer.classList.contains('hidden')) {
            e.preventDefault();
            startGame();
        }
        if (key in KEY_DIRECTIONS) {
            if (key.startsWith('arrow')) e.preventDefault();
            keys[KEY_DIRECTIONS[key]] = true;
        }
        if (key === 'p') {
            togglePause();
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (key in KEY_DIRECTIONS) keys[KEY_DIRECTIONS[key]] = false;
    });
    // ウィンドウからフォーカスが外れたらキーを離した扱いにする
    window.addEventListener('blur', () => { keys = { left: false, right: false, up: false, down: false }; });

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);
});
