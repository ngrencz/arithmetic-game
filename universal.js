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
    duration: 120
};

switch(gameType) {
    case "addition": options.add = true; break;
    case "subtraction": options.sub = true; break;
    case "multiplication": options.mul = true; break;
    case "division": options.div = true; break;
    case "exponents": options.exp = true; break; 
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

    if (currentScore > bestScore) {
        localStorage.setItem(keyBest, currentScore);
        localStorage.setItem(keyPoints, points + 1);
        beatBest = true;
    }
    return { bestScore: Math.max(currentScore, bestScore), points: points + (beatBest ? 1 : 0), beatBest };
}

// --- Game UI Setup and Logic ---
$(function() {
    const { bestScore, points } = getBestAndPoints();
    if (lastname) {
        $('.left').html(
            `Seconds left: <span class="seconds">0</span> | ${lastname} (${hour})` +
            ` | Best: ${bestScore} | Points: ${points}`
        );
    }

    // --- Main Game Logic ---
    init(options);
});

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
    problemStartTime = Date.now(); // <-- THIS resets the timer per problem
}
    }

    const startTime = (problemStartTime = Date.now());
    let correct_ct = 0;
    const problemLog = [];
   answer.on('input', function (e) {
    const value = e.currentTarget.value;
    if (value.trim() === String(genned.answer)) {
        const now = Date.now();
        thisProblemLog.timeMs = now - problemStartTime;
        thisProblemLog.timeStamp = now;
        problemLog.push(thisProblemLog);
        problemGeng(); // Shows next problem; timer is reset inside!
        correct.text('Score: ' + ++correct_ct);
    }
    return true;
});

    problemGeng();

    const duration = options.duration || 120;
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

    // --- Message Variable ---
    let message = `Score: ${correct_ct}`;

    // --- SUSPICIOUS ACTIVITY CHECK ---
    const MAX_PROBLEM_TIME_MS = 30000; // 30s per problem
    const MAX_IDLE_TIME_MS = 60000;    // 1 min idle at end

    // Check for slow answers
    let suspiciousAnswers = problemLog.filter(prob => prob.timeMs > MAX_PROBLEM_TIME_MS).length;

    // Check for idle at end
    let lastAnswerTime = problemLog.length > 0
      ? (problemLog[problemLog.length - 1].timeStamp || startTime)
      : startTime;
    let idleAtEnd = (Date.now() - lastAnswerTime) > MAX_IDLE_TIME_MS;

    // Decide if play was honest
    let honestPlay = (suspiciousAnswers < Math.floor(problemLog.length * 0.3)) && !idleAtEnd;

    if (!honestPlay) {
        // Suspicious play: suppress point award and display generic message
        message += "<br>Suspicious activity detected – no point awarded.";
    } else {
        // Normal awarding and save to Supabase
        const result = updateScoreAndPoints(correct_ct);
        if (result && result.beatBest) { message += " (New best!)"; }
        message += `<br>Your best: ${result ? result.bestScore : correct_ct}`;
        message += `<br>Your points: ${result ? result.points : ""}`;
        submitScoreToSupabase(lastname, hour, gameType, correct_ct, result.points);
    }

    // Show message in the right place
    banner.find('.end .correct').html(message);
    banner.find('.end .correct').css({
      "color": "#c00",
      "fontWeight": "bold"
    });
    // Always redirect after feedback
    setTimeout(function() {
        window.location.href = 'points.html';
    }, 4000);
}
    }, 1000);
}

// Restart handler
$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    window.location.reload();
});
