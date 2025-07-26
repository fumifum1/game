document.addEventListener('DOMContentLoaded', () => {
    // --- メニューバーの生成とセットアップ ---
    const menuContainer = document.createElement('div');
    menuContainer.id = 'menu-container';

    const menuIcon = document.createElement('div');
    menuIcon.id = 'menu-icon';
    menuIcon.innerHTML = '<span></span><span></span><span></span>';

    const menuContent = document.createElement('nav');
    menuContent.id = 'menu-content';
    menuContent.classList.add('hidden');
    // プロフィールやリンク先は未定のため、ダミーのリンクを設定
    menuContent.innerHTML = `
        <ul>
            <li><a href="#">Profile_Under construction</a></li>
            <li><a href="about.html">About</a></li>
            <li><a href="#">Other_Under construction</a></li>
        </ul>
    `;

    menuContainer.appendChild(menuIcon);
    menuContainer.appendChild(menuContent);
    document.body.prepend(menuContainer);

    // Canvasのセットアップ
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // --- UI要素 ---
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    const gameInfoEl = document.getElementById('game-info');
    const scoreEl = document.getElementById('score');
    const levelEl = document.getElementById('level');
    const livesDisplayEl = document.getElementById('lives-display');
    const powerupEl = document.getElementById('powerup');
    const messageContainer = document.getElementById('message-container'); // ゲームオーバー/クリア画面
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
    sounds.bgm.volume = 0.7; // BGMの音量を調整
    Object.values(sounds).forEach(sound => {
        if (sound !== sounds.bgm) {
            sound.volume = 0.9; // 効果音の音量を調整
        }
        // ページロード時に音声ファイルの読み込みを開始しておく
        sound.load();
    });

    // 効果音を再生するためのヘルパー関数
    const playSound = (sound) => {
        sound.currentTime = 0;
        // play()がPromiseを返すことを考慮し、エラーをコンソールに出力
        // これにより、どの音声の再生で問題が起きているか特定しやすくなる
        sound.play().catch(e => console.log("Sound play failed. User interaction might be needed.", e));
    };

    // ゲーム設定
    const LIVES_START = 3;
    const PLAYER_WIDTH = 40;
    const PLAYER_HEIGHT = 20;
    const PLAYER_SPEED = 7;
    const BULLET_SPEED = 8;
    const BULLET_COOLDOWN = 350; // ms
    const INVADER_ROWS = 5;
    const INVADER_COLS = 5;
    const INVADER_WIDTH = 30;
    const INVADER_HEIGHT = 24;
    const INVADER_PADDING = 10;
    const INVADER_OFFSET_TOP = 50;
    const INVADER_OFFSET_LEFT = (canvas.width - (INVADER_COLS * (INVADER_WIDTH + INVADER_PADDING))) / 2;
    const MAX_LEVEL = 10;
    const INVADER_BULLET_SPEED = 4;
    const INVADER_SHOOT_PROBABILITY = 0.0008; // 難易度調整：攻撃頻度を低下
    const ITEM_DROP_CHANCE = 0.25; // 25% chance
    const ITEM_SPEED = 3;
    const POWERUP_DURATION = 7000; // 7 seconds in ms
    const ITEM_TYPES = { SHIELD: 'SHIELD', DOUBLE_SHOT: '2-SHOT', RAPID_FIRE: 'RAPID' };

    // ゲーム状態
    let player, bullets, invaderBullets, items, invaders, keys, score, level, gameOver, lastShotTime, invaderDirection, invaderSpeed, animationFrameId;

    // ゲーム初期化
    function init() {
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
        keys = { ArrowLeft: false, ArrowRight: false };
        bullets = [];
        invaderBullets = [];
        items = [];
        score = 0;
        level = 1;
        gameOver = false;
        lastShotTime = 0;
        
        setupLevel();
        updateUI();

        // BGMをリセットして再生
        sounds.bgm.pause();
        sounds.bgm.currentTime = 0;
        sounds.bgm.play().catch(e => console.error("BGM play failed on start/restart:", e));

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
        invaders = [];
        for (let c = 0; c < INVADER_COLS; c++) {
            invaders[c] = [];
            for (let r = 0; r < INVADER_ROWS; r++) {
                invaders[c][r] = {
                    x: c * (INVADER_WIDTH + INVADER_PADDING) + INVADER_OFFSET_LEFT,
                    y: r * (INVADER_HEIGHT + INVADER_PADDING) + INVADER_OFFSET_TOP,
                    width: INVADER_WIDTH,
                    height: INVADER_HEIGHT,
                    status: 1 // 1: alive, 0: dead
                };
            }
        }
        invaderDirection = 1; // 1: right, -1: left
        invaderSpeed = 0.5 + (level - 1) * 0.25;
        player.x = canvas.width / 2 - PLAYER_WIDTH / 2;
        bullets = [];
        invaderBullets = [];
        items = [];
    }

    // UI更新
    function updateUI() {
        scoreEl.textContent = score;
        levelEl.textContent = level;
        livesDisplayEl.textContent = '●'.repeat(player.lives > 0 ? player.lives : 0);

        let powerUpDisplay = '---';
        switch (player.powerUp) {
            case ITEM_TYPES.SHIELD:
                powerUpDisplay = 'S';
                break;
            case ITEM_TYPES.DOUBLE_SHOT:
                powerUpDisplay = 'D';
                break;
            case ITEM_TYPES.RAPID_FIRE:
                powerUpDisplay = 'R';
                break;
        }
        powerupEl.textContent = powerUpDisplay;
    }

    // 描画関数
    function drawPlayer() {
        // 無敵時間中の点滅エフェクト
        if (player.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
            return; // 描画をスキップして点滅させる
        }

        // シールド描画
        if (player.powerUp === ITEM_TYPES.SHIELD) {
            ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.arc(player.x + player.width / 2, player.y + player.height / 2, player.width / 2 + 5, 0, Math.PI * 2);
            ctx.fill();
        }
        // 本体描画 (Wの形)
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + player.width * 0.2, player.y + player.height);
        ctx.lineTo(player.x + player.width * 0.5, player.y + player.height * 0.5);
        ctx.lineTo(player.x + player.width * 0.8, player.y + player.height);
        ctx.lineTo(player.x + player.width, player.y);
        ctx.lineTo(player.x + player.width * 0.5, player.y + player.height * 0.8);
        ctx.closePath();
        ctx.fill();
    }

    function drawBullets() {
        ctx.fillStyle = '#ff0';
        bullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });
    }

    function drawInvaderBullets() {
        ctx.fillStyle = '#f5a'; // 敵の弾はピンク
        invaderBullets.forEach(bullet => {
            ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
        });
    }

    function drawItems() {
        items.forEach(item => {
            ctx.save(); // 現在の描画スタイルを保存
            ctx.font = "bold 20px 'Press Start 2P'";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let char = '';
            switch (item.type) {
                case ITEM_TYPES.SHIELD:
                    ctx.fillStyle = '#0af'; // 水色
                    char = 'S';
                    break;
                case ITEM_TYPES.DOUBLE_SHOT:
                    ctx.fillStyle = '#f90'; // オレンジ
                    char = 'D';
                    break;
                case ITEM_TYPES.RAPID_FIRE:
                    ctx.fillStyle = '#f0f'; // 紫
                    char = 'R';
                    break;
            }
            
            if (char) {
                // 文字に影をつけて見やすくする
                ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                ctx.fillText(char, item.x + item.width / 2, item.y + item.height / 2);
            }

            ctx.restore(); // 描画スタイルを元に戻す
        });
    }

    function drawInvaders() {
        ctx.fillStyle = '#f00';
        invaders.forEach(column => {
            column.forEach(invader => {
                if (invader.status === 1) {
                    ctx.beginPath();
                    ctx.moveTo(invader.x + invader.width / 2, invader.y + invader.height);
                    ctx.lineTo(invader.x, invader.y);
                    ctx.lineTo(invader.x + invader.width, invader.y);
                    ctx.closePath();
                    ctx.fill();
                }
            });
        });
    }

    // プレイヤーの移動
    function movePlayer() {
        if (keys.ArrowLeft && player.x > 0) {
            player.x -= player.speed;
        }
        if (keys.ArrowRight && player.x < canvas.width - player.width) {
            player.x += player.speed;
        }
    }

    // 弾の発射
    function shoot() {
        const currentTime = Date.now();
        const currentCooldown = player.powerUp === ITEM_TYPES.RAPID_FIRE ? BULLET_COOLDOWN / 2 : BULLET_COOLDOWN;

        if (currentTime - lastShotTime > currentCooldown) {
            if (player.powerUp === ITEM_TYPES.DOUBLE_SHOT) {
                // ダブルショット
                bullets.push({ x: player.x, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
                bullets.push({ x: player.x + player.width - 5, y: player.y, width: 5, height: 10, speed: BULLET_SPEED });
            } else {
                // 通常弾
                bullets.push({
                    x: player.x + player.width / 2 - 2.5,
                    y: player.y,
                    width: 5,
                    height: 10,
                    speed: BULLET_SPEED
                });
            }
            lastShotTime = currentTime;
            playSound(sounds.shoot); // 修正済み
        }
    }

    // 弾の移動
    function moveBullets() {
        for (let i = bullets.length - 1; i >= 0; i--) {
            bullets[i].y -= bullets[i].speed;
            if (bullets[i].y < 0) {
                bullets.splice(i, 1);
            }
        }
    }

    // 敵の弾の移動
    function moveInvaderBullets() {
        for (let i = invaderBullets.length - 1; i >= 0; i--) {
            invaderBullets[i].y += invaderBullets[i].speed;
            if (invaderBullets[i].y > canvas.height) {
                invaderBullets.splice(i, 1);
            }
        }
    }

    // アイテムの移動
    function moveItems() {
        for (let i = items.length - 1; i >= 0; i--) {
            items[i].y += items[i].speed;
            if (items[i].y > canvas.height) {
                items.splice(i, 1);
            }
        }
    }

    // 敵の攻撃
    function invaderShoot() {
        invaders.forEach(column => {
            column.forEach(invader => {
                if (invader.status === 1 && Math.random() < INVADER_SHOOT_PROBABILITY * level) {
                    invaderBullets.push({
                        x: invader.x + invader.width / 2 - 2, y: invader.y + invader.height,
                        width: 4, height: 8, speed: INVADER_BULLET_SPEED
                    });
                }
            });
        });
    }

    // 敵の移動
    function moveInvaders() {
        let edgeReached = false;
        for (const column of invaders) {
            for (const invader of column) {
                if (invader.status === 1) {
                    invader.x += invaderSpeed * invaderDirection;
                    if (invader.x + invader.width > canvas.width || invader.x < 0) {
                        edgeReached = true;
                    }
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

    // 当たり判定
    function checkCollisions() {
        // プレイヤーの弾 vs 敵
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            for (const column of invaders) {
                for (const invader of column) {
                    if (invader.status === 1 &&
                        bullet.x > invader.x &&
                        bullet.x < invader.x + invader.width &&
                        bullet.y > invader.y &&
                        bullet.y < invader.y + invader.height) {
                        
                        invader.status = 0;
                        bullets.splice(i, 1);
                        score += 10 * level;
                        playSound(sounds.explosion);
                        updateUI();

                        // アイテムドロップ判定
                        if (Math.random() < ITEM_DROP_CHANCE) {
                            const itemTypesArray = Object.values(ITEM_TYPES);
                            const randomType = itemTypesArray[Math.floor(Math.random() * itemTypesArray.length)];
                            items.push({
                                x: invader.x + invader.width / 2 - 10,
                                y: invader.y,
                                width: 20,
                                height: 20,
                                speed: ITEM_SPEED,
                                type: randomType
                            });
                        }

                        return; // 1フレームで1つの弾が複数の敵を倒さないように
                    }
                }
            }
        }

        // 敵の弾 vs プレイヤー
        for (let i = invaderBullets.length - 1; i >= 0; i--) {
            const bullet = invaderBullets[i];
            if (bullet.x > player.x && bullet.x < player.x + player.width &&
                bullet.y > player.y && bullet.y < player.y + player.height) {
                invaderBullets.splice(i, 1);
                if (player.invincible) return; // 無敵なら何もしない

                if (player.powerUp === ITEM_TYPES.SHIELD) {
                    activatePowerUp('---'); // シールドを消費
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

        // アイテム vs プレイヤー
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.x < player.x + player.width && item.x + item.width > player.x &&
                item.y < player.y + player.height && item.y + item.height > player.y) {
                items.splice(i, 1);
                playSound(sounds.itemGet);
                activatePowerUp(item.type);
                return;
            }
        }
    }

    // レベルクリア判定
    function checkLevelClear() {
        const allDead = invaders.every(column => column.every(invader => invader.status === 0));
        if (allDead) {
            playSound(sounds.levelClear);
            if (level === MAX_LEVEL) {
                endGame(true); // ゲームクリア
            } else {
                level++;
                updateUI();
                setupLevel();
            }
        }
    }

    // 無敵状態を発動
    function activateInvincibility() {
        player.invincible = true;
        if (player.invincibleTimer) clearTimeout(player.invincibleTimer);
        player.invincibleTimer = setTimeout(() => {
            player.invincible = false;
        }, 1500); // 1.5秒間無敵
    }

    // パワーアップ発動
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

        gameInfoEl.classList.add('hidden'); // ゲーム情報を非表示に

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
        // 画面クリア
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 更新処理
        movePlayer();
        shoot();
        invaderShoot();
        moveBullets();
        moveInvaderBullets();
        moveItems();
        moveInvaders();
        checkCollisions();
        checkLevelClear();

        // 描画処理
        drawPlayer();
        drawBullets();
        drawInvaderBullets();
        drawInvaders();
        drawItems();

        // 次のフレームを要求
        if (!gameOver) {
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    // --- タッチ操作ハンドラ ---
    function handleTouch(e) {
        // ゲームオーバー中やスタート画面では操作しない
        if (gameOver || !startScreen.classList.contains('hidden')) {
            keys.ArrowLeft = false;
            keys.ArrowRight = false;
            return;
        }
        
        e.preventDefault(); // スクロールなどを防止

        if (e.touches.length > 0) {
            const touchX = e.touches[0].clientX;
            // game-containerの左端からの相対位置で計算する
            const rect = e.target.getBoundingClientRect();
            const touchXInCanvas = touchX - rect.left;
            const screenHalf = rect.width / 2;
            
            // タッチ位置に応じてキーの状態を更新
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
        // タッチが離れたら移動を停止
        keys.ArrowLeft = false;
        keys.ArrowRight = false;
    }

    // --- イベントリスナー ---

    // メニューアイコンのクリックイベント
    menuIcon.addEventListener('click', (e) => {
        e.stopPropagation(); // documentへのクリックイベントの伝播を停止
        menuContainer.classList.toggle('open');
        menuContent.classList.toggle('hidden');
    });

    // メニューの外側をクリックしたときにメニューを閉じる
    document.addEventListener('click', (e) => {
        if (!menuContainer.contains(e.target) && menuContainer.classList.contains('open')) {
            menuContainer.classList.remove('open');
            menuContent.classList.add('hidden');
        }
    });

    function startGame() {
        startScreen.classList.add('hidden');
        init();
    }
    
    // クリックとタッチの両方でボタンが反応するようにする
    startButton.addEventListener('click', startGame, { passive: false });
    startButton.addEventListener('touchstart', (e) => { e.preventDefault(); startGame(); }, { passive: false });
    restartButton.addEventListener('click', init, { passive: false });
    restartButton.addEventListener('touchstart', (e) => { e.preventDefault(); init(); }, { passive: false });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // スタート画面が表示されている場合
            if (!startScreen.classList.contains('hidden')) {
                startGame();
            }
            // ゲームオーバー/クリア画面が表示されている場合
            else if (gameOver) {
                init();
            }
        } else if (e.key in keys) {
            keys[e.key] = true;
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key in keys) keys[e.key] = false;
    });

    // ゲームキャンバスに対するタッチイベントを追加
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd); // 予期せぬタッチ終了にも対応
});