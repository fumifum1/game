// ====================================================================
// ゲーム定数
// ====================================================================
const BOARD_SIZE = 8;
const EMPTY = 0;
const BLACK = 1; // 黒 (先攻)
const WHITE = 2; // 白 (後攻)
const COLORS = { [BLACK]: 'black', [WHITE]: 'white' };
const WEIGHTS = [
    [120, -20, 20, 5, 5, 20, -20, 120],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [5, -5, 3, 3, 3, 3, -5, 5],
    [20, -5, 15, 3, 3, 15, -5, 20],
    [-20, -40, -5, -5, -5, -5, -40, -20],
    [120, -20, 20, 5, 5, 20, -20, 120]
]; // 評価関数用の重みテーブル

// AIのコメントテンプレート (煽り・生意気トーン)
const AI_COMMENTS = {
    INITIAL: ["難易度を選び「ゲーム開始」を押してください。準備はいいですか？"],
    START: [
        "雑魚狩り開始っと。お手柔らかにね？",
        "COMの圧勝で終わらせてあげるよ。",
        "まぁ、適当に頑張ってみて？"
    ],
    PLAYER_TURN: [
        "ほらほら、早くしないと時間切れだよ？",
        "その手、本当に大丈夫？笑",
        "え、まだ考えてるの？簡単じゃん。",
        "初心者にしては頑張ってるかもね。"
    ],
    INVALID_MOVE: [
        "そこ、打てないって何回言えばわかるの？",
        "ルールブック読み直したら？それか見えてない？笑",
        "無駄な操作は時間切れになるぞ。"
    ],
    HAPPY_LEAD: [
        "ふーん、これで勝ちなんだよね。お疲れ様！",
        "ま、こんなもんだろ。差が開いていくね。",
        "COMの盤石な強さを見せつけてやるよ。"
    ],
    WORRIED_LAG: [
        "ちょ、調子に乗らないでくれる？これは計算のうち…のはず。",
        "ちょっと本気出すわ。そこまでだ。",
        "イラつくけど、すぐにひっくり返すから震えて待ってな。"
    ],
    BIG_FLIP: [
        "大逆転！盤面ひっくり返してやったぜ！ざまあみろ！",
        "これが実力差ってやつ？笑 お前のミスだよ！",
        "まとめてひっくり返し！気持ち良すぎだろ！"
    ],
    SMALL_FLIP: [
        "地味だけど大事。お前の石、いただきます。",
        "チリツモって知ってる？一石ずつ、確実にね。",
        "小さな獲物も逃さないよ。律儀だろ？"
    ],
    PASS: ["置けないのでパスをお願いします。"],
    AI_PASS: [
        "COMがパスしました。連続で打てるのはチャンスですよ！…って言ってあげたんだから感謝しろよ！",
        "ラッキー！もう一度、お前の番。次に打てるか楽しみだね（棒）。"
    ],
    PLAYER_PASS: [
        "パスぅ？まさかもう諦めた？雑魚すぎ！",
        "打つ手が無いなんて、センスないねー。COMの連続ターンだ。",
        "考えるだけ無駄だ。次もCOMが打つよ。"
    ],
    END_WIN: [
        "勝った！当然だよね？この差は埋まらないよ、雑魚！",
        "いやー、楽勝楽勝！お前弱いな！笑",
        "これがCOMの力だ！リベンジは受け付けないよ！"
    ],
    END_LOSE: [
        "嘘だろ！？こんなはずじゃ…次こそは完膚なきまでに叩き潰す！",
        "くっそー！覚えてろよ！この屈辱、倍にして返してやる！",
        "運が悪かっただけ。実力じゃないからな！"
    ],
    TIE: [
        "まさかの引き分け。まぁ、今日のところはこれくらいで勘弁してやるよ。",
        "運が良かったな、人間。次は勝たせない。",
        "ふん、引き分けか。もう一局やったら絶対勝つし。"
    ]
};


// ====================================================================
// ゲーム状態変数
// ====================================================================
let board = [];
let currentPlayer = BLACK;
let isGameActive = false;
let difficulty = 2; // 初期値: ふつう
let isAITurn = false;
let isGameFinished = false;

