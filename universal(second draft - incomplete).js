// --- Supabase Setup ---
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Get login and game info ---
const params = new URLSearchParams(window.location.search);
const lastname = params.get('lastname') || localStorage.getItem('mathgame_lastname') || "";
const hour = params.get('hour') || localStorage.getItem('mathgame_hour') || "";

// --- NEW: Level Variable ---
let selectedLevel = 1; // Default to 1

// --- Determine the game type ---
// Changed "exponents" to "roots" for Friday
let gameType =
  params.get("game") ||
  ["addition", "subtraction", "multiplication", "division", "roots"][((new Date()).getDay()+6)%7 % 5];

// --- Game settings by type ---
let options = {
    add: false, sub: false, mul: false, div: false, sqrt: false, exp: false,
    left_min: 2, left_max: 12, right_min: 2, right_max: 12,
    duration: 180
};
switch(gameType) {
    case "addition": options.add = true; break;
    case "subtraction": options.sub = true; break;
    case "multiplication": options.mul = true; break;
    case "division": options.div = true; break;
    case "exponents": options.exp = true; break; 
    case "roots": options.sqrt = true; break;
}

// --- NEW: Handle Level Selection Buttons ---
$(document).ready(function() {
    $('.level-btn').on('click', function() {
        selectedLevel = parseInt($(this).data('level')); // Set level to 1 or 2
        
        // If Level 2, change the range to include negatives
        if (selectedLevel === 2) {
            options.left_min = -12;
            options.right_min = -12;
        }

        $('#level-select').hide(); // Hide the choice buttons
        $('.start').show();        // Show the game area
        startGame();               // Start the data fetch and game logic
    });
});

async function fetchTotalPoints(lastname, hour) {
  if (!lastname || !hour) return 0;
  const { data, error } = await supabase
    .from('scores')
    .select('points')
    .eq('lastname', lastname)
    .eq('hour', hour);
  if (error || !data) {
    console.error('Points fetch error:', error);
    return 0;
  }
  return data.reduce((sum, row) => sum + (row.points || 0), 0);
}

async function fetchBestScore(lastname, hour, gameType) {
  if (!lastname || !hour || !gameType) return 0;
  const { data, error } = await supabase
    .from('scores')
    .select('score')
    .eq('lastname', lastname)
    .eq('hour', hour)
    .eq('game_type', gameType);

  if (error || !data) {
    console.error('Best score fetch error:', error);
    return 0;
  }
  return data.reduce((max, row) => Math.max(max, row.score || 0), 0);
}
function rand(n) { return Math.floor(Math.random() * n); }

// NEW: Helper for negative ranges (e.g., -12 to 12)
function randRange(min, max) { 
    return Math.floor(Math.random() * (max - min + 1)) + min; 
}

function getBestAndPoints() {
    const keyBest = `mathgame_${lastname}_${hour}_bestscore_${gameType}`;
    const keyPoints = `mathgame_${lastname}_${hour}_points`;
    let bestScore = Number(localStorage.getItem(keyBest)) || 0;
    let points = Number(localStorage.getItem(keyPoints)) || 0;
    return { bestScore, points };
}

async function submitScoreToSupabase(lastname, hour, gameType, score, points) {
    const { data, error } = await supabase
        .from('scores') 
        .insert([{ lastname, hour, game_type: gameType, score, points }]);
    if (error) {
        console.error(error.message);
    } else {
        console.log('Score submitted:', data);
    }
}

