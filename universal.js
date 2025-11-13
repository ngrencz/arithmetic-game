// --- Supabase Setup ---
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJI..."; // your actual key
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Get login and game info ---
const params = new URLSearchParams(window.location.search);
const lastname = params.get('lastname') || localStorage.getItem('mathgame_lastname') || "";
const hour = params.get('hour') || localStorage.getItem('mathgame_hour') || "";
// Get game type from query (?game=addition), or from filename
const gameType = params.get("game") || document.location.pathname.split('/').pop().replace('.html','');

// --- Set game options based on type ---
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
    const genTypes = ['add_left', 'add_right', 'mul_left', 'mul_right'];
    const randGens = {};
    randGens.add_left = randGen(options['add_left_min'], options['add_left_max']);
    randGens.add_right = randGen(options['add_right_min'], options['add_right_max']);
    randGens.mul_left = randGen(options['mul_left_min'], options['mul_left_max'] || 2);
    randGens.mul_right = randGen(options['mul_right_min'], options['mul_right_max'] || 2);

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

    const pgs = [];
    if (options.add) pgs.push(pg_add);
    if (options.sub) pgs.push(pg_sub);
    if (options.mul) pgs.push(pg_mul);
    if (options.div) pgs.push(pg_div);

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

    const duration = options.duration || 120;
    d_left.text('Seconds left: ' + duration);
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
            message += `<br>Your best: ${result ? result.bestScore : correct_ct}`;
            message += `<br>Your points: ${result ? result.points : ""}`;
            banner.find('.correct').html(message);

            // Submit to Supabase
            submitScoreToSupabase(lastname, hour, gameType, correct_ct, result.points);
        }
    }, 1000);
}

// Restart handler
$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    window.location.reload();
});