// 新しいゲーム設定変数
let gameMode = 'pve'; // 'pve' or 'pvp'
let playerColor = BLACK; // ユーザーの色 (PvE用)
let aiColor = WHITE;     // AIの色 (PvE用)

// DOM要素
const boardEl = document.getElementById('game-board');
const scorePlayerEl = document.getElementById('score-player');
const scoreAIEl = document.getElementById('score-ai');
const startButton = document.getElementById('startButton');
const gameModeSelect = document.getElementById('gameMode');
const playerColorSelect = document.getElementById('playerColor');
const difficultySelect = document.getElementById('difficulty');
const colorSelectionDiv = document.getElementById('colorSelection');
const difficultySelectionDiv = document.getElementById('difficultySelection');

const gameControlModal = document.getElementById('gameControlModal');
const initialSetupSection = document.getElementById('initialSetupSection');
const gameOverSection = document.getElementById('gameOverSection');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const replayButton = document.getElementById('replayButton');
const aiCharacterEl = document.getElementById('ai-character'); // キャラクターアイコン
const aiCommentText = document.getElementById('ai-comment-text');


// ====================================================================
// 初期化とイベントリスナー
// ====================================================================

startButton.addEventListener('click', startGame);

// ゲームモード切り替え時のUI制御
gameModeSelect.addEventListener('change', () => {
    const mode = gameModeSelect.value;
    if (mode === 'pve') {
        colorSelectionDiv.classList.remove('hidden');
        difficultySelectionDiv.classList.remove('hidden');
    } else {
        colorSelectionDiv.classList.add('hidden');
        difficultySelectionDiv.classList.add('hidden');
    }
});

difficultySelect.addEventListener('change', () => {
    difficulty = parseInt(difficultySelect.value);
});
replayButton.addEventListener('click', () => {
    // ゲームオーバーセクションを隠し、初期設定セクションを表示する
    gameOverSection.classList.add('hidden');
    initialSetupSection.classList.remove('hidden');

    // ゲーム状態をリセット
    isGameActive = false;
    isGameFinished = false;

    // 初期コメントに戻す
    setComment('INITIAL');
});

// ====================================================================
// コメント表示ロジック (表情制御を含む)
// ====================================================================

/**
 * コメントキーに基づいてAIの表情（絵文字）を取得します。
 * @param {string} key AI_COMMENTSのキー
 * @returns {string} 絵文字
 */
function getEmotionEmoji(key) {
    switch (key) {
        // Happy
        case 'END_WIN':
            return '😁'; // 勝った！
        case 'HAPPY_LEAD':
            return '😊'; // 優勢
        case 'BIG_FLIP':
            return '🤣'; // 大量フリップ

        // Angry / Worried
        case 'END_LOSE':
            return '😢'; // 負け
        case 'WORRIED_LAG':
            return '😒'; // 劣勢

        // Confused / Pass / Other
        case 'PASS':
            return '🤔'; // パス
        case 'AI_PASS':
            return '😉'; // AIがパス
        case 'PLAYER_PASS':
            return '😜'; // プレイヤーがパス
        case 'INVALID_MOVE':
            return '😒'; // 無効な手
        case 'TIE':
            return '🤔'; // 引き分け
        default: // INITIAL, START, PLAYER_TURN, SMALL_FLIPなど
            return '😃'; // デフォルト
    }
}

/**
 * AIのコメントを吹き出しに表示し、表情を更新します。
 * @param {string} key AI_COMMENTSのキー
 * @param {number} lastFlips 直前に裏返した石の数 (AIの場合)
 */
function setComment(key, lastFlips = 0) {
    let actualKey = key;
    const comments = AI_COMMENTS[key];
    if (!comments || comments.length === 0) return;

    // 特定の状況では、より具体的なキーを優先して選択
    // AIのターン開始時、またはプレイヤーが手を打った直後に戦況を判断する
    if (key === 'START' || key === 'PLAYER_TURN') {
        const situationKey = getAICommentKey(lastFlips);
        // 'START'は汎用キーなので、より具体的な状況キーがあれば上書きする
        if (situationKey !== 'START') {
            actualKey = situationKey;
        }
    }

    const messageList = AI_COMMENTS[actualKey];

    // ランダムにコメントを選択
    const message = messageList[Math.floor(Math.random() * messageList.length)];
    aiCommentText.textContent = message;

    // 表情を更新
    const emoji = getEmotionEmoji(actualKey);
    aiCharacterEl.textContent = emoji;
}

