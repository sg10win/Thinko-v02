// ===== GAME CONFIGURATION =====
const TYPING_SPEED = 20;
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
    container: document.querySelector('.container'),
    correctFeedback: document.querySelector('.correct-feedback'),

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








function checkColorScheme() {
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark-mode', isDarkMode);
  
  // Optional: Save user preference
  if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.classList.add('dark-mode');
  } else if (localStorage.getItem('darkMode') === 'false') {
    document.documentElement.classList.remove('dark-mode');
  }
}




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
    // Listen for system color scheme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', checkColorScheme);

// Run on initial load
    document.addEventListener('DOMContentLoaded', checkColorScheme);
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

    if (isDaily) {
        // Only update daily completion if it's a daily riddle
        gameState.player.dailyCompletedToday = true;
        updateDailyBadge(); // Update the visual state immediately
        
        // Disable the daily badge click handler
        elements.dailyBadge.style.pointerEvents = 'none';
        
        // Re-enable after a short delay to prevent accidental clicks
        setTimeout(() => {
            elements.dailyBadge.style.pointerEvents = 'auto';
        }, 1000);
    }
    // Play success sound
    if (elements.successSound) {
        elements.successSound.currentTime = 0;
        elements.successSound.play();
    }
    
    // Show correct feedback
    if (elements.correctFeedback) {
        elements.correctFeedback.textContent = isDaily ? 'Daily Challenge Complete!' : 'Correct Answer!';
        elements.correctFeedback.classList.add('show');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            elements.correctFeedback.classList.remove('show');
        }, 3000);
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
        
        if (elements.levelUpSound) {
            elements.levelUpSound.currentTime = 0;
            elements.levelUpSound.play();
        }
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
//////////////////
document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const canvas = document.getElementById('hexagonCanvas');
    const container = document.querySelector('.container');
    const rotationControl = document.getElementById('rotationSpeed');
    
    // Setup
    let hexagonRotationSpeed = parseFloat(rotationControl.value);
    rotationControl.addEventListener('input', () => {
        hexagonRotationSpeed = parseFloat(rotationControl.value);
    });

    // Canvas setup
    function resizeCanvas() {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const ctx = canvas.getContext('2d');
    const containerSize = Math.min(canvas.width, canvas.height);

    // Physics constants
    const HEXAGON_RADIUS = containerSize * 0.375;
    const BALL_RADIUS = containerSize * 0.0375;
    const MOON_GRAVITY = containerSize * 0.0004125; // 1.62 m/s² scaled

    // State
    let hexagonRotation = 0;
    let ballPosition = { x: 0, y: 0 };
    let ballVelocity = { 
        x: containerSize * 0.005 * (Math.random() > 0.5 ? 1 : -1),
        y: containerSize * 0.005 * (Math.random() > 0.5 ? 1 : -1)
    };

    // Init ball with random position
    function initBall() {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (HEXAGON_RADIUS - BALL_RADIUS * 2);
        ballPosition = {
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance
        };
    }

    // Get hexagon vertices
    function getHexagonVertices(rotation) {
        return Array.from({ length: 6 }, (_, i) => {
            const angle = rotation + i * Math.PI / 3;
            return {
                x: Math.cos(angle) * HEXAGON_RADIUS,
                y: Math.sin(angle) * HEXAGON_RADIUS
            };
        });
    }

    // Perfect collision detection
    function handleCollisions() {
        const vertices = getHexagonVertices(hexagonRotation);
        
        vertices.forEach((p1, i) => {
            const p2 = vertices[(i + 1) % 6];
            const edge = { x: p2.x - p1.x, y: p2.y - p1.y };
            const normal = { x: -edge.y, y: edge.x };
            const length = Math.sqrt(normal.x**2 + normal.y**2);
            normal.x /= length;
            normal.y /= length;

            // Distance from ball to edge
            const ballToEdge = ballPosition.x * normal.x + ballPosition.y * normal.y;
            const p1ToEdge = p1.x * normal.x + p1.y * normal.y;
            const distance = ballToEdge - p1ToEdge;

            if (distance < BALL_RADIUS) {
                // Perfect elastic collision
                const velocityDot = ballVelocity.x * normal.x + ballVelocity.y * normal.y;
                ballVelocity.x -= 2 * velocityDot * normal.x;
                ballVelocity.y -= 2 * velocityDot * normal.y;

                // Precise reposition (no sticking)
                const overlap = BALL_RADIUS - distance;
                ballPosition.x += normal.x * overlap * 1.001;
                ballPosition.y += normal.y * overlap * 1.001;
            }
        });
    }

    // Update game state
    function update() {
        // Apply moon gravity
        ballVelocity.y += MOON_GRAVITY;
        
        // Update positions
        ballPosition.x += ballVelocity.x;
        ballPosition.y += ballVelocity.y;
        
        // Handle collisions
        handleCollisions();
        
        // Rotate hexagon
        hexagonRotation += hexagonRotationSpeed;
    }

    // Render frame
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Center coordinate system
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);

        // Draw hexagon
        ctx.beginPath();
        const vertices = getHexagonVertices(hexagonRotation);
        ctx.moveTo(vertices[0].x, vertices[0].y);
        vertices.slice(1).forEach(v => ctx.lineTo(v.x, v.y));
        ctx.closePath();
        ctx.strokeStyle = 'var(--deepseek-blue)';
        ctx.lineWidth = containerSize * 0.008;
        ctx.stroke();

        // Draw ball
        ctx.beginPath();
        ctx.arc(ballPosition.x, ballPosition.y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = 'var(--accent-orange)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = containerSize * 0.002;
        ctx.stroke();

        ctx.restore();
    }

    // Animation loop
    function animate() {
        update();
        draw();
        requestAnimationFrame(animate);
    }

    // Start
    initBall();
    animate();
});

//////////////////////////////
    
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
