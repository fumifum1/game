// ====================================================================
// ゲーム定数
// ====================================================================
const BOARD_SIZE = 8;
const EMPTY = 0;
const PLAYER = 1; // 黒
const AI = 2;     // 白
const COLORS = { [PLAYER]: 'black', [AI]: 'white' };
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
let currentPlayer = PLAYER;
let isGameActive = false;
let difficulty = 2; // 初期値: ふつう
let isAITurn = false;
let isGameFinished = false;

// DOM要素
const boardEl = document.getElementById('game-board');
const scorePlayerEl = document.getElementById('score-player');
const scoreAIEl = document.getElementById('score-ai');
const startButton = document.getElementById('startButton');
const difficultySelect = document.getElementById('difficulty');
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
    if (key === 'START' || key === 'PLAYER_TURN' || key === 'SMALL_FLIP') {
         // 状況コメントが必要な場合、現在の盤面からコメントキーを再評価する
         const bestKey = getAICommentKey(lastFlips);
         if (bestKey !== 'START' && bestKey !== 'PLAYER_TURN') {
            actualKey = bestKey; // 優勢/劣勢コメントを優先
         }
         const newComments = AI_COMMENTS[actualKey];
         if (!newComments || newComments.length === 0) actualKey = key; // コメントが見つからない場合は元のキーに戻す
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
    const { player, ai } = calculateScore();
    const scoreDiff = ai - player;
    const totalPlayed = player + ai;

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


// ====================================================================
// ゲームロジック
// ====================================================================

/**
 * ゲームを初期状態にリセットし、開始します。
 */
function startGame() {
    if (isGameActive) return;

    // ボードの初期化
    board = Array(BOARD_SIZE).fill(0).map(() => Array(BOARD_SIZE).fill(EMPTY));
    board[3][3] = AI;
    board[3][4] = PLAYER;
    board[4][3] = PLAYER;
    board[4][4] = AI;

    currentPlayer = PLAYER; // プレイヤー（黒）先手
    isGameActive = true;
    isAITurn = false;
    isGameFinished = false;
    difficulty = parseInt(difficultySelect.value);

    // モーダルを非表示にする
    gameControlModal.classList.add('hidden');

    renderBoard();
    // ゲーム開始時のコメントと表情
    setComment('START');
}

/**
 * プレイヤーまたはAIの動きを処理します。
 * @param {number} r 行インデックス
 * @param {number} c 列インデックス
 */
async function handleMove(r, c) {
    if (isAITurn || !isGameActive || isGameFinished) return;

    const flips = flipPieces(r, c, currentPlayer, false);

    if (flips.length > 0) {
        isAITurn = true; // プレイヤーのターン中はAIのターンフラグを立てて操作をロック

        // 盤面の更新とアニメーション
        renderBoard();

        // アニメーションのため、石を置く場所とひっくり返す石をDOMに追加
        await new Promise(resolve => setTimeout(resolve, 500));

        if (flips.length > 0) {
            flipPieces(r, c, currentPlayer, true);
        }

        // プレイヤーが打った後のフリップ数に基づいてコメントをセット
        setComment(getAICommentKey(flips.length), flips.length);

        nextTurn(); // ターンを切り替え (AIへ、またはAIパスでPLAYERのまま)

        // AIのターン処理 (AIが連続で打つ場合もここで処理する)
        while (currentPlayer === AI && !isGameFinished) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 思考時間+コメント表示時間
            await aiTurn();
            renderBoard(); // AI後の盤面をレンダリング
            
            if (!isGameFinished) {
                // AIが打った後の次のターン処理 (プレイヤーの番へ、またはプレイヤーパスでAIのまま)
                nextTurn();
            }
        }

        isAITurn = false; // プレイヤーのターンになったらボードのロックを解除
        renderBoard(); // 最終的な盤面の再描画（ハイライト更新のため）
        // プレイヤーの番であることを明示
        if (!isGameFinished) {
            setComment('PLAYER_TURN');
        }
        
    } else {
        // 無効な手の場合のコメント
        setComment('INVALID_MOVE');
        await new Promise(resolve => setTimeout(resolve, 1500));
        // 無効な手コメントの後、すぐに「あなたの番」に戻す
        if (currentPlayer === PLAYER && !isGameFinished) {
            setComment('PLAYER_TURN');
        }
    }
}

/**
 * 次のターンに進む処理
 */
