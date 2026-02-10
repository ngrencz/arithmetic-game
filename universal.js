// --- Supabase Setup ---
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Get login and game info ---
const params = new URLSearchParams(window.location.search);
const lastname = params.get('lastname') || localStorage.getItem('mathgame_lastname') || "";
const hour = params.get('hour') || localStorage.getItem('mathgame_hour') || "";

let selectedLevel = 1; 

// --- Determine the game type ---
// 0=Sun, 1=Mon... Friday is index 4.
let gameType = params.get("game") || ["addition", "subtraction", "multiplication", "division", "roots"][((new Date()).getDay()+6)%7 % 5];

let options = {
    add: false, sub: false, mul: false, div: false, sqrt: false, exp: false,
    left_min: 2, left_max: 12, right_min: 2, right_max: 12,
    duration: 180
};

// Initial switch sets the base game type
switch(gameType) {
    case "addition": options.add = true; break;
    case "subtraction": options.sub = true; break;
    case "multiplication": options.mul = true; break;
    case "division": options.div = true; break;
    case "exponents": options.exp = true; break;
}

$(document).ready(function() {
    $('.level-btn').on('click', function() {
        selectedLevel = parseInt($(this).data('level')); 
        
        if (selectedLevel === 2) {
            // Level 2: Negative numbers enabled
            options.left_min = -12;
            options.right_min = -12;
            
            if (gameType === "roots") {
                options.sqrt = true;
                options.exp = false; 
            }
        } else {
            // Level 1: Strictly positive
            options.left_min = 2; 
            options.right_min = 2;

            if (gameType === "roots") {
                options.sqrt = false; 
                options.exp = true;  // Level 1 Friday = Exponents
            }
        }

        $('#level-select').hide();
        $('.start').show();
        startGame();
    });
});

// --- Database Helpers ---
async function fetchTotalPoints(lastname, hour) {
  if (!lastname || !hour) return 0;
  const { data, error } = await supabase.from('scores').select('points').eq('lastname', lastname).eq('hour', hour);
  return (error || !data) ? 0 : data.reduce((sum, row) => sum + (row.points || 0), 0);
}

async function fetchBestScore(lastname, hour, gameType) {
  if (!lastname || !hour || !gameType) return 0;
  const { data, error } = await supabase.from('scores').select('score').eq('lastname', lastname).eq('hour', hour).eq('game_type', gameType);
  return (error || !data) ? 0 : data.reduce((max, row) => Math.max(max, row.score || 0), 0);
}

function rand(n) { return Math.floor(Math.random() * n); }
function randRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function submitScoreToSupabase(lastname, hour, gameType, score, points) {
    await supabase.from('scores').insert([{ lastname, hour, game_type: gameType, score, points }]);
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
    return { bestScore: Math.max(currentScore, bestScore), points, beatBest, sessionPoints };
}

function startGame() {
  if (lastname) {
    Promise.all([fetchBestScore(lastname, hour, gameType), fetchTotalPoints(lastname, hour)]).then(([bestScore, points]) => {
      $('.left').html(`<span class="game-userinfo">${lastname} (${hour}) | Lvl: ${selectedLevel} | Best: ${bestScore} | Points: ${points}</span><br><br><span class="game-seconds">Seconds left: <span class="seconds">0</span></span>`);
      init(options);
    });
  }
}

// --- Main Game Engine ---
function init(options) {
    let problemStartTime;
    const game = $('#game');
    const problem = game.find('.problem');
    const answer = game.find('.answer');
    const banner = game.find('.banner');
    const correct = game.find('.correct');
    answer.focus();

    function pg_add() {
        const left = randRange(options.left_min, options.left_max);
        const right = randRange(options.right_min, options.right_max);
        const displayRight = right < 0 ? `(${right})` : right;
        return { prettyProblem: left + ' + ' + displayRight, answer: left + right };
    }

    function pg_sub() {
        let left = randRange(options.left_min, options.left_max);
        let right = randRange(options.right_min, options.right_max);
        if (selectedLevel === 1) {
            const tempLeft = Math.max(left, right);
            const tempRight = Math.min(left, right);
            left = tempLeft;
            right = tempRight;
        }
        const displayRight = right < 0 ? `(${right})` : right;
        return { prettyProblem: left + ' – ' + displayRight, answer: left - right };
    }

    function pg_mul() {
        const left = randRange(options.left_min, options.left_max);
        const right = randRange(options.right_min, options.right_max);
        const displayRight = right < 0 ? `(${right})` : right;
        return { prettyProblem: left + ' × ' + displayRight, answer: left * right };
    }

    function pg_div() {
        let divisor = 0;
        while (divisor === 0) { divisor = randRange(options.left_min, options.left_max); }
        const quotient = randRange(options.right_min, options.right_max);
        const dividend = divisor * quotient;
        const displayDivisor = divisor < 0 ? `(${divisor})` : divisor;
        return { prettyProblem: dividend + ' ÷ ' + displayDivisor, answer: quotient };
    }

    function pg_sqrt() {
        if (Math.random() > 0.3) {
            const root = randRange(1, 12);
            return { prettyProblem: '√' + (root * root), answer: root };
        } else {
            const root = randRange(1, 3);
            const cube = Math.pow(root, 3);
            return { prettyProblem: '∛' + cube, answer: root };
        }
    }

    function pg_exp() {
        const base = randRange(1, 12);
        let exp = (base <= 3) ? randRange(0, 3) : randRange(0, 2);
        const sup = {0:"⁰", 1:"¹", 2:"²", 3:"³"};
        return { prettyProblem: base + sup[exp], answer: Math.pow(base, exp) };
    }

    const pgs = [];
    if (options.add) pgs.push(pg_add);
    if (options.sub) pgs.push(pg_sub);
    if (options.mul) pgs.push(pg_mul);
    if (options.div) pgs.push(pg_div);
    if (options.exp) pgs.push(pg_exp);
    if (options.sqrt) pgs.push(pg_sqrt);

    let genned;
    function problemGeng() {
        genned = pgs[rand(pgs.length)]();
        problemStartTime = Date.now();
        problem.text(genned.prettyProblem);
        answer.val('');
    }

    let correct_ct = 0;
    const startTime = Date.now();
    problemGeng();

    answer.on('input', function (e) {
        if (e.currentTarget.value.trim() === String(genned.answer)) {
            correct_ct++;
            $('.correct').first().text('Score: ' + correct_ct);
            problemGeng();
        }
    });

    const timer = setInterval(function () {
        const d = options.duration - Math.floor((Date.now() - startTime) / 1000);
        $('.seconds').text(Math.max(0, d));
        if (d <= 0) {
            clearInterval(timer);
            answer.prop('disabled', true);
            // Saves Level 2 scores with a suffix for clarity in DB
            const dbType = selectedLevel === 2 ? `${gameType}_lvl2` : gameType;
            fetchBestScore(lastname, hour, dbType).then(best => {
                const res = updateScoreAndPoints(correct_ct, best);
                submitScoreToSupabase(lastname, hour, dbType, correct_ct, res.sessionPoints);
                banner.find('.start').hide();
                banner.find('.end').show().find('.correct').html(`Score: ${correct_ct}<br>Best: ${res.bestScore}`);
                setTimeout(() => { window.location.href = 'points.html'; }, 3000);
            });
        }
    }, 1000);
}

$(document).on('click', '#try-again', function() { location.reload(); });
