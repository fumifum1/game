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
    const INVADER_ROWS = 5;
    const INVADER_COLS = 5;
    const INVADER_WIDTH = 30;
    const INVADER_HEIGHT = 24;
    const INVADER_PADDING = 10;
    const INVADER_OFFSET_TOP = 50;
    const INVADER_OFFSET_LEFT = (canvas.width - (INVADER_COLS * (INVADER_WIDTH + INVADER_PADDING))) / 2;
    const MAX_LEVEL = 10;
    const BOSS_START_HP = 200;
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

    // インベーダーの種類
    const INVADER_TYPES = {
        NORMAL: { color: '#f00', pathIndex: 0 },
        RAPID:  { color: '#f0f', pathIndex: 0 }, // 弾を2連射
        SPREAD: { color: '#0f0', pathIndex: 0 }, // 3方向拡散弾
        DIVE:   { color: '#0ff', pathIndex: 1 }, // 3方向拡散弾 (旧DIVEグラフィック)
    };
    const INVADER_PATH_1 = new Path2D("M2 8 L2 20 L6 20 L6 24 L24 24 L24 20 L28 20 L28 8 L24 8 L24 4 L20 4 L20 0 L10 0 L10 4 L6 4 L6 8 Z M8 12 L12 12 L12 16 L8 16 Z M18 12 L22 12 L22 16 L18 16 Z");
    const INVADER_PATH_2 = new Path2D("M8 0 L22 0 L22 4 L26 4 L26 8 L30 8 L30 20 L26 20 L26 24 L22 24 L22 20 L18 20 L18 16 L12 16 L12 20 L8 20 L8 24 L4 24 L4 20 L0 20 L0 8 L4 8 L4 4 L8 4 Z M8 8 L12 8 L12 12 L8 12 Z M18 8 L22 8 L22 12 L18 12 Z");
    const INVADER_PATH_3 = new Path2D("M15 0 L25 10 L25 18 L20 24 L10 24 L5 18 L5 10 Z M15 4 L21 10 L18 13 L12 13 L9 10 Z");
    const INVADER_PATHS = [
        [INVADER_PATH_1, INVADER_PATH_2], // NORMAL, RAPID, SPREAD用
        [INVADER_PATH_3, INVADER_PATH_3]  // DIVE用 (レベル7以降の最上段)
    ];

    // Boss Image
    const bossImage = new Image();
    bossImage.src = 'images/Boss.png';

    // ゲーム状態
    let ctx, player, bullets, invaderBullets, items, invaders, score, level, gameOver, lastShotTime, invaderDirection, invaderSpeed, animationFrameId, boss, isPaused;
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

    // レベル設定
    function setupLevel() {
        if (level === MAX_LEVEL) { // レベル10はボス戦なので何もしない
            setupBossFight();
            return;
        }

        invaders = [];
        for (let c = 0; c < INVADER_COLS; c++) {
            invaders[c] = [];
            for (let r = 0; r < INVADER_ROWS; r++) {
                let type = 'NORMAL';
                if (level >= 7 && r === 0) { // レベル7から最上段はDIVEタイプ
                    type = 'DIVE';
                } else if (level >= 5 && r === 0) { // 最上段はSPREADタイプ
                    type = 'SPREAD';
                } else if (level >= 3 && r === 1) { // 2段目はRAPIDタイプ
                    type = 'RAPID';
                }

                invaders[c][r] = {
                    x: c * (INVADER_WIDTH + INVADER_PADDING) + INVADER_OFFSET_LEFT,
                    y: r * (INVADER_HEIGHT + INVADER_PADDING) + INVADER_OFFSET_TOP,
                    width: INVADER_WIDTH,
                    height: INVADER_HEIGHT,
                    status: 1, // 1: 生存, 0: 死亡
                    type: type
                };
            }
        }
        invaderDirection = 1;
        invaderSpeed = 0.5 + (level - 1) * 0.25;
        if (invaderSpeed > 3) invaderSpeed = 3; // スピード上限
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
        player.y = DEFENSE_LINE;
        bullets = [];
        invaderBullets = [];
        items = [];
    }

    // ボス戦設定
    function setupBossFight() {
        invaders = []; // 通常の敵はクリア
        items = [];
        bullets = [];
        invaderBullets = [];

        const bossWidth = 200;
        let bossHeight = 160; // デフォルトの高さ
        // 画像が読み込み済みであれば、アスペクト比を維持して高さを計算
        if (bossImage.complete && bossImage.naturalWidth > 0) {
            const aspectRatio = bossImage.naturalHeight / bossImage.naturalWidth;
            bossHeight = bossWidth * aspectRatio;
        }

        boss = {
            x: canvas.width / 2 - bossWidth / 2,
            y: -bossHeight, // 画面上部から登場
            width: bossWidth,
            height: bossHeight,
            speed: 1.5,
            direction: 1,
            hp: BOSS_START_HP,
            maxHp: BOSS_START_HP,
            active: true,
            pattern: 'spread',
            patternTimer: Date.now(),
            shootCooldown: 0,
        };
    }
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
        ctx.fillStyle = '#f5a';
        ctx.shadowColor = '#f5a';
        ctx.shadowBlur = 5;
        invaderBullets.forEach(bullet => ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height));
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
        const animToggle = Math.floor(Date.now() / 500) % 2 === 0;
        invaders.forEach(column => {
            column.forEach(invader => {
                if (invader.status === 1) { // 生存中のみ
                    const invaderDef = INVADER_TYPES[invader.type];
                    const pathSet = INVADER_PATHS[invaderDef.pathIndex];
                    const currentPath = animToggle ? pathSet[0] : pathSet[1];

                    ctx.save();
                    ctx.translate(invader.x, invader.y);
                    ctx.scale(invader.width / 30, invader.height / 24);
                    ctx.fillStyle = invaderDef.color;
                    ctx.shadowColor = invaderDef.color;
                    ctx.shadowBlur = 5;
                    ctx.fill(currentPath);
                    ctx.restore();
                }
            });
        });
    }
    function drawBoss() {
        if (!boss || !boss.active) return;

        ctx.save();
        // ボス画像が読み込み済みの場合のみ描画
        if (bossImage.complete) {
            ctx.shadowColor = '#a0f';
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
        invaders.forEach(column => column.forEach(inv => {
            if (inv.status !== 1) return;
            const tx = inv.x + inv.width / 2, ty = inv.y + inv.height / 2;
            const dist = Math.hypot(tx - bullet.x, ty - bullet.y);
            if (dist < bestDist) { bestDist = dist; best = { x: tx, y: ty }; }
        }));
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
        invaders.forEach(column => {
            column.forEach(invader => {
                if (invader.status !== 1) return; // 編隊にいる敵だけが対象

                const shootChance = INVADER_SHOOT_PROBABILITY * (1 + level * 0.5);
                if (Math.random() < shootChance) {
                    if (invader.type === 'RAPID') {
                        // 2連射
                        invaderBullets.push({
                            x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height,
                            width: 4, height: 8, speed: INVADER_BULLET_SPEED,
                            dx: 0, dy: INVADER_BULLET_SPEED
                        });
                        setTimeout(() => {
                            // インベーダーがまだ生きていれば2発目を発射
                            if (invader.status === 1) {
                                invaderBullets.push({
                                    x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height,
                                    width: 4, height: 8, speed: INVADER_BULLET_SPEED,
                                    dx: 0, dy: INVADER_BULLET_SPEED
                                });
                            }
                        }, 150);
                    } else if (invader.type === 'SPREAD' || invader.type === 'DIVE') {
                        // 3方向拡散弾
                        [-1, 0, 1].forEach(dir => {
                            invaderBullets.push({
                                x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height,
                                width: 5, height: 5, speed: INVADER_BULLET_SPEED,
                                dx: dir * (INVADER_BULLET_SPEED / 2),
                                dy: INVADER_BULLET_SPEED * 0.8
                            });
                        });
                    } else if (invader.type === 'NORMAL') {
                        invaderBullets.push({
                            x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height,
                            width: 4, height: 8, speed: INVADER_BULLET_SPEED,
                            dx: 0, dy: INVADER_BULLET_SPEED
                        });
                    }
                }
            });
        });
    }
    function bossShoot() {
        if (!boss || !boss.active || boss.y < 0) return;

        const now = Date.now();

        // パターン切り替え
        if (now - boss.patternTimer > 8000) {
            const patterns = ['spread', 'snipe', 'laser'];
            boss.pattern = patterns[Math.floor(Math.random() * patterns.length)];
            boss.patternTimer = now;
            boss.shootCooldown = now + 1000; // パターン変更後少し待つ
        }

        if (now < boss.shootCooldown) return;

        switch (boss.pattern) {
            case 'spread': // 拡散弾
                boss.shootCooldown = now + 800;
                for (let i = -2; i <= 2; i++) {
                    const angle = i * (Math.PI / 12);
                    invaderBullets.push({
                        x: boss.x + boss.width / 2, y: boss.y + boss.height / 2 - 40, // 発射位置を少し上に変更
                        width: 6, height: 6, speed: INVADER_BULLET_SPEED * 1.2,
                        dx: Math.sin(angle) * INVADER_BULLET_SPEED,
                        dy: Math.cos(angle) * INVADER_BULLET_SPEED
                    });
                }
                break;
            case 'snipe': // 狙い撃ち
                boss.shootCooldown = now + 500;
                const angle = Math.atan2(player.y + player.height / 2 - (boss.y + boss.height / 2), player.x + player.width / 2 - (boss.x + boss.width / 2));
                invaderBullets.push({
                    x: boss.x + boss.width / 2, y: boss.y + boss.height / 2, // 発射位置をボスの中心に変更
                    width: 8, height: 8, speed: INVADER_BULLET_SPEED * 1.5,
                    dx: Math.cos(angle) * INVADER_BULLET_SPEED * 1.5,
                    dy: Math.sin(angle) * INVADER_BULLET_SPEED * 1.5
                });
                break;
            case 'laser':
                boss.shootCooldown = now + 3000;
                invaderBullets.push({
                    x: boss.x + boss.width / 2 - 5, y: boss.y + boss.height,
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
                boss.x += boss.speed * boss.direction;
                if (boss.x < 0 || boss.x + boss.width > canvas.width) boss.direction *= -1;
            }
            return;
        }
        let edgeReached = false;
        let isGameOver = false; // ゲームオーバーフラグをループの前に初期化

        for (const column of invaders) {
            for (const invader of column) {
                if (invader.status === 1) { // 編隊行動
                    invader.x += invaderSpeed * invaderDirection;
                    if (invader.x + invader.width > canvas.width || invader.x < 0) edgeReached = true;
                    if (invader.y + invader.height > DEFENSE_LINE)
                    isGameOver = true; // フラグを立てるだけで、ここではゲームオーバーにしない
                }
            }
        }

        // すべての敵の移動が終わった後に、フラグをチェックしてゲームオーバーを判定
        if (isGameOver) {
            endGame(false);
            return;
        }

        if (edgeReached) {
            invaderDirection *= -1;
            invaders.forEach(column => column.forEach(invader => invader.y += INVADER_HEIGHT / 2));
        }
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
        score += 10 * level;
        playSound(sounds.explosion);
        updateUI();
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
                if (boss.hp <= 0) { endGame(true); return; } // ボス撃破

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

            hitLoop:
            for (const column of invaders) {
                for (const invader of column) {
                    if (invader.status === 1 && pointInRect(bx, by, invader)) {
                        killInvader(invader);
                        if (!bullet.pierce) { // 貫通弾はそのまま進む
                            bullets.splice(i, 1);
                            break hitLoop;
                        }
                    }
                }
            }
        }

        const hitbox = playerHitbox();

        // 自機とインベーダー・ボスの体当たり (無敵中はすり抜ける)
        if (!player.invincible) {
            hitLoop:
            for (const column of invaders) {
                for (const invader of column) {
                    if (invader.status === 1 && rectsOverlap(hitbox, invader)) {
                        killInvader(invader);
                        damagePlayer(false);
                        break hitLoop; // 被弾で無敵になるので、1フレームに1体だけ
                    }
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
        const allDead = invaders.every(column => column.every(invader => invader.status === 0));
        if (allDead && !(boss && boss.active)) {
            playSound(sounds.levelClear);
            if (level < MAX_LEVEL) {
                level++;
                updateUI();
                setupLevel(); // レベル10ならボス戦の準備になる
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
            ctx.font = "40px 'Press Start 2P'";
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