function updateScoreAndPoints(currentScore, bestScoreFromDB) {
    if (!lastname || !hour) return;
    const keyBest = `mathgame_${lastname}_${hour}_bestscore_${gameType}`;
    const keyPoints = `mathgame_${lastname}_${hour}_points`;

    let bestScore = typeof bestScoreFromDB === 'number' ? bestScoreFromDB : Number(localStorage.getItem(keyBest)) || 0;
    let points = Number(localStorage.getItem(keyPoints)) || 0;

    let beatBest = false;
    let sessionPoints = 0;

    if (currentScore > bestScore) {
        localStorage.setItem(keyBest, currentScore); 
        points++;
        localStorage.setItem(keyPoints, points);
        beatBest = true;
        sessionPoints = 1;
    }
    
    return {
        bestScore: Math.max(currentScore, bestScore),
        points,
        beatBest,
        sessionPoints
    };
}

    return {
        bestScore: Math.max(currentScore, bestScore),
        points,
        beatBest,
        sessionPoints
    };
}
// --- Game UI Setup and Logic ---
function startGame() {
  if (lastname) {
    Promise.all([
      fetchBestScore(lastname, hour, gameType),
      fetchTotalPoints(lastname, hour)
    ]).then(([bestScore, points]) => {
      $('.left').html(
        `<span class="game-userinfo">${lastname} (${hour}) | Lvl: ${selectedLevel} | Best: ${bestScore} | Points: ${points}</span><br><br>` +
        `<span class="game-seconds">Seconds left: <span class="seconds">0</span></span>`
      );
      // --- Main Game Logic ---
      init(options);
    });
  }
}

