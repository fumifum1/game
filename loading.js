document.addEventListener('DOMContentLoaded', () => {
    const loadingScreen = document.getElementById('loading-screen');
    const shipContainer = document.getElementById('loading-ship-container');
    const shipCanvas = document.getElementById('loading-ship-canvas');
    const shipCtx = shipCanvas.getContext('2d');
    const titleChars = document.querySelectorAll('.title-char');
    const messageContainer = document.getElementById('loading-message');
    const playButton = document.getElementById('loading-play-btn');

    // script.jsから戦闘機のSVGパス定義をコピー
    const WING_LEFT_PATH_STR = "M 14 20 L 2 28 L 2 36 L 14 32 Z";
    const WING_RIGHT_PATH_STR = "M 26 20 L 38 28 L 38 36 L 26 32 Z";
    const FUSELAGE_PATH_STR = "M 20 0 Q 25 10 25 25 L 25 35 L 28 38 L 22 40 L 20 38 L 18 40 L 12 38 L 15 35 L 15 25 Q 15 10 20 0 Z";
    const POD_LEFT_PATH_STR = "M 7 15 L 4 25 L 4 35 L 10 35 L 10 25 Z";
    const POD_RIGHT_PATH_STR = "M 33 15 L 30 25 L 30 35 L 36 35 L 36 25 Z";
    const COCKPIT_PATH_STR = "M 20 10 Q 22 15 22 20 L 18 20 Q 18 15 20 10 Z";

    // Path2Dオブジェクトを作成
    const WING_LEFT_PATH = new Path2D(WING_LEFT_PATH_STR);
    const WING_RIGHT_PATH = new Path2D(WING_RIGHT_PATH_STR);
    const FUSELAGE_PATH = new Path2D(FUSELAGE_PATH_STR);
    const POD_LEFT_PATH = new Path2D(POD_LEFT_PATH_STR);
    const POD_RIGHT_PATH = new Path2D(POD_RIGHT_PATH_STR);
    const COCKPIT_PATH = new Path2D(COCKPIT_PATH_STR);

    let destroyedCount = 0;
    let isGameStarted = false;
    let animationFrameId;

    // 戦闘機の動きと発射のループ
    function updateLoadingLoop() {
        if (isGameStarted) return; // ゲーム開始ボタンが押されたら停止

        const time = Date.now() / 1000;
        
        // タイトルの幅を取得して移動範囲を制限
        let minLeft = window.innerWidth;
        let maxRight = 0;
        titleChars.forEach(char => {
            const rect = char.getBoundingClientRect();
            if (rect.left < minLeft) minLeft = rect.left;
            if (rect.right > maxRight) maxRight = rect.right;
        });
        let titleWidth = maxRight - minLeft;
        if (titleWidth < 0) titleWidth = window.innerWidth * 0.6; // フォールバック

        const amplitude = ((titleWidth / 2 + 20) / window.innerWidth) * 100;

        // 左右に移動 (タイトル幅に合わせて、速度も少しアップ)
        const x = 50 + Math.sin(time * 3) * amplitude; 
        shipContainer.style.left = `${x}%`;

        // 一定確率でミサイル発射
        if (Math.random() < 0.05) {
            shootMissile();
        }

        animationFrameId = requestAnimationFrame(updateLoadingLoop);
    }

    // ミサイル発射処理
    function shootMissile() {
        const missile = document.createElement('div');
        missile.className = 'loading-missile';
        
        const shipRect = shipContainer.getBoundingClientRect();
        // ミサイルの初期位置（戦闘機の中央上部）
        missile.style.left = `${shipRect.left + shipRect.width / 2 - 2}px`;
        missile.style.top = `${shipRect.top}px`;
        
        loadingScreen.appendChild(missile);

        // ミサイルの移動アニメーション
        const missileInterval = setInterval(() => {
            const missileRect = missile.getBoundingClientRect();
            
            // 画面外に出たら削除
            if (missileRect.bottom < 0) {
                clearInterval(missileInterval);
                missile.remove();
                return;
            }

            // 上に移動
            missile.style.top = `${missileRect.top - 10}px`;

            // 文字との当たり判定
            titleChars.forEach(char => {
                if (char.classList.contains('destroyed')) return;

                const charRect = char.getBoundingClientRect();
                if (
                    missileRect.left < charRect.right &&
                    missileRect.right > charRect.left &&
                    missileRect.top < charRect.bottom &&
                    missileRect.bottom > charRect.top
                ) {
                    // 命中
                    char.classList.add('destroyed');
                    missile.remove();
                    clearInterval(missileInterval);
                    destroyedCount++;

                    // 4文字壊したらゲーム開始ボタンを表示
                    if (destroyedCount >= 4 && messageContainer.classList.contains('hidden')) {
                        messageContainer.classList.remove('hidden');
                    }

                    // 全て壊れたら復活させる
                    const allDestroyed = Array.from(titleChars).every(c => c.classList.contains('destroyed'));
                    if (allDestroyed) {
                        setTimeout(() => {
                            titleChars.forEach(c => {
                                c.classList.remove('destroyed');
                                c.style.transform = '';
                                c.style.opacity = '';
                            });
                        }, 1000);
                    }
                }
            });
        }, 16);
    }

    // ゲーム開始ボタンクリック時の処理
    playButton.addEventListener('click', () => {
        isGameStarted = true;
        loadingScreen.style.opacity = '0';
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            // ゲーム開始イベントを発火
            document.dispatchEvent(new CustomEvent('start-game-event'));
        }, 500);
    });

    // 戦闘機を描画する関数
    function drawLoadingShip() {
        shipCtx.clearRect(0, 0, shipCanvas.width, shipCanvas.height);
        shipCtx.save();
        // canvasのサイズ(40x40)に合わせてSVGパス(40x40想定)をスケール
        shipCtx.scale(shipCanvas.width / 40, shipCanvas.height / 40);

        // script.jsのdrawPlayer()から描画部分をコピー＆簡略化
        shipCtx.fillStyle = '#00aa00';
        shipCtx.shadowColor = '#0f0';
        shipCtx.shadowBlur = 5;
        shipCtx.fill(WING_LEFT_PATH);
        shipCtx.fill(WING_RIGHT_PATH);

        shipCtx.fillStyle = '#ccc';
        shipCtx.shadowColor = '#fff';
        shipCtx.shadowBlur = 2;
        shipCtx.fill(POD_LEFT_PATH);
        shipCtx.fill(POD_RIGHT_PATH);

        shipCtx.fillStyle = '#0f0';
        shipCtx.shadowColor = '#0f0';
        shipCtx.shadowBlur = 10;
        shipCtx.fill(FUSELAGE_PATH);

        shipCtx.fillStyle = '#aff';
        shipCtx.shadowColor = '#aff';
        shipCtx.shadowBlur = 5;
        shipCtx.fill(COCKPIT_PATH);

        shipCtx.restore();
    }

    // アニメーション開始
    drawLoadingShip(); // 初期描画
    updateLoadingLoop();
});
