document.addEventListener('DOMContentLoaded', () => {
    // --- UI要素の取得 ---
    const canvas = document.getElementById('gameCanvas');
    const gameContainer = document.getElementById('game-container');
    const gameInfoEl = document.getElementById('game-info');
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesDisplayEl = document.getElementById('lives-display');
    const powerupEl = document.getElementById('powerup');
    const messageContainer = document.getElementById('message-container');
    const messageTitleEl = document.getElementById('message-title');
    const messageTextEl = document.getElementById('message-text');
    const restartButton = document.getElementById('restart-button');
    const pauseButton = document.getElementById('pause-button');

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
    const LIVES_START = 3;
    const PLAYER_WIDTH = 40;
    const PLAYER_HEIGHT = 40;
    const PLAYER_SPEED = 7;
    const BULLET_SPEED = 8;
    const BULLET_COOLDOWN = 350;
    const INVADER_ROWS = 5;
    const INVADER_COLS = 5;
    const INVADER_WIDTH = 30;
    const INVADER_HEIGHT = 24;
    const INVADER_PADDING = 10;
    const INVADER_OFFSET_TOP = 50;
    let INVADER_OFFSET_LEFT = (canvas.width - (INVADER_COLS * (INVADER_WIDTH + INVADER_PADDING))) / 2;
    const MAX_LEVEL = 10;
    const BOSS_START_HP = 200;
    const INVADER_BULLET_SPEED = 4;
    const INVADER_SHOOT_PROBABILITY = 0.0008;
    const ITEM_DROP_CHANCE = 0.25;
    const ITEM_SPEED = 3;
    const POWERUP_DURATION = 7000;
    const ITEM_TYPES = { SHIELD: 'SHIELD', DOUBLE_SHOT: '2-SHOT', RAPID_FIRE: 'RAPID', LIFE_UP: 'LIFE_UP' };

    // インベーダーの種類
    const INVADER_TYPES = {
        NORMAL: { color: '#f00', pathIndex: 0 },
        RAPID:  { color: '#f0f', pathIndex: 0 }, // 弾を2連射
        SPREAD: { color: '#0f0', pathIndex: 0 }, // 3方向拡散弾
        DIVE:   { color: '#0ff', pathIndex: 1 }, // 3方向拡散弾 (旧DIVEグラフィック)
    };
    // SVG Path Strings (for UI)
    const WING_LEFT_PATH_STR = "M 14 20 L 2 28 L 2 36 L 14 32 Z";
    const WING_RIGHT_PATH_STR = "M 26 20 L 38 28 L 38 36 L 26 32 Z";
    const FUSELAGE_PATH_STR = "M 20 0 Q 25 10 25 25 L 25 35 L 28 38 L 22 40 L 20 38 L 18 40 L 12 38 L 15 35 L 15 25 Q 15 10 20 0 Z";

    // Path2D objects (for canvas drawing)
    const WING_LEFT_PATH = new Path2D(WING_LEFT_PATH_STR);
    const WING_RIGHT_PATH = new Path2D(WING_RIGHT_PATH_STR);
    const FUSELAGE_PATH = new Path2D(FUSELAGE_PATH_STR);
    const POD_LEFT_PATH_STR = "M 7 15 L 4 25 L 4 35 L 10 35 L 10 25 Z";
    const POD_RIGHT_PATH_STR = "M 33 15 L 30 25 L 30 35 L 36 35 L 36 25 Z";
    const COCKPIT_PATH_STR = "M 20 10 Q 22 15 22 20 L 18 20 Q 18 15 20 10 Z";
    const POD_LEFT_PATH = new Path2D(POD_LEFT_PATH_STR);
    const POD_RIGHT_PATH = new Path2D(POD_RIGHT_PATH_STR);
    const COCKPIT_PATH = new Path2D(COCKPIT_PATH_STR);
    const INVADER_PATH_1 = new Path2D("M2 8 L2 20 L6 20 L6 24 L24 24 L24 20 L28 20 L28 8 L24 8 L24 4 L20 4 L20 0 L10 0 L10 4 L6 4 L6 8 Z M8 12 L12 12 L12 16 L8 16 Z M18 12 L22 12 L22 16 L18 16 Z");
    const INVADER_PATH_2 = new Path2D("M8 0 L22 0 L22 4 L26 4 L26 8 L30 8 L30 20 L26 20 L26 24 L22 24 L22 20 L18 20 L18 16 L12 16 L12 20 L8 20 L8 24 L4 24 L4 20 L0 20 L0 8 L4 8 L4 4 L8 4 Z M8 8 L12 8 L12 12 L8 12 Z M18 8 L22 8 L22 12 L18 12 Z");
    const INVADER_PATH_3 = new Path2D("M15 0 L25 10 L25 18 L20 24 L10 24 L5 18 L5 10 Z M15 4 L21 10 L18 13 L12 13 L9 10 Z");
    const INVADER_PATHS = [
        [INVADER_PATH_1, INVADER_PATH_2], // NORMAL, RAPID, SPREAD用
        [INVADER_PATH_3, INVADER_PATH_3]  // (旧DIVE用、現在は未使用)
    ];

    // Boss Path
    const BOSS_BASE_PATH = new Path2D("M 50 10 L 150 10 L 180 40 L 160 80 L 130 70 L 70 70 L 40 80 L 20 40 Z");
    const BOSS_TURRET_PATH = new Path2D("M 90 50 L 110 50 L 115 70 L 85 70 Z");
    const BOSS_WEAK_POINT_PATH = new Path2D("M 95 20 L 105 20 L 105 30 L 95 30 Z");

    // Boss Image
    const bossImage = new Image();
    bossImage.src = 'images/Boss.png';

    // ゲーム状態
    let ctx, player, bullets, invaderBullets, items, invaders, score, level, gameOver, lastShotTime, invaderDirection, invaderSpeed, animationFrameId, boss, isPaused;
    let keys = { ArrowLeft: false, ArrowRight: false };

    // ゲーム初期化
    function init() {
        isPaused = false;
        ctx = canvas.getContext('2d');
        boss = null; // ボスをリセット
        player = {
            x: canvas.width / 2 - PLAYER_WIDTH / 2,
            y: canvas.height - PLAYER_HEIGHT - 30,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            speed: PLAYER_SPEED,
            activePowerUps: [], // 複数のパワーアップを管理
            lives: LIVES_START,
            invincible: false,
            invincibleTimer: null,
        };
        bullets = [];
        invaderBullets = [];
        items = [];
        score = 0;
        level = 1;
        gameOver = false;
        lastShotTime = 0;

        setupLevel();
        updateUI();

        // UIの表示切り替え
        messageContainer.classList.add('hidden');
        gameInfoEl.classList.remove('hidden');
        canvas.classList.remove('hidden');

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
    // UI更新 (変更なし)
    function updateUI() {
        scoreEl.textContent = score;
        levelEl.textContent = `LV${level}`;

        livesDisplayEl.innerHTML = ''; // ライフ表示をクリア
        const livesCount = player.lives > 0 ? player.lives : 0;
        for (let i = 0; i < livesCount; i++) {
            const svgIcon = `
                <svg width="20" height="20" viewBox="0 0 40 40" style="margin: 0 2px; vertical-align: middle;">
                    <path d="${WING_LEFT_PATH_STR}" fill="#00aa00"></path>
                    <path d="${WING_RIGHT_PATH_STR}" fill="#00aa00"></path>
                    <path d="${FUSELAGE_PATH_STR}" fill="#0f0"></path>
                </svg>
            `;
            livesDisplayEl.innerHTML += svgIcon;
        }

        const powerUpTexts = player.activePowerUps.map(p => {
            switch (p.type) {
                case ITEM_TYPES.SHIELD: return 'S';
                case ITEM_TYPES.DOUBLE_SHOT: return 'D';
                case ITEM_TYPES.RAPID_FIRE: return 'R';
                default: return '';
            }
        });
        powerupEl.textContent = powerUpTexts.length > 0 ? powerUpTexts.join(' ') : '---';
    }

    // --- 描画関数群 (変更なし) ---
    function drawPlayer() {
        if (player.invincible && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.scale(player.width / 40, player.height / 40);
        const hasShield = player.activePowerUps.some(p => p.type === ITEM_TYPES.SHIELD);
        if (hasShield) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(20, 20, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.fillStyle = '#00aa00';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 5;
        ctx.fill(WING_LEFT_PATH);
        ctx.fill(WING_RIGHT_PATH);
        ctx.fillStyle = '#ccc';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 2;
        ctx.fill(POD_LEFT_PATH);
        ctx.fill(POD_RIGHT_PATH);
        ctx.fillStyle = '#0f0';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 10;
        ctx.fill(FUSELAGE_PATH);
        ctx.fillStyle = '#aff';
        ctx.shadowColor = '#aff';
        ctx.shadowBlur = 5;
        ctx.fill(COCKPIT_PATH);
        ctx.fillStyle = '#ff0';
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.rect(18, 38, 4, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.rect(4, 35, 2, 3);
        ctx.rect(34, 35, 2, 3);
        ctx.fill();
        ctx.restore();
    }
    function drawBullets() {
        ctx.save();
        ctx.fillStyle = '#ff0';
        ctx.shadowColor = '#ff0';
        ctx.shadowBlur = 5;
        bullets.forEach(bullet => ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height));
        ctx.restore();
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
        if (gameOver) return;
        isPaused = !isPaused;
        if (isPaused) {
            sounds.bgm.pause();
            pauseButton.textContent = '▶'; // 再開アイコン
            // ポーズした瞬間にオーバーレイを描画
            drawPauseScreen();
        } else {
            sounds.bgm.play().catch(e => console.error("BGM play failed on resume:", e));
            pauseButton.textContent = '❚❚'; // 一時停止アイコン
            // ゲームループを再開
            gameLoop();
        }
    }

    function movePlayer() {
        if (keys.ArrowLeft && player.x > 0) player.x -= player.speed;
        if (keys.ArrowRight && player.x < canvas.width - player.width) player.x += player.speed;
    }
    function shoot() {
        const currentTime = Date.now();
        const hasRapid = player.activePowerUps.some(p => p.type === ITEM_TYPES.RAPID_FIRE);
        const hasDouble = player.activePowerUps.some(p => p.type === ITEM_TYPES.DOUBLE_SHOT);
        const currentCooldown = hasRapid ? BULLET_COOLDOWN / 2 : BULLET_COOLDOWN;
        if (currentTime - lastShotTime > currentCooldown) {
            if (hasDouble) {
                bullets.push({ x: player.x, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
                bullets.push({ x: player.x + player.width - 5, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
            } else {
                bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
            }
            lastShotTime = currentTime;
            playSound(sounds.shoot);
        }
    }

    function moveBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].y -= bullets[i].speed;
            if (bullets[i].y < 0) bullets.splice(i, 1);
        }
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
        for (let i = items.length - 1; i >= 0; i--) {
            items[i].y += items[i].speed;
            if (items[i].y > canvas.height) items.splice(i, 1);
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
                const angle = Math.atan2(player.y - (boss.y + boss.height / 2), player.x - (boss.x + boss.width / 2));
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
                    if (invader.y + invader.height > player.y)
                    isGameOver = true; // フラグを立てるだけで、ここではゲームオーバーにしない
                }
            }
        }

        // すべての敵の移動が終わった後に、フラグをチェックしてゲームオーバーを判定
        if (isGameOver) {
            console.log("Invaders reached player line. Game Over.");
            endGame(false);
            return;
        }

        if (edgeReached) {
            invaderDirection *= -1;
            invaders.forEach(column => column.forEach(invader => invader.y += INVADER_HEIGHT / 2));
        }
    }
    function checkCollisions() {
        // プレイヤーの弾とボスの衝突判定
        if (boss && boss.active) {
            for (let i = bullets.length - 1; i >= 0; i--) {
                const bullet = bullets[i];
                if (bullet.x > boss.x && bullet.x < boss.x + boss.width && bullet.y > boss.y && bullet.y < boss.y + boss.height) {
                    bullets.splice(i, 1);
                    boss.hp--;
                    score += 50;
                    if (boss.hp <= 0) endGame(true); // ボス撃破

                    // ボスヒット時に低確率でアイテムをドロップ
                    if (Math.random() < 0.05) { // 5%の確率
                        let itemType;
                        if (Math.random() < 0.25) { // ライフアップはさらに低確率(全体の約1.25%)
                            itemType = ITEM_TYPES.LIFE_UP;
                        } else {
                            const powerUpTypes = [ITEM_TYPES.SHIELD, ITEM_TYPES.DOUBLE_SHOT, ITEM_TYPES.RAPID_FIRE];
                            itemType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                        }
                        items.push({ x: bullet.x - 10, y: bullet.y, width: 20, height: 20, speed: ITEM_SPEED, type: itemType });
                    }
                }
            }
        }
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            for (const column of invaders) {
                for (const invader of column) {
                    if (invader.status === 1 && bullet.x > invader.x && bullet.x < invader.x + invader.width && bullet.y > invader.y && bullet.y < invader.y + invader.height) {
                        invader.status = 0;
                        bullets.splice(i, 1);
                        score += 10 * level;
                        playSound(sounds.explosion);
                        updateUI();
                        if (Math.random() < ITEM_DROP_CHANCE) {
                            let itemType;
                            // レベル5以上で、20%の確率でライフアップアイテムが出現
                            if (level >= 5 && Math.random() < 0.2) {
                                itemType = ITEM_TYPES.LIFE_UP;
                            } else {
                                const powerUpTypes = [ITEM_TYPES.SHIELD, ITEM_TYPES.DOUBLE_SHOT, ITEM_TYPES.RAPID_FIRE];
                                itemType = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                            }
                            items.push({ x: invader.x + invader.width / 2 - 10, y: invader.y, width: 20, height: 20, speed: ITEM_SPEED, type: itemType });
                        }
                        return;
                    }
                }
            }
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
                const laserX = bullet.x;
                const laserWidth = bullet.width;
                if (player.x < laserX + laserWidth && player.x + player.width > laserX) {
                    // 当たり判定
                    const hasShield = player.activePowerUps.some(p => p.type === ITEM_TYPES.SHIELD);
                    if (!player.invincible && !hasShield) {
                        player.lives = 0; // レーザーは即死
                        endGame(false);
                    }
                }
                continue; // 通常の弾の処理はスキップ
            }

            if (bullet.x > player.x && bullet.x < player.x + player.width && bullet.y > player.y && bullet.y < player.y + player.height) {
                invaderBullets.splice(i, 1);
                if (player.invincible) return;
                const hasShield = player.activePowerUps.some(p => p.type === ITEM_TYPES.SHIELD);
                if (hasShield) {
                    removePowerUp(ITEM_TYPES.SHIELD);
                } else {
                    playSound(sounds.playerHit);
                    player.lives--;
                    updateUI();
                    if (player.lives <= 0) {
                        endGame(false);
                    } else {
                        activateInvincibility();
                    }
                }
                return;
            }
        }
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.x < player.x + player.width && item.x + item.width > player.x && item.y < player.y + player.height && item.y + item.height > player.y) {
                items.splice(i, 1);
                score += 100;
                updateUI();
                playSound(sounds.itemGet);
                if (item.type === ITEM_TYPES.LIFE_UP) {
                    if (player.lives < 6) { // ライフ上限を6に設定
                        player.lives++;
                        updateUI();
                    }
                } else {
                    addPowerUp(item.type);
                }
                return;
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
                // レベル9クリア後はボス戦へ
                if (level === MAX_LEVEL) setupBossFight();
                setupLevel();
            }
        }
    }
    function activateInvincibility() {
        player.invincible = true;
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        player.invincibleTimer = setTimeout(() => { player.invincible = false; }, 1500);
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
        sounds.bgm.pause();
        gameOver = true;
        player.activePowerUps.forEach(p => clearTimeout(p.timer));
        player.activePowerUps = [];
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        cancelAnimationFrame(animationFrameId);

        if (isWin) {
            startEndingSequence();
        } else {
            gameInfoEl.classList.add('hidden');
            canvas.classList.add('hidden');
            playSound(sounds.gameOver);
            messageTitleEl.textContent = 'GAME OVER';
            messageTextEl.textContent = `YOUR SCORE: ${score}`;
            messageContainer.classList.remove('hidden');
        }
    }

    let endingStartTime = 0;

    function startEndingSequence() {
        endingStartTime = Date.now();
        
        // エンディング用にプレイヤーとボスを再配置//
        player.x = canvas.width / 2 - player.width / 2;
        player.y = canvas.height - player.height - 30;
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
                 bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
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

        drawPauseScreen(); // ポーズ中ならオーバーレイを描画
        
        // isPausedがtrueの場合、またはgameOverがtrueの場合、次のフレームの要求を停止する
        if (!gameOver && !isPaused) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }


    // --- タッチ操作ハンドラ (変更なし) ---
    function handleTouch(e) {
        if (gameOver) {
            keys.ArrowLeft = false;
            keys.ArrowRight = false;
            return;
        }
        e.preventDefault();
        if (e.touches.length > 0) {
            const touchX = e.touches[0].clientX;
            const rect = e.target.getBoundingClientRect();
            const touchXInCanvas = touchX - rect.left;
            const screenHalf = rect.width / 2;
            if (touchXInCanvas < screenHalf) {
                keys.ArrowLeft = true;
                keys.ArrowRight = false;
            } else {
                keys.ArrowRight = true;
                keys.ArrowLeft = false;
            }
        }
    }
    function handleTouchEnd(e) {
        keys.ArrowLeft = false;
        keys.ArrowRight = false;
    }

    // --- イベントリスナー ---
    function startGame() {
        sounds.bgm.pause();
        sounds.bgm.currentTime = 0;
        sounds.bgm.play().catch(e => console.error("BGM play failed on start:", e));
        init();
    }

    // ローディング画面からの開始イベントをリッスン
    document.addEventListener('start-game-event', startGame);

    restartButton.addEventListener('click', init);
    restartButton.addEventListener('touchstart', (e) => { e.preventDefault(); init(); });
    pauseButton.addEventListener('click', togglePause);
    pauseButton.addEventListener('touchstart', (e) => { e.preventDefault(); togglePause(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (gameOver) {
                init();
            }
        }
        if (e.key in keys) {
            keys[e.key] = true;
        }
        if (e.key.toLowerCase() === 'p') {
            togglePause();
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key in keys) keys[e.key] = false;
    });

    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
});
