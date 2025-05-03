// ===== GAME CONFIGURATION =====
const TYPING_SPEED = 35;
const XP_PER_LEVEL = 100;

// ===== DOM ELEMENTS =====
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
    saveBtn: document.getElementById('saveBtn'),
    successSound: document.getElementById('successSound'),
    errorSound: document.getElementById('errorSound'),
    levelUpSound: document.getElementById('levelUpSound'),
    container: document.querySelector('.container')
};

// ===== GAME STATE =====
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
        dailyCompletedToday: false,
        _version: 1.0
    }
};

// ===== PWA INSTALLATION STATE =====
let deferredPrompt = null;

// ===== STORAGE UTILITIES =====
const storage = {
    save: () => {
        try {
            localStorage.setItem('thinkoPlayerData', JSON.stringify(gameState.player));
            console.log('Game saved successfully');
        } catch (error) {
            console.error('Error saving game:', error);
        }
    },

    load: () => {
        try {
            const savedData = localStorage.getItem('thinkoPlayerData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                
                // Data migration for future updates
                if (!parsedData._version || parsedData._version < 1.0) {
                    parsedData._version = 1.0;
                }
                
                gameState.player = parsedData;
                
                // Ensure dates are properly handled
                if (gameState.player.lastPlayed) {
                    const lastPlayedDate = new Date(gameState.player.lastPlayed);
                    if (isNaN(lastPlayedDate.getTime())) {
                        gameState.player.lastPlayed = null;
                    } else {
                        gameState.player.lastPlayed = lastPlayedDate.toDateString();
                    }
                }
                
                console.log('Game loaded successfully');
                return true;
            }
        } catch (error) {
            console.error('Error loading game:', error);
        }
        return false;
    },

    clear: () => {
        localStorage.removeItem('thinkoPlayerData');
    }
};

// ===== GAME INITIALIZATION =====
function initGame() {
    // Load saved data
    if (!storage.load()) {
        console.log('No saved game found, starting fresh');
    }
    
    checkDailyReset();
    setupEventListeners();
    setupPWAInstall();
    fetchRiddle();
    updateStatsDisplay();
    
    // Auto-save every 5 minutes
    setInterval(() => storage.save(), 300000);
    
    // Save when window is closed
    window.addEventListener('beforeunload', () => storage.save());
}

// ===== GAME LOGIC FUNCTIONS =====
function checkDailyReset() {
    const today = new Date().toDateString();
    
    if (!gameState.player.lastPlayed) {
        // First time playing
        gameState.player.streak = 0;
        gameState.player.dailyCompletedToday = false;
    } else if (gameState.player.lastPlayed !== today) {
        // Check if consecutive day
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (gameState.player.lastPlayed === yesterday.toDateString()) {
            // Consecutive day - maintain streak
            gameState.player.dailyCompletedToday = false;
        } else {
            // Broken streak
            gameState.player.streak = 0;
            gameState.player.dailyCompletedToday = false;
        }
    }
    
    updateDailyBadge();
}

function updateStatsDisplay() {
    if (elements.levelDisplay) elements.levelDisplay.textContent = gameState.player.level;
    if (elements.streakDisplay) elements.streakDisplay.textContent = gameState.player.streak;
    if (elements.xpDisplay) elements.xpDisplay.textContent = `${gameState.player.xp}/${XP_PER_LEVEL}`;
    updateProgressBar();
    updateDailyBadge();
}

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

function updateDailyBadge() {
    if (!elements.dailyBadge) return;
    
    if (gameState.player.dailyCompletedToday) {
        elements.dailyBadge.innerHTML = '<span>DAILY ✓</span>';
        elements.dailyBadge.classList.add('completed');
    } else {
        elements.dailyBadge.innerHTML = '<span>DAILY</span>';
        elements.dailyBadge.classList.remove('completed');
    }
}

async function fetchRiddle(daily = false) {
    try {
        gameState.hintUsed = false;
        if (elements.hintBtn) elements.hintBtn.disabled = false;
        
        const endpoint = daily ? '/riddle/daily' : '/riddle';
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
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
        
        // Fallback to mock data if API fails
        gameState.currentRiddle = {
            id: 'mock-' + Date.now(),
            question: daily 
                ? "What has keys but no locks, space but no room, and you can enter but not go in?" 
                : "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
            hint: daily ? "You're using one right now" : "Mountain response"
        };
        
        if (elements.riddle) {
            elements.riddle.innerHTML = '';
            typeWriter(gameState.currentRiddle.question);
        }
    }
}

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

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.correct) {
            handleCorrectAnswer();
        } else {
            handleIncorrectAnswer();
        }
    } catch (error) {
        console.error('Error verifying answer:', error);
        
        // Fallback verification for mock data
        const mockAnswer = gameState.currentRiddle.answer?.toLowerCase();
        if (mockAnswer && userAnswer.toLowerCase() === mockAnswer) {
            handleCorrectAnswer();
        } else {
            handleIncorrectAnswer();
        }
    }
}

