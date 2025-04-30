// Game Configuration
const TYPING_SPEED = 30;
const XP_PER_LEVEL = 100;

// DOM Elements
const elements = {
    riddle: document.getElementById('riddle'),
    answerInput: document.getElementById('answerInput'),
    hintBtn: document.getElementById('hintBtn'),
    submitBtn: document.getElementById('submitBtn'),
    progressBar: document.getElementById('progressBar'),
    dailyBadge: document.getElementById('dailyChallenge'),
    levelDisplay: document.getElementById('levelDisplay'),
    streakDisplay: document.getElementById('streakDisplay'),
    xpDisplay: document.getElementById('xpDisplay'),
    toast: document.getElementById('achievementToast'),
    toastMessage: document.getElementById('toastMessage'),
    shareBtn: document.getElementById('shareBtn'),
    leaderboardBtn: document.getElementById('leaderboardBtn'),
    installButton: document.getElementById('installButton'),
    successSound: document.getElementById('successSound'),
    errorSound: document.getElementById('errorSound'),
    levelUpSound: document.getElementById('levelUpSound')
};


// Player State
let gameState = {
    currentRiddle: null,
    isTyping: false,
    typingTimeout: null,
    hintUsed: false,
    player: {
        level: 1,
        xp: 0,
        streak: 0,
        lastPlayed: null,
        dailyCompletedToday: false
    }
};

// Initialize game
function initGame() {
    checkDailyReset();
    setupEventListeners();
    setupPWAInstall();
    fetchRiddle();
}

// Check if daily challenge should reset
function checkDailyReset() {
    const today = new Date().toDateString();
    if (gameState.player.lastPlayed !== today) {
        gameState.player.dailyCompletedToday = false;
        gameState.player.streak = (gameState.player.lastPlayed && 
            (new Date(today) - new Date(gameState.player.lastPlayed) === 86400000)) ? 
            gameState.player.streak : 0;
    }
    updateDailyBadge();
}

// Update all stat displays
function updateStatsDisplay() {
    if (elements.levelDisplay) elements.levelDisplay.textContent = gameState.player.level;
    if (elements.streakDisplay) elements.streakDisplay.textContent = gameState.player.streak;
    if (elements.xpDisplay) elements.xpDisplay.textContent = `${gameState.player.xp}/${XP_PER_LEVEL}`;
    updateProgressBar();
    updateDailyBadge();
}

// Update progress bar
function updateProgressBar() {
    if (!elements.progressBar) return;
    
    const percentage = (gameState.player.xp / XP_PER_LEVEL) * 100;
    elements.progressBar.style.width = `${Math.min(100, percentage)}%`;
    
    if (percentage >= 100) {
        elements.progressBar.classList.add('level-up');
        setTimeout(() => {
            if (elements.progressBar) {
                elements.progressBar.classList.remove('level-up');
            }
        }, 1000);
    }
}

// Update daily challenge badge
function updateDailyBadge() {
    if (!elements.dailyBadge) return;
    
    if (gameState.player.dailyCompletedToday) {
        elements.dailyBadge.innerHTML = '<span>XP ✓</span>';
        elements.dailyBadge.classList.add('completed');
    } else {
        elements.dailyBadge.innerHTML = '<span>XP</span>';
        elements.dailyBadge.classList.remove('completed');
    }
}

// Fetch a random riddle
async function fetchRiddle(daily = false) {
    try {
        gameState.hintUsed = false;
        if (elements.hintBtn) elements.hintBtn.disabled = false;
        
        const endpoint = daily ? '/riddle/daily' : '/riddle';
        const response = await fetch(endpoint);
        gameState.currentRiddle = await response.json();
        
        if (elements.riddle) {
            elements.riddle.innerHTML = '';
            if (daily) {
                elements.riddle.classList.add('daily-riddle');
            } else {
                elements.riddle.classList.remove('daily-riddle');
            }
            
            typeWriter(gameState.currentRiddle.question);
        }
    } catch (error) {
        console.error('Error fetching riddle:', error);
        showToast('Failed to load riddle. Try again.');
    }
}

// Typewriter effect with single cursor
function typeWriter(text, i = 0, target = null, isHint = false) {
    if (i === 0) {
        gameState.isTyping = true;
        if (!target) {
            elements.riddle.innerHTML = '';
            target = elements.riddle;
        }
    }

    const targetElement = target || elements.riddle;
    if (!targetElement) return;

    if (i < text.length) {
        targetElement.innerHTML = text.substring(0, i + 1) + '<span class="blink"></span>';
        gameState.typingTimeout = setTimeout(() => typeWriter(text, i + 1, target, isHint), TYPING_SPEED);
    } else {
        gameState.isTyping = false;
    }
}

// Verify answer with server
async function verifyAnswer() {
    if (gameState.isTyping || !gameState.currentRiddle?.id || !elements.answerInput) return;

    const userAnswer = elements.answerInput.value.trim();
    if (!userAnswer) return;

    try {
        const response = await fetch('/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                riddle_id: gameState.currentRiddle.id,
                answer: userAnswer
            })
        });

        const result = await response.json();
        
        if (result.correct) {
            handleCorrectAnswer();
        } else {
            handleIncorrectAnswer();
        }
    } catch (error) {
        console.error('Error verifying answer:', error);
        showToast('Error verifying answer. Try again.');
    }
}

