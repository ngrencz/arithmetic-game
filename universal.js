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

    // Problem generators (same as before, omitted here for brevity)

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
        problemStartTime = Date.now(); // Correct timer reset
    }

    let correct_ct = 0;
    const problemLog = [];

    answer.on('input', function (e) {
        const value = e.currentTarget.value;
        if (value.trim() === String(genned.answer)) {
            const now = Date.now();
            thisProblemLog.timeMs = now - problemStartTime;
            thisProblemLog.timeStamp = now;
            problemLog.push(thisProblemLog);
            // Debug: log each problem timing
            console.log('Answered:', genned.prettyProblem, 'in', thisProblemLog.timeMs, 'ms');
            problemGeng();
            correct.text('Score: ' + ++correct_ct);
        }
        return true;
    });

    problemGeng();

    const startTime = (problemStartTime = Date.now());
    const duration = options.duration || 120;
    const timer = setInterval(function () {
        const d = duration - Math.floor((Date.now() - startTime) / 1000);
        $('.seconds').text(d);
        if (d <= 0) {
            problemLog.push(thisProblemLog);
            answer.prop('disabled', true);
            clearInterval(timer);

            // --- End-of-game: Suspicious Activity Logic ---
            banner.find('.start').hide();
            banner.find('.end').show();

            let message = `Score: ${correct_ct}`;
            
            const MAX_PROBLEM_TIME_MS = 30000; // 30s per problem
            const MAX_IDLE_TIME_MS = 60000;    // 1 min idle at end

            // --- Suspicious check is more forgiving now ---
            let suspiciousAnswers = problemLog.filter(prob => prob.timeMs > MAX_PROBLEM_TIME_MS).length;
            let suspiciousThreshold = Math.max(1, Math.floor(problemLog.length * 0.3)); // Always allow at least 1 slow answer

            // Average time option (uncomment if you wish)
            // let avgTime = problemLog.reduce((sum, p) => sum + p.timeMs, 0) / problemLog.length;

            let lastAnswerTime = problemLog.length > 0
                ? (problemLog[problemLog.length - 1].timeStamp || startTime)
                : startTime;
            let idleAtEnd = (Date.now() - lastAnswerTime) > MAX_IDLE_TIME_MS;

            let honestPlay = (suspiciousAnswers < suspiciousThreshold) && !idleAtEnd;
            // Or use average: let honestPlay = (avgTime <= MAX_PROBLEM_TIME_MS) && !idleAtEnd;

            // Debug output
            console.log({
                score: correct_ct,
                suspiciousAnswers,
                suspiciousThreshold,
                idleAtEnd,
                honestPlay,
                problemLog
            });

            // --- Always record score to Supabase ---
            // The difference is whether you award point or just log score.
            const result = updateScoreAndPoints(correct_ct);

            if (!honestPlay) {
                message += "<br>Suspicious activity detected – no point awarded.";
                message += `<br>Your best: ${result ? result.bestScore : correct_ct}`;
                message += `<br>Your points: ${result ? result.points - 1 : ""}`; // Don't count new point
            } else {
                if (result && result.beatBest) { message += " (New best!)"; }
                message += `<br>Your best: ${result ? result.bestScore : correct_ct}`;
                message += `<br>Your points: ${result ? result.points : ""}`;
            }
            submitScoreToSupabase(lastname, hour, gameType, correct_ct, result ? result.points : 0);

            banner.find('.end .correct').html(message);
            banner.find('.end .correct').css({
                "color": "#c00",
                "fontWeight": "bold"
            });

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