/**
 * ゲームの状態に基づいて適切なコメントキーを返します。
 * @param {number} lastFlips 直前に裏返した石の数 (AIの場合)
 * @returns {string} AI_COMMENTSのキー
 */
function getAICommentKey(lastFlips = 0) {
    const { black, white } = calculateScore();
    const myScore = (aiColor === BLACK) ? black : white;
    const opponentScore = (aiColor === BLACK) ? white : black;
    const scoreDiff = myScore - opponentScore;
    const totalPlayed = black + white;

    // 終盤 (50手以上) は点差を重視
    if (totalPlayed >= 50) {
        if (scoreDiff >= 8) return 'HAPPY_LEAD';
        if (scoreDiff <= -8) return 'WORRIED_LAG';
    }

    // 直前のフリップ数を重視 (AIのターン直後のみ有効)
    if (lastFlips >= 8) {
        return 'BIG_FLIP';
    } else if (lastFlips > 0) {
        return 'SMALL_FLIP';
    }

    // 序盤〜中盤の優勢/劣勢
    if (scoreDiff >= 5) {
        return 'HAPPY_LEAD';
    } else if (scoreDiff <= -5) {
        return 'WORRIED_LAG';
    }
    return 'START'; // その他（序盤、競り合い）
}

const ANIMATION_DELAY_PLACE = 300;
const ANIMATION_DELAY_FLIP = 600;


// ====================================================================
// ゲームロジック (リファクタリング版)
// ====================================================================

/**
 * ゲームを初期状態にリセットし、開始します。
 */
function startGame() {
    if (isGameActive) return;

    // ボードの初期化
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
    board[3][3] = WHITE;
    board[3][4] = BLACK;
    board[4][3] = BLACK;
    board[4][4] = WHITE;

    isGameActive = true;
    isGameFinished = false;
    isAITurn = false; // 初期化

    // 設定の読み込み
    gameMode = gameModeSelect.value;
    difficulty = parseInt(difficultySelect.value);

    if (gameMode === 'pve') {
        playerColor = parseInt(playerColorSelect.value); // 1(BLACK) or 2(WHITE)
        aiColor = (playerColor === BLACK) ? WHITE : BLACK;
    } else {
        // PvPの場合は色は固定しない
        playerColor = null;
        aiColor = null;
    }

    currentPlayer = BLACK; // 常に黒が先攻

    // モーダルを非表示にする
    gameControlModal.classList.add('hidden');

    renderBoard();
    setComment('START');

    // 最初のターンの処理を開始 (PvEでユーザーが白なら、ここで自動的にAIのターンになる)
    checkTurn();
}

/**
 * ターン管理の中心的関数
 * 現在の手番がAIかプレイヤーかを判断し、適切な処理を振り分けます。
 */
function checkTurn() {
    if (!isGameActive || isGameFinished) return;

    updateCommentForTurn();

    // PvEモードで、現在の手番がAIの場合
    if (gameMode === 'pve' && currentPlayer === aiColor) {
        isAITurn = true; // プレイヤーの操作をロック
        // 少し間を置いてAIに思考させる
        setTimeout(() => {
            aiTurn();
        }, 1000);
    } else {
        isAITurn = false; // プレイヤーの操作ロック解除
    }
}

/**
 * プレイヤーの動きを処理します。
 * @param {number} r 行インデックス
 * @param {number} c 列インデックス
 */