function handleCorrectAnswer() {
    const isDaily = elements.riddle && elements.riddle.classList.contains('daily-riddle');
    const today = new Date().toDateString();
    
    // Play success sound
    if (elements.successSound) {
        elements.successSound.currentTime = 0;
        elements.successSound.play();
    }
    
    // Streak logic
    if (gameState.player.lastPlayed !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (gameState.player.lastPlayed === yesterday.toDateString()) {
            gameState.player.streak += 1;
        } else if (!gameState.player.lastPlayed || gameState.player.lastPlayed !== today) {
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
    storage.save();
    
    // Clear input and get new riddle
    if (elements.answerInput) elements.answerInput.value = '';
    setTimeout(() => {
        fetchRiddle(false);
    }, isDaily ? 1500 : 1000);
}

function handleIncorrectAnswer() {
    if (elements.errorSound) {
        elements.errorSound.currentTime = 0;
        elements.errorSound.play();
    }
    
    // Add all animation classes
    if (elements.answerInput) {
        elements.answerInput.classList.remove('input-error', 'shake');
        void elements.answerInput.offsetWidth;
        elements.answerInput.classList.add('input-error');
    }
    
    if (elements.submitBtn) {
        elements.submitBtn.classList.remove('button-error', 'shake');
        void elements.submitBtn.offsetWidth;
        elements.submitBtn.classList.add('button-error');
    }
    
    if (elements.container) {
        elements.container.classList.remove('incorrect-animation', 'shake');
        void elements.container.offsetWidth;
        elements.container.classList.add('incorrect-animation');
    }
    
    // Remove animation classes after completion
    setTimeout(() => {
        if (elements.answerInput) {
            elements.answerInput.classList.remove('input-error', 'shake');
            elements.answerInput.style.borderColor = '';
            elements.answerInput.style.boxShadow = '';
        }
        
        if (elements.submitBtn) {
            elements.submitBtn.classList.remove('button-error', 'shake');
            elements.submitBtn.style.backgroundColor = '';
        }
        
        if (elements.container) {
            elements.container.classList.remove('incorrect-animation', 'shake');
        }
    }, 500);
    
    // Add slight vibration for mobile devices if supported
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
}

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

function showToast(message) {
    if (!elements.toast || !elements.toastMessage) return;
    
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('show');
    
    setTimeout(() => {
        elements.toast.classList.remove('show');
    }, 3000);
}

// ===== PWA INSTALLATION FUNCTIONS =====
function showInstallPromotion() {
    if (elements.installButton) {
        elements.installButton.style.display = 'flex';
        setTimeout(() => {
            elements.installButton.style.opacity = '1';
            elements.installButton.style.transform = 'translateY(0)';
        }, 100);
    }
}

function hideInstallPromotion() {
    if (elements.installButton) {
        elements.installButton.style.opacity = '0';
        elements.installButton.style.transform = 'translateY(20px)';
        setTimeout(() => {
            elements.installButton.style.display = 'none';
        }, 300);
    }
}

function setupPWAInstall() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallPromotion();
    });

    window.addEventListener('appinstalled', () => {
        hideInstallPromotion();
        deferredPrompt = null;
        showToast('Thinko installed successfully!');
    });

    if (elements.installButton) {
        elements.installButton.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                showToast('Installing Thinko...');
            }
            
            hideInstallPromotion();
            deferredPrompt = null;
        });
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
        hideInstallPromotion();
    }
}

// ===== EVENT LISTENERS SETUP =====
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
    
    // Save button
    if (elements.saveBtn) {
        elements.saveBtn.addEventListener('click', () => {
            storage.save();
            showToast('Progress saved!');
        });
    }
    
    // Share button
    if (elements.shareBtn) {
        elements.shareBtn.addEventListener('click', () => {
            if (navigator.share) {
                navigator.share({
                    title: 'Thinko - Riddle Game',
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

// ===== START THE GAME =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}