// Handle correct answer
async function handleCorrectAnswer() {
    const isDaily = elements.riddle && elements.riddle.classList.contains('daily-riddle');
    const today = new Date().toDateString();
    
    // Play success sound
    if (elements.successSound) {
        elements.successSound.currentTime = 0;
        elements.successSound.play();
    }
    
    // Update stats
    if (gameState.player.lastPlayed !== today) {
        if (gameState.player.lastPlayed && 
            (new Date(today) - new Date(gameState.player.lastPlayed) === 86400000)) {
            gameState.player.streak += 1;
        } else {
            gameState.player.streak = 1;
        }
    }
    
    gameState.player.lastPlayed = today;
    gameState.player.xp += isDaily ? 50 : 20;
    
    // Check for level up
    if (gameState.player.xp >= XP_PER_LEVEL) {
        gameState.player.level += 1;
        gameState.player.xp = gameState.player.xp % XP_PER_LEVEL;
        
        showToast(`Level Up! Now level ${gameState.player.level}`);
        if (elements.levelUpSound) {
            elements.levelUpSound.currentTime = 0;
            elements.levelUpSound.play();
        }
    }
    
    if (isDaily) {
        gameState.player.dailyCompletedToday = true;
        showToast('Daily challenge completed! +50 XP');
    } else {
        showToast('Correct! +20 XP');
    }
    
    updateStatsDisplay();
    
    // Clear input and get new riddle
    if (elements.answerInput) elements.answerInput.value = '';
    setTimeout(() => {
        fetchRiddle(false); // Always return to normal mode after any answer
    }, isDaily ? 1500 : 1000);
}

// Handle incorrect answer
function handleIncorrectAnswer() {
    if (elements.errorSound) {
        elements.errorSound.currentTime = 0;
        elements.errorSound.play();
    }
    
    if (elements.answerInput) {
        elements.answerInput.classList.remove('shake');
        void elements.answerInput.offsetWidth;
        elements.answerInput.classList.add('shake');
    }
    
    if (elements.submitBtn) {
        elements.submitBtn.classList.remove('shake');
        void elements.submitBtn.offsetWidth;
        elements.submitBtn.classList.add('shake');
    }
    
    setTimeout(() => {
        if (elements.answerInput) elements.answerInput.classList.remove('shake');
        if (elements.submitBtn) elements.submitBtn.classList.remove('shake');
    }, 500);
}

// Show hint (below the line)
function showHint() {
    if (gameState.isTyping || !gameState.currentRiddle?.hint || !elements.riddle || gameState.hintUsed) return;

    gameState.hintUsed = true;
    if (elements.hintBtn) elements.hintBtn.disabled = true;
    
    // Save current riddle text
    const riddleText = elements.riddle.innerHTML;
    
    // Create new container with riddle text and separator
    elements.riddle.innerHTML = `
        <div class="riddle-text">${riddleText.replace('<span class="blink"></span>', '')}</div>
        <div class="hint-separator">-----</div>
        <div class="hint-container"></div>
    `;
    
    // Type out the hint in the hint container
    const hintContainer = elements.riddle.querySelector('.hint-container');
    typeWriter(gameState.currentRiddle.hint, 0, hintContainer, true);
}

// Show toast notification
function showToast(message) {
    if (!elements.toast || !elements.toastMessage) return;
    
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ===== PWA INSTALLATION HANDLER ===== //
let deferredPrompt;

function showInstallButton() {
    if (elements.installButton) {
        elements.installButton.style.display = 'flex';
        setTimeout(() => {
            elements.installButton.classList.add('visible');
        }, 100);
    }
}

function hideInstallButton() {
    if (elements.installButton) {
        elements.installButton.classList.remove('visible');
        setTimeout(() => {
            elements.installButton.style.display = 'none';
        }, 300);
    }
}

function setupPWAInstall() {
    // Listen for beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
        hideInstallButton();
        deferredPrompt = null;
        showToast('Thinko installed successfully!');
    });

    // Handle install button click
    elements.installButton?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            showToast('Installing Thinko...');
        }
        
        hideInstallButton();
        deferredPrompt = null;
    });

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
        hideInstallButton();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Answer submission
    if (elements.answerInput) {
        elements.answerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') verifyAnswer();
        });
    }
    
    if (elements.submitBtn) {
        elements.submitBtn.addEventListener('click', verifyAnswer);
    }
    
    // Hint button
    if (elements.hintBtn) {
        elements.hintBtn.addEventListener('click', showHint);
    }
    
    // Daily challenge toggle
    if (elements.dailyBadge) {
        elements.dailyBadge.addEventListener('click', () => {
            if (gameState.player.dailyCompletedToday) return;
            fetchRiddle(true);
        });
    }
    
    // Share button
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Thinko - Matrix Riddle Game',
                    text: `I'm level ${gameState.player.level} on Thinko! Can you beat me?`,
                    url: window.location.href
                }).catch(console.error);
            } else {
                alert('Share this game with your friends!');
            }
        });
    }
    
    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed: ', err));
    }
}

// Start the game when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
