document.addEventListener('DOMContentLoaded', () => {
    // --- UI要素の取得 ---
    const canvas = document.getElementById('gameCanvas');
    const gameContainer = document.getElementById('game-container');
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const gameInfoEl = document.getElementById('game-info');
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesDisplayEl = document.getElementById('lives-display');
    const powerupEl = document.getElementById('powerup');
    const messageContainer = document.getElementById('message-container');
    const messageTitleEl = document.getElementById('message-title');
    const messageTextEl = document.getElementById('message-text');
    const restartButton = document.getElementById('restart-button');

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
    const INVADER_BULLET_SPEED = 4;
    const INVADER_SHOOT_PROBABILITY = 0.0008;
    const ITEM_DROP_CHANCE = 0.25;
    const ITEM_SPEED = 3;
    const POWERUP_DURATION = 7000;
    const ITEM_TYPES = { SHIELD: 'SHIELD', DOUBLE_SHOT: '2-SHOT', RAPID_FIRE: 'RAPID' };

    // SVG Paths (変更なし)
    const WING_LEFT_PATH = new Path2D("M 14 20 L 2 28 L 2 36 L 14 32 Z");
    const WING_RIGHT_PATH = new Path2D("M 26 20 L 38 28 L 38 36 L 26 32 Z");
    const POD_LEFT_PATH = new Path2D("M 7 15 L 4 25 L 4 35 L 10 35 L 10 25 Z");
    const POD_RIGHT_PATH = new Path2D("M 33 15 L 30 25 L 30 35 L 36 35 L 36 25 Z");
    const FUSELAGE_PATH = new Path2D(`M 20 0 Q 25 10 25 25 L 25 35 L 28 38 L 22 40 L 20 38 L 18 40 L 12 38 L 15 35 L 15 25 Q 15 10 20 0 Z`);
    const COCKPIT_PATH = new Path2D("M 20 10 Q 22 15 22 20 L 18 20 Q 18 15 20 10 Z");
    const INVADER_PATH_1 = new Path2D("M2 8 L2 20 L6 20 L6 24 L24 24 L24 20 L28 20 L28 8 L24 8 L24 4 L20 4 L20 0 L10 0 L10 4 L6 4 L6 8 Z M8 12 L12 12 L12 16 L8 16 Z M18 12 L22 12 L22 16 L18 16 Z");
    const INVADER_PATH_2 = new Path2D("M8 0 L22 0 L22 4 L26 4 L26 8 L30 8 L30 20 L26 20 L26 24 L22 24 L22 20 L18 20 L18 16 L12 16 L12 20 L8 20 L8 24 L4 24 L4 20 L0 20 L0 8 L4 8 L4 4 L8 4 Z M8 8 L12 8 L12 12 L8 12 Z M18 8 L22 8 L22 12 L18 12 Z");

    // ゲーム状態
    let ctx, player, bullets, invaderBullets, items, invaders, score, level, gameOver, lastShotTime, invaderDirection, invaderSpeed, animationFrameId;
    let keys = { ArrowLeft: false, ArrowRight: false, ' ': false };

    // ゲーム初期化
    function init() {
        ctx = canvas.getContext('2d');
        player = {
            x: canvas.width / 2 - PLAYER_WIDTH / 2,
            y: canvas.height - PLAYER_HEIGHT - 30,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
            speed: PLAYER_SPEED,
            powerUp: '---',
            powerUpTimer: null,
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
        startScreen.classList.add('hidden');
        gameInfoEl.classList.remove('hidden');
        canvas.classList.remove('hidden');

        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        gameLoop();
    }

    // レベル設定 (変更なし)
    function setupLevel() {
        invaders = [];
        for (let c = 0; c < INVADER_COLS; c++) {
            invaders[c] = [];
            for (let r = 0; r < INVADER_ROWS; r++) {
                invaders[c][r] = {
                    x: c * (INVADER_WIDTH + INVADER_PADDING) + INVADER_OFFSET_LEFT,
                    y: r * (INVADER_HEIGHT + INVADER_PADDING) + INVADER_OFFSET_TOP,
                    width: INVADER_WIDTH,
                    height: INVADER_HEIGHT,
                    status: 1
                };
            }
        }
        invaderDirection = 1;
        invaderSpeed = 0.5 + (level - 1) * 0.25;
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
        bullets = [];
        invaderBullets = [];
        items = [];
    }

    // UI更新 (変更なし)
    function updateUI() {
        scoreEl.textContent = score;
        levelEl.textContent = level;
        livesDisplayEl.textContent = '●'.repeat(player.lives > 0 ? player.lives : 0);
        let powerUpDisplay = '---';
        switch (player.powerUp) {
            case ITEM_TYPES.SHIELD: powerUpDisplay = 'S'; break;
            case ITEM_TYPES.DOUBLE_SHOT: powerUpDisplay = 'D'; break;
            case ITEM_TYPES.RAPID_FIRE: powerUpDisplay = 'R'; break;
        }
        powerupEl.textContent = powerUpDisplay;
    }

    // --- 描画関数群 (変更なし) ---
    function drawPlayer() {
        if (player.invincible && Math.floor(Date.now() / 100) % 2 === 0) return;
        ctx.save();
        ctx.translate(player.x, player.y);
        ctx.scale(player.width / 40, player.height / 40);
        if (player.powerUp === ITEM_TYPES.SHIELD) {
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
        const toggle = Math.floor(Date.now() / 500) % 2 === 0;
        const currentPath = toggle ? INVADER_PATH_1 : INVADER_PATH_2;
        invaders.forEach(column => {
            column.forEach(invader => {
                if (invader.status === 1) {
                    ctx.save();
                    ctx.translate(invader.x, invader.y);
                    ctx.scale(invader.width / 30, invader.height / 24);
                    ctx.fillStyle = '#f00';
                    ctx.shadowColor = '#f00';
                    ctx.shadowBlur = 5;
                    ctx.fill(currentPath);
                    ctx.restore();
                }
            });
        });
    }

    // --- ゲームロジック関数群 (変更なし) ---
    function movePlayer() {
        if (keys.ArrowLeft && player.x > 0) player.x -= player.speed;
        if (keys.ArrowRight && player.x < canvas.width - player.width) player.x += player.speed;
    }
    function shoot() {
        if (keys[' ']) {
            const currentTime = Date.now();
            const currentCooldown = player.powerUp === ITEM_TYPES.RAPID_FIRE ? BULLET_COOLDOWN / 2 : BULLET_COOLDOWN;
            if (currentTime - lastShotTime > currentCooldown) {
                if (player.powerUp === ITEM_TYPES.DOUBLE_SHOT) {
                    bullets.push({ x: player.x, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
                    bullets.push({ x: player.x + player.width - 5, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
                } else {
                    bullets.push({ x: player.x + player.width / 2 - 2.5, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
                }
                lastShotTime = currentTime;
                playSound(sounds.shoot);
            }
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
            invaderBullets[i].y += invaderBullets[i].speed;
            if (invaderBullets[i].y > canvas.height) invaderBullets.splice(i, 1);
        }
    }
    function moveItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            items[i].y += items[i].speed;
            if (items[i].y > canvas.height) items.splice(i, 1);
        }
    }
    function invaderShoot() {
        invaders.forEach(column => {
            column.forEach(invader => {
                if (invader.status === 1 && Math.random() < INVADER_SHOOT_PROBABILITY * level) {
                    invaderBullets.push({ x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height, width: 4, height: 8, speed: INVADER_BULLET_SPEED });
                }
            });
        });
    }
    function moveInvaders() {
        let edgeReached = false;
        for (const column of invaders) {
            for (const invader of column) {
                if (invader.status === 1) {
                    invader.x += invaderSpeed * invaderDirection;
                    if (invader.x + invader.width > canvas.width || invader.x < 0) edgeReached = true;
                    if (invader.y + invader.height > player.y) {
                        endGame(false);
                        return;
                    }
                }
            }
        }
        if (edgeReached) {
            invaderDirection *= -1;
            invaders.forEach(column => column.forEach(invader => invader.y += INVADER_HEIGHT / 2));
        }
    }
    function checkCollisions() {
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
                            const itemTypesArray = Object.values(ITEM_TYPES);
                            const randomType = itemTypesArray[Math.floor(Math.random() * itemTypesArray.length)];
                            items.push({ x: invader.x + invader.width / 2 - 10, y: invader.y, width: 20, height: 20, speed: ITEM_SPEED, type: randomType });
                        }
                        return;
                    }
                }
            }
        }
        for (let i = invaderBullets.length - 1; i >= 0; i--) {
            const bullet = invaderBullets[i];
            if (bullet.x > player.x && bullet.x < player.x + player.width && bullet.y > player.y && bullet.y < player.y + player.height) {
                invaderBullets.splice(i, 1);
                if (player.invincible) return;
                if (player.powerUp === ITEM_TYPES.SHIELD) {
                    activatePowerUp('---');
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
                playSound(sounds.itemGet);
                activatePowerUp(item.type);
                return;
            }
        }
    }
    function checkLevelClear() {
        const allDead = invaders.every(column => column.every(invader => invader.status === 0));
        if (allDead) {
            playSound(sounds.levelClear);
            if (level === MAX_LEVEL) {
                endGame(true);
            } else {
                level++;
                updateUI();
                setupLevel();
            }
        }
    }
    function activateInvincibility() {
        player.invincible = true;
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        player.invincibleTimer = setTimeout(() => { player.invincible = false; }, 1500);
    }
    function activatePowerUp(type) {
        player.powerUp = type;
        updateUI();
        if (player.powerUpTimer) clearTimeout(player.powerUpTimer);
        if (type !== '---') {
            player.powerUpTimer = setTimeout(() => activatePowerUp('---'), POWERUP_DURATION);
        }
    }

    // ゲーム終了
    function endGame(isWin) {
        sounds.bgm.pause();
        gameOver = true;
        if (player.powerUpTimer) clearTimeout(player.powerUpTimer);
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        cancelAnimationFrame(animationFrameId);

        gameInfoEl.classList.add('hidden');
        canvas.classList.add('hidden');

        if (isWin) {
            messageTitleEl.textContent = 'GAME CLEAR!';
            messageTextEl.textContent = `CONGRATULATIONS! YOUR SCORE: ${score}`;
        } else {
            playSound(sounds.gameOver);
            messageTitleEl.textContent = 'GAME OVER';
            messageTextEl.textContent = `YOUR SCORE: ${score}`;
        }
        messageContainer.classList.remove('hidden');
    }

    // ゲームループ
    function gameLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        movePlayer();
        shoot();
        invaderShoot();
        moveBullets();
        moveInvaderBullets();
        moveItems();
        moveInvaders();
        checkCollisions();
        checkLevelClear();
        drawPlayer();
        drawBullets();
        drawInvaderBullets();
        drawInvaders();
        drawItems();
        if (!gameOver) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    // --- タッチ操作ハンドラ (変更なし) ---
    function handleTouch(e) {
        if (gameOver || !startScreen.classList.contains('hidden')) {
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

    startButton.addEventListener('click', startGame);
    startButton.addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); });
    restartButton.addEventListener('click', init);
    restartButton.addEventListener('touchstart', (e) => { e.preventDefault(); init(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (!startScreen.classList.contains('hidden')) {
                startGame();
            } else if (gameOver) {
                init();
            }
        }
        if (e.key in keys) {
            keys[e.key] = true;
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