async function handleMove(r, c) {
    // ロック中、ゲーム終了時、AIターン中は無視
    if (isAITurn || !isGameActive || isGameFinished) return;

    // バリデーション
    const flips = flipPieces(r, c, currentPlayer, false);
    if (flips.length === 0) {
        setComment('INVALID_MOVE');
        // 数秒後に元のコメントに戻すなどの処理があっても良い
        return;
    }

    // 操作ロック
    isAITurn = true; // アニメーション中も操作させないためtrueにする

    // 1. 石を置く & 描画
    board[r][c] = currentPlayer;
    renderBoard();
    await new Promise(resolve => setTimeout(resolve, ANIMATION_DELAY_PLACE));

    // 2. フリップ実行
    flipPieces(r, c, currentPlayer, true);
    renderBoard(); // アニメーション開始

    // コメント更新
    setComment(getAICommentKey(flips.length), flips.length);

    // 3. アニメーション待ち
    await new Promise(resolve => setTimeout(resolve, ANIMATION_DELAY_FLIP));

    // 4. 次のターンへ
    nextTurn();
}

/**
 * AIの動きを処理します。
 */
async function aiTurn() {
    if (!isGameActive || isGameFinished) return;

    // AIの手を決定
    const validMoves = getValidMoves(aiColor);

    // パスの場合
    if (Object.keys(validMoves).length === 0) {
        setComment('PASS');
        await new Promise(resolve => setTimeout(resolve, 1000));
        nextTurn();
        return;
    }

    let bestMove = null;

    if (difficulty === 1) {
        // ランダム
        const moveKeys = Object.keys(validMoves);
        const randomKey = moveKeys[Math.floor(Math.random() * moveKeys.length)];
        const [r, c] = randomKey.split(',').map(Number);
        bestMove = { r, c, flips: validMoves[randomKey].length };
    } else if (difficulty === 2) {
        // 貪欲法
        let maxFlips = -1;
        let bestMoves = [];
        for (const key in validMoves) {
            const flips = validMoves[key].length;
            if (flips > maxFlips) {
                maxFlips = flips;
                bestMoves = [key];
            } else if (flips === maxFlips) bestMoves.push(key);
        }
        const randomKey = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        const [r, c] = randomKey.split(',').map(Number);
        bestMove = { r, c, flips: maxFlips };
    } else {
        // ミニマックス
        const result = minimaxSearch(board, 2, -Infinity, Infinity, true);
        const flips = result.move ? validMoves[`${result.move.r},${result.move.c}`]?.length || 0 : 0;
        bestMove = { ...result.move, flips };
    }

    if (bestMove) {
        const { r, c, flips } = bestMove;

        // コメント
        if (flips !== undefined) setComment(getAICommentKey(flips), flips);

        // 1. 石を置く
        board[r][c] = aiColor;
        renderBoard();
        await new Promise(resolve => setTimeout(resolve, ANIMATION_DELAY_PLACE));

        // 2. フリップ
        flipPieces(r, c, aiColor, true);
        renderBoard();

        // 3. 待ち
        await new Promise(resolve => setTimeout(resolve, ANIMATION_DELAY_FLIP));
    }

    nextTurn();
}

/**
 * 次のターンに進む処理
 * 手番を交代し、パス判定や終了判定を行います。
 */
function nextTurn() {
    updateScore();

    const opponent = (currentPlayer === BLACK) ? WHITE : BLACK;
    const opponentMoves = getValidMoves(opponent);
    const currentMoves = getValidMoves(currentPlayer); // 現在のプレイヤー(交代前)も確認必要？いや、交代後のプレイヤーの手を見るべき

    // まず手番を交代してみる
    let nextPlayer = opponent;
    let nextPlayerMoves = getValidMoves(nextPlayer);

    // 次のプレイヤーに打つ手があるか？
    if (Object.keys(nextPlayerMoves).length > 0) {
        currentPlayer = nextPlayer;
        checkTurn(); // 新しい手番でループ再開
        renderBoard(); // UIを更新 (ハイライトなど)
        return;
    }

    // 次のプレイヤーがパスの場合
    // 現在のプレイヤー（交代せず）には打つ手があるか？
    let myMoves = getValidMoves(currentPlayer);
    if (Object.keys(myMoves).length > 0) {
        // パス発生
        if (gameMode === 'pve') {
            // どちらがパスしたか
            if (nextPlayer === playerColor) setComment('PLAYER_PASS');
            else setComment('AI_PASS');
        } else {
            alert(`${COLORS[nextPlayer] === 'black' ? '黒' : '白'}はパスです。`);
        }
        // 手番交代せず、再度 checkTurn (連続手番)
        checkTurn();
        return;
    }

    // 両者とも打つ手なし -> ゲーム終了
    endGame();
}