function nextTurn() {
    const validMovesPlayer = getValidMoves(PLAYER);
    const validMovesAI = getValidMoves(AI);
    const playerHasMoves = Object.keys(validMovesPlayer).length > 0;
    const aiHasMoves = Object.keys(validMovesAI).length > 0;

    updateScore();

    if (!playerHasMoves && !aiHasMoves) {
        // 両者とも打てない -> ゲーム終了
        endGame();
        return;
    }

    if (currentPlayer === PLAYER) {
        // プレイヤーが打った直後 (次はAIの番を想定)
        if (aiHasMoves) {
            currentPlayer = AI; // AIのターンへ
            setComment('START'); // AIのターン開始時に状況コメントを出す
        } else if (playerHasMoves) {
            // AIがパス -> プレイヤー連続ターン
            setComment('AI_PASS'); // AIがパスしたことを通知
            currentPlayer = PLAYER;
        } else {
            // プレイヤーもAIも動けない（上のチェックで終了するが念のため）
            endGame();
            return;
        }
    } else { // currentPlayer === AI
        // AIが打った直後 (次はプレイヤーの番を想定)
        if (playerHasMoves) {
            currentPlayer = PLAYER; // プレイヤーのターンへ
            setComment('PLAYER_TURN');
        } else if (aiHasMoves) {
            // プレイヤーがパス -> AI連続ターン
            setComment('PLAYER_PASS'); // プレイヤーがパスしたことを通知
            currentPlayer = AI;
        } else {
            // プレイヤーもAIも動けない（上のチェックで終了するが念のため）
            endGame();
            return;
        }
    }

    renderBoard(); // ターンが変わった後のボードを再描画（主にハイライトのため）
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
    let scoreP = 0;
    let scoreA = 0;
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            if (board[r][c] === PLAYER) scoreP++;
            else if (board[r][c] === AI) scoreA++;
        }
    }
    return { player: scoreP, ai: scoreA };
}

/**
 * スコア表示DOMを更新します。
 */
function updateScore() {
    const { player, ai } = calculateScore();
    scorePlayerEl.textContent = player;
    scoreAIEl.textContent = ai;

    scorePlayerEl.classList.toggle('text-black', player > ai);
    scorePlayerEl.classList.toggle('text-gray-800', player <= ai);

    scoreAIEl.classList.toggle('text-gray-800', ai > player);
    scoreAIEl.classList.toggle('text-gray-600', ai <= player);
}

/**
 * ゲーム終了処理
 */
function endGame() {
    isGameActive = false;
    isGameFinished = true;
    const { player, ai } = calculateScore();

    let title = '引き分け';
    let message = `黒 ${player} - 白 ${ai} で引き分けです！`;
    let commentKey = 'TIE';

    if (player > ai) {
        title = 'あなたの勝ち！';
        message = `黒 ${player} - 白 ${ai} で、あなたの勝利です！おめでとうございます！`;
        commentKey = 'END_LOSE'; // AIは負け
    } else if (ai > player) {
        title = 'COMの勝ち';
        message = `黒 ${player} - 白 ${ai} で、COMの勝利です。残念！`;
        commentKey = 'END_WIN'; // AIは勝ち
    }

    // ゲーム終了時のコメント
    setComment(commentKey); // コメントと表情を更新

    // モーダル内の表示を更新
    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // 初期設定を隠し、ゲームオーバー画面を表示
    initialSetupSection.classList.add('hidden');
    gameOverSection.classList.remove('hidden');
    gameControlModal.classList.remove('hidden');
}

/**
 * AIのターン処理（難易度に応じて適切な戦略を呼び出す）
 */
async function aiTurn() {
    const validMoves = getValidMoves(AI);
    if (Object.keys(validMoves).length === 0) {
        setComment('PASS'); // パスコメント
        return; // パス
    }

    let bestMove = null;

    if (difficulty === 1) {
        // 1: かんたん (ランダム)
        const moveKeys = Object.keys(validMoves);
        const randomKey = moveKeys[Math.floor(Math.random() * moveKeys.length)];
        const [r, c] = randomKey.split(',').map(Number);
        const flips = validMoves[randomKey] ? validMoves[randomKey].length : 0;
        bestMove = { r, c, flips: flips };
    } else if (difficulty === 2) {
        // 2: ふつう (貪欲法 - 最大フリップ数)
        let maxFlips = -1;
        let bestMoves = [];

        for (const key in validMoves) {
            const flips = validMoves[key].length;
            if (flips > maxFlips) {
                maxFlips = flips;
                bestMoves = [key];
            } else if (flips === maxFlips) {
                bestMoves.push(key);
            }
        }
        const randomKey = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        const [r, c] = randomKey.split(',').map(Number);
        bestMove = { r, c, flips: maxFlips };
    } else if (difficulty === 3) {
        // 3: むずかしい (ミニマックス法)
        const result = minimaxSearch(board, 2, -Infinity, Infinity, true); // 探索深度2
        
        // ミニマックスの結果からフリップ数を計算し、コメントに利用
        let flips = 0;
        if (result.move) {
            const moveKey = `${result.move.r},${result.move.c}`;
            flips = validMoves[moveKey] ? validMoves[moveKey].length : 0;
        }

        bestMove = { ...result.move, flips: flips };
    }

    if (bestMove) {
        const { r, c, flips } = bestMove;
        
        // AIの行動結果のコメントと表情を更新
        if (flips !== undefined) {
            setComment(getAICommentKey(flips), flips);
        }

        // AIの動きをアニメーション表示するため、裏返し処理を改めて呼び出す
        flipPieces(r, c, AI, true);
        renderBoard(); // 裏返った後の盤面を再レンダリング
    }
}

