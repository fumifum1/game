document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTS ---
    const BINGO_SIZE = 5;
    const MAX_NUMBER = 75;

    // --- DOM ELEMENT REFERENCES ---
    // Setup Screen
    const startScreen = document.getElementById('start-screen');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameContainer = document.getElementById('game-container');

    // Tabs
    const tabsContainer = document.querySelector('.tabs');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // Lottery View
    const lotteryTabLink = document.querySelector('.tab-link[data-tab="lottery-view"]');
    const lotteryTabView = document.getElementById('lottery-view');
    const drawButton = document.getElementById('draw-button');
    const currentNumberDisplay = document.getElementById('current-number-display');
    const drawnNumbersContainer = document.getElementById('drawn-numbers-container');
    const resetGameBtn = document.getElementById('reset-game-btn');

    // Card View
    const cardTabLink = document.querySelector('.tab-link[data-tab="card-view"]');
    const cardTabView = document.getElementById('card-view');
    const bingoGrid = document.getElementById('bingo-grid');
    const resetCardBtn = document.getElementById('reset-card-btn');
    const bingoMessage = document.getElementById('bingo-message');

    // Audio Elements
    const drawStartSound = document.getElementById('sound1');
    const drawEndSounds = [
        document.getElementById('sound2'),
        document.getElementById('sound3'),
        document.getElementById('sound4'),
        document.getElementById('sound5'),
        document.getElementById('sound6'),
        document.getElementById('sound7'),
        document.getElementById('sound8'),
    ];

    // Modal Elements
    const soundModalOverlay = document.getElementById('sound-modal-overlay');
    const confirmSoundBtn = document.getElementById('confirm-sound-btn');
    const shareBtn = document.getElementById('share-btn');
    const qrModalOverlay = document.getElementById('qr-modal-overlay');

    // Lottery Overlay Elements
    const lotteryOverlay = document.getElementById('lottery-overlay');
    const lotteryNumberFullscreen = document.getElementById('lottery-number-fullscreen');
    const lotteryOverlayControls = document.getElementById('lottery-overlay-controls');
    const drawAgainBtn = document.getElementById('draw-again-btn');
    const backToLotteryBtn = document.getElementById('back-to-lottery-btn');

    // --- GAME STATE ---
    let gameState = {};
    let lotteryAnimationInterval = null; // To hold the interval ID for the lottery animation

    // --- FUNCTIONS ---
    /**
     * Initializes the game based on setup screen selections.
     */
    function initializeGame(role, lines) {
        gameState = {
            role: role,
            requiredLines: lines,
            availableNumbers: Array.from({ length: MAX_NUMBER }, (_, i) => i + 1),
            drawnNumbers: [],
            isGameOver: false,
        };

        // Reset UI elements
        currentNumberDisplay.textContent = '?';
        drawnNumbersContainer.innerHTML = '';
        lotteryNumberFullscreen.textContent = '?';
        lotteryNumberFullscreen.classList.remove('decided', 'flickering');
        lotteryOverlay.classList.add('hidden');
        lotteryOverlayControls.classList.add('hidden');
        drawButton.disabled = false; // Re-enable the draw button
        bingoMessage.classList.remove('show');

        setupUIForRole();
        createBingoCard();
        console.log(`Game started. Role: ${role}, Lines: ${lines}`);
    }

    /**
     * Sets up the click handlers for tab navigation.
     */
    function setupTabs() {
        tabLinks.forEach(link => {
            link.addEventListener('click', () => {
                const targetTab = link.dataset.tab;
                tabLinks.forEach(innerLink => innerLink.classList.toggle('active', innerLink === link));
                tabContents.forEach(content => content.classList.toggle('active', content.id === targetTab));
            });
        });
    }

    /**
     * Configures the UI visibility based on the selected role.
     */
    function setupUIForRole() {
        if (gameState.role === 'player') {
            tabsContainer.style.display = 'none'; // Hide the entire tab navigation for players
            // Force card view to be active for players
            lotteryTabLink.classList.remove('active');
            cardTabLink.classList.add('active');
            lotteryTabView.classList.remove('active');
            cardTabView.classList.add('active');
            resetCardBtn.textContent = 'Back to Setup'; // Change button text for player
        } else { // admin
            tabsContainer.style.display = 'flex'; // Ensure tab navigation is visible for admins
            lotteryTabLink.classList.add('active');
            cardTabLink.classList.remove('active');
            lotteryTabView.classList.add('active');
            cardTabView.classList.remove('active');
            resetCardBtn.textContent = 'New Card'; // Ensure button text is correct for admin
        }
    }
    /**
     * Generates and renders a new bingo card.
     * If the game is in progress, it marks numbers that have already been called.
     */
    function createBingoCard() {
        bingoGrid.innerHTML = '';
        bingoMessage.classList.remove('show');

        // --- New Fully Random Number Generation ---
        // Create an array of all possible numbers (1-75)
        const sourceNumbers = Array.from({ length: MAX_NUMBER }, (_, i) => i + 1);

        // Shuffle the array using the Fisher-Yates algorithm
        for (let i = sourceNumbers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [sourceNumbers[i], sourceNumbers[j]] = [sourceNumbers[j], sourceNumbers[i]];
        }

        // Take the first 24 numbers for the card
        const cardNumbers = sourceNumbers.slice(0, 24);
        let numberIndex = 0;

        // Create 25 cells for the grid
        for (let i = 0; i < BINGO_SIZE * BINGO_SIZE; i++) {
            const cell = document.createElement('div');
            cell.classList.add('bingo-cell');

            const row = Math.floor(i / BINGO_SIZE);
            const col = i % BINGO_SIZE;

            if (row === 2 && col === 2) { // Center cell is FREE
                cell.textContent = '★';
                cell.classList.add('free', 'hit');
            } else { // All other cells get a random number
                const num = cardNumbers[numberIndex++];
                cell.textContent = num;
                cell.dataset.number = num;
                // If this number was already drawn, mark it as hit
                if (gameState.drawnNumbers.includes(num)) {
                    cell.classList.add('hit');
                }
                // Add a click listener for manual marking for players only.
                if (gameState.role === 'player') {
                    cell.addEventListener('click', () => {
                        if (!cell.classList.contains('free') && !gameState.isGameOver) {
                            cell.classList.toggle('hit');
                            checkBingo();
                        }
                    });
                } else {
                    // For admins, make the cursor a default arrow to indicate it's not clickable.
                    cell.style.cursor = 'default';
                }
            }
            bingoGrid.appendChild(cell);
        }
        checkBingo(); // Check for bingo in case the new card is an instant winner
    }

    /**
     * Starts the full-screen lottery animation and draws a number.
     */
    function startLotteryAnimation() {
        // Prevent drawing if game is over or animation is running
        if (gameState.isGameOver || lotteryAnimationInterval) return;

        // Check if there are numbers left to draw
        if (gameState.availableNumbers.length === 0) {
            currentNumberDisplay.textContent = 'End';
            lotteryNumberFullscreen.textContent = 'End';
            lotteryNumberFullscreen.classList.remove('flickering');
            lotteryNumberFullscreen.classList.add('decided');
            lotteryOverlayControls.classList.add('hidden');
            lotteryOverlay.classList.remove('hidden');
            drawButton.disabled = true;
            drawAgainBtn.disabled = true;
            return;
        }

        // Show overlay and start animation
        lotteryOverlay.classList.remove('hidden');
        lotteryOverlayControls.classList.add('hidden'); // Hide controls during animation
        lotteryNumberFullscreen.classList.remove('decided');
        lotteryNumberFullscreen.classList.add('flickering');

        // Play start sound
        if (drawStartSound && drawStartSound.readyState >= 1) {
            drawStartSound.currentTime = 0;
            drawStartSound.play().catch(e => console.error("Error playing start sound:", e));
        }

        // Disable buttons during animation
        drawButton.disabled = true;
        drawAgainBtn.disabled = true;

        // Animate numbers flickering
        const animationDuration = 3000; // 3 seconds
        const intervalTime = 50; // Update every 50ms
        lotteryAnimationInterval = setInterval(() => {
            const randomNumber = Math.floor(Math.random() * MAX_NUMBER) + 1;
            lotteryNumberFullscreen.textContent = randomNumber;
        }, intervalTime);

        // After the animation, decide the number
        setTimeout(() => {
            clearInterval(lotteryAnimationInterval);
            lotteryAnimationInterval = null; // Clear interval ID

            const randIndex = Math.floor(Math.random() * gameState.availableNumbers.length);
            const newNumber = gameState.availableNumbers.splice(randIndex, 1)[0];
            gameState.drawnNumbers.push(newNumber);

            lotteryNumberFullscreen.textContent = newNumber;
            lotteryNumberFullscreen.classList.remove('flickering');
            lotteryNumberFullscreen.classList.add('decided');
            currentNumberDisplay.textContent = newNumber;
            currentNumberDisplay.classList.add('decided');

            playRandomEndSound();
            updateDrawnNumbersHistory();
            checkCardForNumber(newNumber);

            lotteryOverlayControls.classList.remove('hidden');
            drawButton.disabled = gameState.isGameOver;
            drawAgainBtn.disabled = gameState.isGameOver;
        }, animationDuration);
    }

    /**
     * Updates the display of drawn numbers.
     */
    function updateDrawnNumbersHistory() {
        const numEl = document.createElement('div');
        numEl.textContent = gameState.drawnNumbers[gameState.drawnNumbers.length - 1];
        numEl.style.textAlign = 'center';
        drawnNumbersContainer.appendChild(numEl);
    }

    /**
     * Finds a number on the card and marks it as 'hit'.
     * @param {number} number The number that was drawn.
     */
    function checkCardForNumber(number) {
        const cell = bingoGrid.querySelector(`.bingo-cell[data-number="${number}"]`);
        if (cell) {
            cell.classList.add('hit');
            checkBingo();
        }
    }

    /**
     * Checks the card for any completed lines based on the current rule.
     */
    function checkBingo() {
        const cells = Array.from(bingoGrid.querySelectorAll('.bingo-cell'));
        if (cells.length !== BINGO_SIZE * BINGO_SIZE) return;

        // Convert flat array to 2D array for easier checking
        const markedState = [];
        for (let i = 0; i < BINGO_SIZE; i++) {
            markedState.push(
                cells.slice(i * BINGO_SIZE, (i + 1) * BINGO_SIZE).map(cell => cell.classList.contains('hit'))
            );
        }

        let completedLines = 0;
        // Check rows and columns
        for (let i = 0; i < BINGO_SIZE; i++) {
            if (markedState[i].every(marked => marked)) completedLines++; // Horizontal
            if (markedState.every(row => row[i])) completedLines++;      // Vertical
        }
        // Check diagonals
        if (markedState.every((row, i) => row[i])) completedLines++;
        if (markedState.every((row, i) => row[BINGO_SIZE - 1 - i])) completedLines++;

        if (completedLines >= gameState.requiredLines && !gameState.isGameOver) {
            // Show BINGO message and confetti for anyone who gets a bingo.
            bingoMessage.textContent = 'BINGO!';
            bingoMessage.classList.add('show');
            if (typeof confetti === 'function') triggerConfetti();

            // However, only stop the entire game if the user is a 'player'.
            // The admin can continue drawing numbers for others.
            if (gameState.role === 'player') {
                gameState.isGameOver = true;
                drawButton.disabled = true;
                drawAgainBtn.disabled = true;
            }
        }
    }

    /**
     * Triggers a celebratory confetti animation.
     */
    function triggerConfetti() {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

        function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
        }

        const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    }

    /**
     * Plays a random sound from the end sounds pool.
     */
    function playRandomEndSound() {
        // Filter out any sounds that failed to load
        const availableSounds = drawEndSounds.filter(sound => sound && sound.readyState >= 1);
        if (availableSounds.length === 0) return; // No sounds to play

        const sound = availableSounds[Math.floor(Math.random() * availableSounds.length)];
        sound.currentTime = 0; // Rewind to the start
        sound.play().catch(e => console.error("Error playing end sound:", e));
    }

    /**
     * Gathers settings and starts the game.
     */
    function startGame() {
        const selectedRole = document.querySelector('input[name="role"]:checked').value;
        const selectedLines = parseInt(document.querySelector('input[name="bingoRuleSetup"]:checked').value, 10);

        startScreen.style.display = 'none';
        gameContainer.style.display = 'flex';

        initializeGame(selectedRole, selectedLines);
    }

    /**
     * Sets up all the main event listeners for the application.
     */
    function setupEventListeners() {
        startGameBtn.addEventListener('click', () => {
            const selectedRole = document.querySelector('input[name="role"]:checked').value;
            if (selectedRole === 'admin') {
                soundModalOverlay.classList.remove('hidden');
            } else {
                startGame();
            }
        });

        drawButton.addEventListener('click', startLotteryAnimation);

        resetGameBtn.addEventListener('click', () => {
            gameContainer.style.display = 'none';
            startScreen.style.display = 'block';
        });
        resetCardBtn.addEventListener('click', () => {
            if (gameState.role === 'player') {
                // For players, go back to the setup screen without confirmation.
                gameContainer.style.display = 'none';
                startScreen.style.display = 'block';
            } else { // For admins
                // Show a confirmation dialog to prevent accidental clicks.
                if (window.confirm('現在のカードはリセットされます。新しいカードを作成しますか？')) {
                    createBingoCard();
                }
            }
        });

        confirmSoundBtn.addEventListener('click', () => {
            soundModalOverlay.classList.add('hidden');
            startGame();
        });

        // Lottery Overlay Listeners
        drawAgainBtn.addEventListener('click', startLotteryAnimation);

        backToLotteryBtn.addEventListener('click', () => {
            lotteryOverlay.classList.add('hidden');
        });

        // QR Code Modal Listeners
        shareBtn.addEventListener('click', () => {
            qrModalOverlay.classList.remove('hidden');
        });

        qrModalOverlay.addEventListener('click', () => {
            qrModalOverlay.classList.add('hidden');
        });
    }

    // --- INITIALIZATION ---
    setupTabs();
    setupEventListeners();
});