/**
 * 現在のターンに合わせてコメントを更新
 */
function updateCommentForTurn() {
    if (gameMode === 'pve') {
        if (currentPlayer === playerColor) {
            setComment('PLAYER_TURN');
        } else {
            // AI思考中はhandleMove内で制御されるが、念のため
            // setComment('START'); 
        }
    } else {
        // PvP用メッセージ
        aiCommentText.textContent = `現在は ${currentPlayer === BLACK ? '黒' : '白'} の番です。`;
        aiCharacterEl.textContent = '🤔';
    }
}

/**
 * 有効な手のリストを取得します。
 * @param {number} player プレイヤー (PLAYER or AI)
 * @returns {Object<string, Array<[number, number]>>} キーは "r,c", 値は裏返す石の座標リスト
 */
function getValidMoves(player, currentBoard = board) {
    const moves = {};
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r][c] === EMPTY) {
                // 確認モードでflipPiecesを呼び出し、裏返せる石のリストを取得
                const flips = flipPieces(r, c, player, false, currentBoard);
                if (flips.length > 0) {
                    moves[`${r},${c}`] = flips;
                }
            }
        }
    }
    return moves;
}

/**
 * スコアを計算し、表示を更新します。
 * @returns {{player: number, ai: number}}
 */
function calculateScore() {
    let scoreBlack = 0;
    let scoreWhite = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === BLACK) scoreBlack++;
            else if (board[r][c] === WHITE) scoreWhite++;
        }
    }
    return { black: scoreBlack, white: scoreWhite };
}

/**
 * スコア表示DOMを更新します。
 */
function updateScore() {
    const { black, white } = calculateScore();
    // HTMLのIDはscore-player, score-aiのまま流用するが、
    // ラベルの意味合いが変わるため、PvPの場合は別途ラベル変更が必要かもしれない。
    // 今回は簡易的に score-player = 黒, score-ai = 白 とする。

    // UI上のラベルを黒/白に固定更新（初期化時などで書き換わっている可能性考慮）
    // （HTML構造依存だが、今回は数字のみ更新）
    scorePlayerEl.textContent = black;
    scoreAIEl.textContent = white;

    // ハイライト
    scorePlayerEl.classList.toggle('text-white', black > white);
    scorePlayerEl.classList.toggle('text-gray-200', black <= white);

    scoreAIEl.classList.toggle('text-white', white > black);
    scoreAIEl.classList.toggle('text-gray-400', white <= black);
}

/**
 * ゲーム終了処理
 */
function endGame() {
    isGameActive = false;
    isGameFinished = true;
    const { black, white } = calculateScore();

    // PvAI視点での勝敗判定（PvPなら色で表示）
    let title = '引き分け';
    let message = `黒 ${black} - 白 ${white} で引き分けです！`;
    let commentKey = 'TIE';

    if (gameMode === 'pve') {
        // ユーザーが勝ったかどうか
        const userCount = (playerColor === BLACK) ? black : white;
        const aiCount = (aiColor === BLACK) ? black : white;

        if (userCount > aiCount) {
            title = 'あなたの勝ち！';
            message = `あなた ${userCount} - COM ${aiCount} で、あなたの勝利です！`;
            commentKey = 'END_LOSE'; // AI悔しがる
        } else if (aiCount > userCount) {
            title = 'COMの勝ち';
            message = `あなた ${userCount} - COM ${aiCount} で、COMの勝利です。`;
            commentKey = 'END_WIN'; // AI喜ぶ
        }
    } else {
        // PvP
        if (black > white) {
            title = '黒の勝ち！';
        } else if (white > black) {
            title = '白の勝ち！';
        }
        // PvPの場合はAIコメントは適当、あるいは非表示
        commentKey = 'TIE'; // 表情は中立
    }

    setComment(commentKey);
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    initialSetupSection.classList.add('hidden');
    gameOverSection.classList.remove('hidden');
    gameControlModal.classList.remove('hidden');
}



/**
 * 評価関数: ボードの評価値を返します。
 * @param {Array<Array<number>>} currentBoard 評価する盤面
 * @param {number} player 評価対象のプレイヤー (AI)
 * @returns {number} 評価値
 */