/**
 * 評価関数: ボードの評価値を返します。
 * @param {Array<Array<number>>} currentBoard 評価する盤面
 * @param {number} player 評価対象のプレイヤー (AI)
 * @returns {number} 評価値
 */
function evaluateBoard(currentBoard, player) {
    let score = 0;
    const opponent = player === PLAYER ? AI : PLAYER;

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
    const player = isMaximizingPlayer ? AI : PLAYER;
    const opponent = isMaximizingPlayer ? PLAYER : AI;
    const validMoves = getValidMoves(player, currentBoard);

    // 探索終了条件:
    if (depth === 0 || (Object.keys(validMoves).length === 0 && Object.keys(getValidMoves(opponent, currentBoard)).length === 0)) {
        return { score: evaluateBoard(currentBoard, AI), move: null };
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
 * flipPieces のヘルパー関数 (仮想的な手打ち用)
 * @param {number} r 行インデックス
 * @param {number} c 列インデックス
 * @param {number} player プレイヤー (PLAYER or AI)
 * @param {boolean} execute 実際に石を裏返すか
 * @param {Array<Array<number>>} currentBoard 使用するボード (デフォルトはグローバルボード)
 * @returns {Array<[number, number]>} 裏返した石の座標リスト
 */
function flipPieces(r, c, player, execute = true, currentBoard = board) {
    // executeがtrueの場合、石を置くマスがEMPTYでないとエラーになるためチェックを緩和
    if (execute && currentBoard[r][c] !== EMPTY && currentBoard === board) {
        // 実際に打つ場合は、この場所がEMPTYではない（すでに石がある）が、
        // プレイヤーが打った直後なので、ここでは処理を継続させる
    } else if (!execute && currentBoard[r][c] !== EMPTY) {
        // 確認モードでEMPTYでない場合は、無効な手
        return [];
    }

    let piecesToFlip = [];
    const opponent = player === PLAYER ? AI : PLAYER;
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
                piecesToFlip = piecesToFlip.concat(currentLine);
                break;
            } else if (cell === EMPTY) {
                break;
            }
            tr += dr;
            tc += dc;
        }
    }

    if (execute && piecesToFlip.length > 0) {
        currentBoard[r][c] = player;
        piecesToFlip.forEach(([pr, pc]) => {
            currentBoard[pr][pc] = player;
        });
    }

    return piecesToFlip;
}

/**
 * ボードの状態をHTMLにレンダリングします。
 * 可能な手があれば、そのセルをハイライトします。
 */
function renderBoard() {
    boardEl.innerHTML = '';
    // プレイヤーのターンかつゲームアクティブな場合のみ有効な手を取得
    const validMoves = isGameActive && !isAITurn && currentPlayer === PLAYER ? getValidMoves(currentPlayer) : {};

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = r;
            cell.dataset.col = c;

            // 可能な手のハイライト
            if (isGameActive && !isAITurn && currentPlayer === PLAYER && board[r][c] === EMPTY && validMoves[`${r},${c}`]) {
                cell.classList.add('possible-move');
                cell.addEventListener('click', () => handleMove(r, c));
            } else if (board[r][c] !== EMPTY) {
                // 石があるマス
                cell.classList.add('occupied');
                const piece = document.createElement('div');
                piece.className = `piece ${COLORS[board[r][c]]}`;
                cell.appendChild(piece);
            }
            boardEl.appendChild(cell);
        }
    }

    updateScore();
}

// ページロード時の初期メッセージ表示
window.onload = () => {
    // モーダルは最初から表示されているので、ボードはまだ描画しない
    // 初期コメントはHTMLに静的に記述されているため、ここでの呼び出しは不要
    // setComment('INITIAL');
    // renderBoard(); // ゲーム開始時に呼び出すように変更
};