// --- Supabase Setup ---
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Get login and game info ---
const params = new URLSearchParams(window.location.search);
const lastname = params.get('lastname') || localStorage.getItem('mathgame_lastname') || "";
const hour = params.get('hour') || localStorage.getItem('mathgame_hour') || "";
// --- Determine the game type ---
// Priority: query param "game", otherwise day-of-week logic
let gameType =
  params.get("game") ||
  ["addition", "subtraction", "multiplication", "division", "exponents"][((new Date()).getDay()+6)%7 % 5]; // 0=Sun->Fri=4

// You can further customize to handle days as needed (see below).

// --- Game settings by type ---
let options = {
    add: false, sub: false, mul: false, div: false,
    add_left_min: 2, add_left_max: 12, add_right_min: 2, add_right_max: 12,
    mul_left_min: 2, mul_left_max: 12, mul_right_min: 2, mul_right_max: 12,
    duration: 180
};

switch(gameType) {
    case "addition": options.add = true; break;
    case "subtraction": options.sub = true; break;
    case "multiplication": options.mul = true; break;
    case "division": options.div = true; break;
    case "exponents": options.exp = true; break; 
}
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

function getBestAndPoints() {
    const keyBest = `mathgame_${lastname}_${hour}_bestscore_${gameType}`;
    const keyPoints = `mathgame_${lastname}_${hour}_points`;
    let bestScore = Number(localStorage.getItem(keyBest)) || 0;
    let points = Number(localStorage.getItem(keyPoints)) || 0;
    return { bestScore, points };
}

async function submitScoreToSupabase(lastname, hour, gameType, score, points) {
    const { data, error } = await supabase
        .from('scores') // Match your actual table name!
        .insert([{ lastname, hour, game_type: gameType, score, points }]);
    if (error) {
        console.error(error.message);
    } else {
        console.log('Score submitted:', data);
    }
}

function updateScoreAndPoints(currentScore) {
    if (!lastname || !hour) return;
    const keyBest = `mathgame_${lastname}_${hour}_bestscore_${gameType}`;
    const keyPoints = `mathgame_${lastname}_${hour}_points`;

    let bestScore = Number(localStorage.getItem(keyBest)) || 0;
    let points = Number(localStorage.getItem(keyPoints)) || 0;
    let beatBest = false;
    let sessionPoints = 0;

    if (currentScore > bestScore) {
        localStorage.setItem(keyBest, currentScore);
        points++; // increment for beating best
        localStorage.setItem(keyPoints, points);
        beatBest = true;
        sessionPoints = 1; // the point earned *this session*
    }

    // sessionPoints is either 1 (if best beaten) or 0
    return {
        bestScore: Math.max(currentScore, bestScore),
        points,                     // total, for display
        beatBest,
        sessionPoints               // send *this* to Supabase!
    };
}

// --- Game UI Setup and Logic ---
  if (lastname) {
  Promise.all([
    fetchBestScore(lastname, hour, gameType),
    fetchTotalPoints(lastname, hour)
  ]).then(([bestScore, points]) => {
    $('.left').html(
  `<span class="game-userinfo">${lastname} (${hour}) | Best: ${bestScore} | Points: ${points}</span><br><br>` +
  `<span class="game-seconds">Seconds left: <span class="seconds">0</span></span>`
  );
    // --- Main Game Logic ---
    init(options);
  }); // <<< The closing parenthesis and semicolon finish the .then()
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

    function randGen(min, max) {
        return function () { return min + rand(max - min + 1); };
    }
    const randGens = {};
    randGens.add_left = randGen(options['add_left_min'], options['add_left_max']);
    randGens.add_right = randGen(options['add_right_min'], options['add_right_max']);
    randGens.mul_left = randGen(options['mul_left_min'], options['mul_left_max'] || 2);
    randGens.mul_right = randGen(options['mul_right_min'], options['mul_right_max'] || 2);

    // --- Problem Generators ---
    function pg_add() {
        const left = randGens.add_left();
        const right = randGens.add_right();
        return { prettyProblem: left + ' + ' + right, plainProblem: left + ' + ' + right, answer: left + right };
    }
    function pg_sub() {
        const first = randGens.add_left();
        const second = randGens.add_right();
        const left = first + second, right = first;
        return { prettyProblem: left + ' – ' + right, plainProblem: left + ' - ' + right, answer: left - right };
    }
    function pg_mul() {
        const left = randGens.mul_left();
        const right = randGens.mul_right();
        return { prettyProblem: left + ' × ' + right, plainProblem: left + ' * ' + right, answer: left * right };
    }
    function pg_div() {
        const first = randGens.mul_left();
        const second = randGens.mul_right();
        if (first !== 0) {
            const left = first * second, right = first;
            return { prettyProblem: left + ' ÷ ' + right, plainProblem: left + ' / ' + right, answer: left / right };
        }
    }
    function exponentProblems() {
        const problems = [];
        for (let base = 1; base <= 12; base++) {
            problems.push({base, exponent: 0});
            problems.push({base, exponent: 1});
            problems.push({base, exponent: 2});
        }
        for (let base = 1; base <= 3; base++) {
            problems.push({base, exponent: 3});
        }
        for (let base = 1; base <= 2; base++) {
            problems.push({base, exponent: 4});
        }
        problems.push({base: 1, exponent: 5});
        return problems;
    }
    function powInt(base, exponent) {
        let result = 1;
        for(let i=0; i<exponent; i++) result *= base;
        return result;
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
        if (thisProblemLog.entry) {
            const lastEntry = thisProblemLog.entry[thisProblemLog.entry.length - 1] ?? '';
            if (value.length - lastEntry.length > 1 || /[^-\d\s]/.test(value) || lastEntry.length >= 2 + String(genned.answer).length) {
                thisProblemLog.entry = null;
            } else {
                thisProblemLog.entry.push(value);
            }
        }
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

    problemGeng();

    const duration = options.duration || 180;
    const timer = setInterval(function () {
        const d = duration - Math.floor((Date.now() - startTime) / 1000);
        $('.seconds').text(d);
        if (d <= 0) {
            problemLog.push(thisProblemLog);
            answer.prop('disabled', true);
            clearInterval(timer);

            // End-of-game UI and score/points
            banner.find('.start').hide();
            banner.find('.end').show();
            const result = updateScoreAndPoints(correct_ct);
            let message = `Score: ${correct_ct}`;
            if (result && result.beatBest) { message += " (New best!)"; }
             Promise.all([
              fetchBestScore(lastname, hour, gameType),
              fetchTotalPoints(lastname, hour)
            ]).then(([bestScore, points]) => {
              message += `<br>Your best: ${bestScore}`;
              message += `<br>Your points: ${points}`;
              banner.find('.correct').html(message);
              $('.left').html(
                `Seconds left: <span class="seconds">0</span> | ${lastname} (${hour})` +
                ` | Best: ${bestScore} | Points: ${points}`
              );
            });
            // Submit to Supabase
            submitScoreToSupabase(lastname, hour, gameType, correct_ct, result.sessionPoints);
          // Redirect after a short delay (e.g. 2 seconds so user can see message)
    setTimeout(function() {
        window.location.href = 'points.html';
    }, 2000);
        }
    }, 1000);
}

// Restart handler
$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    window.location.reload();
});