function evaluateBoard(currentBoard, player) {
    let score = 0;
    const opponent = player === BLACK ? WHITE : BLACK;

    // 1. 重み付きスコア
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (currentBoard[r][c] === player) {
                score += WEIGHTS[r][c];
            } else if (currentBoard[r][c] === opponent) {
                score -= WEIGHTS[r][c];
            }
        }
    }

    // 2. 有効な手の数 (モビリティ)
    const myMoves = Object.keys(getValidMoves(player, currentBoard)).length;
    const opponentMoves = Object.keys(getValidMoves(opponent, currentBoard)).length;
    score += (myMoves - opponentMoves) * 10; // モビリティに重み付け

    return score;
}

/**
 * ミニマックス探索 (アルファベータ枝刈り付き)
 * @param {Array<Array<number>>} currentBoard 現在の盤面
 * @param {number} depth 残りの探索深度
 * @param {number} alpha アルファ値
 * @param {number} beta ベータ値
 * @param {boolean} isMaximizingPlayer 現在AI (最大化プレイヤー) かどうか
 * @returns {{score: number, move: {r: number, c: number} | null}}
 */
function minimaxSearch(currentBoard, depth, alpha, beta, isMaximizingPlayer) {
    const player = isMaximizingPlayer ? aiColor : playerColor; // AI vs User
    const opponent = isMaximizingPlayer ? playerColor : aiColor;
    const validMoves = getValidMoves(player, currentBoard);

    // 探索終了条件:
    if (depth === 0 || (Object.keys(validMoves).length === 0 && Object.keys(getValidMoves(opponent, currentBoard)).length === 0)) {
        return { score: evaluateBoard(currentBoard, aiColor), move: null };
    }

    let bestScore = isMaximizingPlayer ? -Infinity : Infinity;
    let bestMove = null;

    if (Object.keys(validMoves).length === 0) {
        // パスの場合: 相手のターンとして再帰呼び出し
        const result = minimaxSearch(currentBoard, depth - 1, alpha, beta, !isMaximizingPlayer);
        return { score: result.score, move: null };
    }

    for (const key in validMoves) {
        const [r, c] = key.split(',').map(Number);
        const newBoard = currentBoard.map(row => [...row]);

        // 仮想的に手を打つ
        // flipPiecesはexecute=trueでnewBoardを直接変更するが、これは仮想ボードなので問題ない
        flipPieces(r, c, player, true, newBoard);
        newBoard[r][c] = player; // 石を置く

        const result = minimaxSearch(newBoard, depth - 1, alpha, beta, !isMaximizingPlayer);

        if (isMaximizingPlayer) {
            if (result.score > bestScore) {
                bestScore = result.score;
                bestMove = { r, c };
            }
            alpha = Math.max(alpha, bestScore);
        } else {
            if (result.score < bestScore) {
                bestScore = result.score;
                bestMove = { r, c };
            }
            beta = Math.min(beta, bestScore);
        }

        if (beta <= alpha) {
            break; // 枝刈り
        }
    }

    return { score: bestScore, move: bestMove };
}


/**
 * flipPieces のヘルパー関数
 * @param {number} r 行インデックス
 * @param {number} c 列インデックス
 * @param {number} player プレイヤー (BLACK or WHITE)
 * @param {boolean} execute 実際に石を裏返すか
 * @param {Array<Array<number>>} currentBoard 使用するボード
 * @returns {Array<[number, number]>} 裏返した石の座標リスト
 */
function flipPieces(r, c, player, execute = true, currentBoard = board) {
    if (!execute && currentBoard[r][c] !== EMPTY) {
        return [];
    }

    let piecesToFlip = [];
    const opponent = player === BLACK ? WHITE : BLACK;
    const directions = [
        [-1, 0], [1, 0], [0, -1], [0, 1],
        [-1, -1], [-1, 1], [1, -1], [1, 1]
    ];

    for (const [dr, dc] of directions) {
        let currentLine = [];
        let tr = r + dr;
        let tc = c + dc;

        while (tr >= 0 && tr < BOARD_SIZE && tc >= 0 && tc < BOARD_SIZE) {
            const cell = currentBoard[tr][tc];
            if (cell === opponent) {
                currentLine.push([tr, tc]);
            } else if (cell === player) {
                if (currentLine.length > 0) {
                    piecesToFlip = piecesToFlip.concat(currentLine);
                }
                break;
            } else {
                break;
            }
            tr += dr;
            tc += dc;
        }
    }

    if (execute && piecesToFlip.length > 0) {
        // 石はすでに置かれている前提だが、念のためここでもセット（仮想ボード用など）
        currentBoard[r][c] = player;
        piecesToFlip.forEach(([pr, pc]) => {
            currentBoard[pr][pc] = player;
        });
    }

    return piecesToFlip;
}