function init(options) {
    let problemStartTime;
    const game = $('#game');
    const d_left = game.find('.left');
    const correct = game.find('.correct');
    const banner = game.find('.banner');
    const problem = game.find('.problem');
    const answer = game.find('.answer');
    answer.focus();

    // Use the values from our options (which change based on Level 1 or 2)
    const leftMin = options.left_min;
    const leftMax = options.left_max;
    const rightMin = options.right_min;
    const rightMax = options.right_max;
   // --- Problem Generators ---
    function pg_add() {
        const left = randRange(options.left_min, options.left_max);
        const right = randRange(options.right_min, options.right_max);
        const displayRight = right < 0 ? `(${right})` : right;
        return { prettyProblem: left + ' + ' + displayRight, plainProblem: left + ' + ' + right, answer: left + right };
    }

    function pg_sub() {
        const left = randRange(options.left_min, options.left_max);
        const right = randRange(options.right_min, options.right_max);
        const displayRight = right < 0 ? `(${right})` : right;
        return { prettyProblem: left + ' – ' + displayRight, plainProblem: left + ' - ' + right, answer: left - right };
    }

    function pg_mul() {
        const left = randRange(options.left_min, options.left_max);
        const right = randRange(options.right_min, options.right_max);
        const displayRight = right < 0 ? `(${right})` : right;
        return { prettyProblem: left + ' × ' + displayRight, plainProblem: left + ' * ' + right, answer: left * right };
    }

    function pg_div() {
        const divisor = randRange(options.left_min, options.left_max) || 1; 
        const quotient = randRange(options.right_min, options.right_max);
        const dividend = divisor * quotient;
        const displayDivisor = divisor < 0 ? `(${divisor})` : divisor;
        return { prettyProblem: dividend + ' ÷ ' + displayDivisor, plainProblem: dividend + ' / ' + divisor, answer: quotient };
    }

    function exponentProblems() {
        const problems = [];
        for (let base = 1; base <= 12; base++) {
            problems.push({base, exponent: 0}, {base, exponent: 1}, {base, exponent: 2});
        }
        for (let base = 1; base <= 3; base++) { problems.push({base, exponent: 3}); }
        for (let base = 1; base <= 2; base++) { problems.push({base, exponent: 4}); }
        problems.push({base: 1, exponent: 5});
        return problems;
    }

    function powInt(base, exponent) {
        return Math.pow(base, exponent);
    }

    function pg_sqrt() {
        // Friday Level 2: Mixture of square roots and cube roots
        if (selectedLevel === 2) {
            const isCube = Math.random() < 0.3; // 30% chance of a cube root
            if (isCube) {
                const cubes = [1, 8, 27];
                const val = cubes[rand(cubes.length)];
                const root = val === 1 ? 1 : (val === 8 ? 2 : 3);
                return { prettyProblem: '∛' + val, plainProblem: 'cbrt(' + val + ')', answer: root };
            }
        }
        // Standard Square Roots (Level 1, and 70% of Level 2)
        const root = randRange(1, 12);
        const square = root * root;
        return { prettyProblem: '√' + square, plainProblem: 'sqrt(' + square + ')', answer: root };
    }

    function formatSuperscript(n) {
        const sup = {0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵"};
        return n.toString().split('').map(d=>sup[d]||d).join('');
    }

    function pg_exp() {
        const probs = exponentProblems();
        const pair = probs[rand(probs.length)];
        return {
            prettyProblem: pair.base + formatSuperscript(pair.exponent),
            plainProblem: pair.base + "^" + pair.exponent,
            answer: powInt(pair.base, pair.exponent)
        };
    }
 // --- Array of enabled problem generators ---
    const pgs = [];
    if (options.add) pgs.push(pg_add);
    if (options.sub) pgs.push(pg_sub);
    if (options.mul) pgs.push(pg_mul);
    if (options.div) pgs.push(pg_div);
    if (options.exp) pgs.push(pg_exp);
    if (options.sqrt) pgs.push(pg_sqrt);

    function problemGen() {
        let genned;
        while (genned == null) {
            genned = pgs[rand(pgs.length)]();
        }
        return genned;
    }

    let genned, thisProblemLog;
    function problemGeng() {
        genned = problemGen();
        thisProblemLog = { problem: genned.plainProblem, answer: genned.answer, entry: [], timeMs: -1 };
        problem.text(genned.prettyProblem);
        answer.val('');
    }

    const startTime = (problemStartTime = Date.now());
    let correct_ct = 0;
    const problemLog = [];

    answer.on('input', function (e) {
        const value = e.currentTarget.value;
        
        // Validation logic: Ensure users can type numbers and negative signs
        if (thisProblemLog.entry) {
            const lastEntry = thisProblemLog.entry[thisProblemLog.entry.length - 1] ?? '';
            // Updated regex [^-\d\s] to allow the negative sign "-"
            if (value.length - lastEntry.length > 1 || /[^-\d\s]/.test(value) || lastEntry.length >= 3 + String(genned.answer).length) {
                thisProblemLog.entry = null;
            } else {
                thisProblemLog.entry.push(value);
            }
        }

        // Check if the answer is correct
        if (value.trim() === String(genned.answer)) {
            const now = Date.now();
            thisProblemLog.timeMs = now - problemStartTime;
            problemLog.push(thisProblemLog);
            problemStartTime = now;
            problemGeng();
            correct.text('Score: ' + ++correct_ct);
        }
        return true;
    });

    // Start the first problem
    problemGeng();
 const duration = options.duration || 180;
    const timer = setInterval(function () {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const d = duration - elapsed;
        $('.seconds').text(Math.max(0, d));

        if (d <= 0) {
            // ---- END OF GAME BLOCK ----
            clearInterval(timer);
            answer.prop('disabled', true);

            banner.find('.start').hide();
            banner.find('.end').show();

            // Create a specific key for Level 2 so scores stay separate
            const dbGameType = selectedLevel === 2 ? `${gameType}_lvl2` : gameType;

            // Fetch best score from Supabase, THEN decide if a point is earned
            fetchBestScore(lastname, hour, dbGameType).then(bestScoreSupabase => {
                const result = updateScoreAndPoints(correct_ct, bestScoreSupabase);
                
                // Submit the score and the earned point (if they beat their best)
                submitScoreToSupabase(lastname, hour, dbGameType, correct_ct, result.sessionPoints);

                let message = `Score: ${correct_ct}`;
                if (result && result.beatBest) { message += " (New best!)"; }

                // Update UI with latest scores from DB
                Promise.all([
                    fetchBestScore(lastname, hour, dbGameType),
                    fetchTotalPoints(lastname, hour)
                ]).then(([bestScore, points]) => {
                    message += `<br>Your best: ${bestScore}`;
                    message += `<br>Your points: ${points}`;
                    banner.find('.end .correct').html(message);
                    
                    $('.left').html(
                        `<span class="game-userinfo">${lastname} (${hour}) | Lvl: ${selectedLevel} | Best: ${bestScore} | Points: ${points}</span><br><br>` +
                        `<span class="game-seconds">Seconds left: <span class="seconds">0</span></span>`
                    );
                });

                // Redirect to points page after a short delay
                setTimeout(function() {
                    window.location.href = 'points.html';
                }, 3000); // 3 seconds so they can see their score
            });
        }
    }, 1000);
}

// Restart handler
$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    location.reload();
});
