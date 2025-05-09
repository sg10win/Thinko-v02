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


// ===== HEXAGON ANIMATION =====
function initHexagonAnimation() {
  const canvas = document.getElementById('hexagonCanvas');
  const container = document.querySelector('.hexagon-container');
  
  // Set canvas size
  function resizeCanvas() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  const ctx = canvas.getContext('2d');
  const center = { x: canvas.width/2, y: canvas.height/2 };
  const hexRadius = Math.min(canvas.width, canvas.height) * 0.4;
  const ballRadius = hexRadius * 0.08;
  
  // Physics properties
  let hexRotation = 0;
  const hexSpeed = 0.005;
  let ballPos = { x: 0, y: 0 };
  let ballVel = { 
    x: hexRadius * 0.02 * (Math.random() > 0.5 ? 1 : -1), 
    y: hexRadius * 0.02 * (Math.random() > 0.5 ? 1 : -1) 
  };
  const gravity = 0.0004;
  const bounce = 1.0; // Perfect bounce (no energy loss)

  function getHexVertices() {
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angle = hexRotation + i * Math.PI/3;
      vertices.push({
        x: Math.cos(angle) * hexRadius,
        y: Math.sin(angle) * hexRadius
      });
    }
    return vertices;
  }

  function checkCollisions() {
    const vertices = getHexVertices();
    
    for (let i = 0; i < 6; i++) {
      const p1 = vertices[i];
      const p2 = vertices[(i+1)%6];
      
      // Edge vector and normal
      const edge = { x: p2.x-p1.x, y: p2.y-p1.y };
      const edgeLen = Math.sqrt(edge.x*edge.x + edge.y*edge.y);
      const normal = { x: -edge.y/edgeLen, y: edge.x/edgeLen };
      
      // Distance from ball to edge
      const ballToEdge = { x: ballPos.x-p1.x, y: ballPos.y-p1.y };
      const dist = ballToEdge.x*normal.x + ballToEdge.y*normal.y;
      
      if (dist < ballRadius) {
        // Collision response
        const dot = ballVel.x*normal.x + ballVel.y*normal.y;
        ballVel.x -= 2 * dot * normal.x * bounce;
        ballVel.y -= 2 * dot * normal.y * bounce;
        
        // Reposition ball
        const correction = (ballRadius - dist) * 1.01;
        ballPos.x += normal.x * correction;
        ballPos.y += normal.y * correction;
      }
    }
  }

  function update() {
    // Apply moon gravity
    ballVel.y += gravity;
    
    // Update position
    ballPos.x += ballVel.x;
    ballPos.y += ballVel.y;
    
    // Check collisions
    checkCollisions();
    
    // Rotate hexagon
    hexRotation += hexSpeed;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(center.x, center.y);
    
    // Draw hexagon
    ctx.beginPath();
    const vertices = getHexVertices();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.closePath();
    ctx.strokeStyle = `rgba(${getComputedStyle(document.documentElement)
      .getPropertyValue('--deepseek-blue-rgb')}, 0.5)`;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Draw ball
    ctx.beginPath();
    ctx.arc(ballPos.x, ballPos.y, ballRadius, 0, Math.PI*2);
    ctx.fillStyle = `rgba(${getComputedStyle(document.documentElement)
      .getPropertyValue('--deepseek-light-blue-rgb')}, 0.8)`;
    ctx.fill();
    
    // Ball highlight
    ctx.beginPath();
    ctx.arc(ballPos.x-ballRadius*0.3, ballPos.y-ballRadius*0.3, 
            ballRadius*0.2, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    
    ctx.restore();
  }

  function animate() {
    update();
    draw();
    requestAnimationFrame(animate);
  }

  // Random starting position
  ballPos = {
    x: (Math.random()-0.5) * hexRadius*0.8,
    y: (Math.random()-0.5) * hexRadius*0.8
  };

  animate();
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
    initHexagonAnimation();
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