/**
 * 新しいピースのHTML要素を作成します（3D構造）
 */
function createPieceElement(colorCode) {
    const piece = document.createElement('div');
    piece.className = 'piece';

    const inner = document.createElement('div');
    inner.className = 'piece-inner';
    // 初期状態では1(BLACK)を表示
    if (colorCode === BLACK) {
        inner.classList.add('black-side');
    } else {
        inner.classList.add('white-side');
    }

    const faceFront = document.createElement('div');
    faceFront.className = 'face front'; // 黒

    const faceBack = document.createElement('div');
    faceBack.className = 'face back'; // 白

    inner.appendChild(faceFront);
    inner.appendChild(faceBack);
    piece.appendChild(inner);

    return piece;
}

/**
 * ボードの状態をHTMLにレンダリングします。
 * DOMを再利用してアニメーションを有効にします。
 */
function renderBoard() {
    // 初回のみGridを作成（もし空なら）
    if (boardEl.children.length === 0) {
        boardEl.style.display = 'grid';
        boardEl.style.gridTemplateColumns = `repeat(${BOARD_SIZE}, 1fr)`;
        boardEl.style.gridTemplateRows = `repeat(${BOARD_SIZE}, 1fr)`;

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.addEventListener('click', () => handleMove(r, c));
                boardEl.appendChild(cell);
            }
        }
    }

    // ハイライト条件：
    // GameActive AND
    // (PvP) OR (PvE かつ AIターンじゃない かつ 自分の手番)
    let canMove = isGameActive && !isGameFinished;
    if (gameMode === 'pve') {
        if (isAITurn || currentPlayer !== playerColor) canMove = false;
    }

    const validMoves = canMove ? getValidMoves(currentPlayer) : {};

    const cells = Array.from(boardEl.children);

    cells.forEach(cell => {
        const r = parseInt(cell.dataset.row);
        const c = parseInt(cell.dataset.col);
        const cellValue = board[r][c];

        // 石の更新処理
        let piece = cell.querySelector('.piece');

        if (cellValue !== EMPTY) {
            if (!piece) {
                // 新しく石を置く
                piece = createPieceElement(cellValue);
                cell.appendChild(piece);
            } else {
                // 既存の石がある場合、向きを更新（アニメーション）
                const inner = piece.querySelector('.piece-inner');
                // クラスを一旦すべて削除して付け直すことで遷移を保証
                inner.classList.remove('black-side', 'white-side');

                // 強制リフロー（必要なら）だが、通常はクラス切り替えでtransitionが効く
                if (cellValue === BLACK) {
                    inner.classList.add('black-side');
                } else {
                    inner.classList.add('white-side');
                }
            }
            cell.classList.add('occupied');
            cell.classList.remove('possible-move');
        } else {
            // 空マスの処理
            if (piece) {
                cell.removeChild(piece);
            }
            cell.classList.remove('occupied');

            // ハイライト処理
            if (validMoves[`${r},${c}`]) {
                cell.classList.add('possible-move');
            } else {
                cell.classList.remove('possible-move');
            }
        }
    });

    updateScore();
}

// ページロード時の初期メッセージ表示
window.onload = () => {
    // ローディング画面の処理
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500); // 0.5s transition
        }, 4000); // 4.0秒待機
    }

    // モーダルは最初から表示されているので、ボードはまだ描画しない
    // 初期コメントはHTMLに静的に記述されているため、ここでの呼び出しは不要
    // setComment('INITIAL');
    // renderBoard(); // ゲーム開始時に呼び出すように変更
};