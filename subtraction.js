const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// Get last name and hour from either URL params (preferred) or localStorage
const params = new URLSearchParams(window.location.search);
const lastname = params.get('lastname') || localStorage.getItem('mathgame_lastname') || "";
const hour = params.get('hour') || localStorage.getItem('mathgame_hour') || "";
const gameType = document.location.pathname.split('/').pop().replace('.html','');
function rand(n) {
    return Math.floor(Math.random() * n);
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
    .insert([
      { lastname, hour, game_type: gameType, score, points }
    ]);
  if (error) {
    console.error(error.message);
  } else {
    console.log('Score submitted:', data);
  }
}
$(function() {
    if (lastname) {
        // get initial best/points or show "0"
        const { bestScore, points } = getBestAndPoints();
        $('.left').html(
            `Seconds left: <span class="seconds">0</span> | ${lastname} (${hour})` +
            ` | Best: ${bestScore} | Points: ${points}`
        );
    }
    // ...rest of your game setup code (including init!)
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
    const wls = window.location.search;
    function randGen(min, max) {
        return function () {
            return min + rand(max - min + 1);
        };
    }
    const genTypes = ['add_left', 'add_right', 'mul_left', 'mul_right'];
    const randGens = {};
    genTypes.forEach(function (type) {
        randGens[type] = randGen(options[`${type}_min`], options[`${type}_max`]);
    });
    function pg_add() {
        const left = randGens[genTypes[0]]();
        const right = randGens[genTypes[1]]();
        return {
            prettyProblem: left + ' + ' + right,
            plainProblem: left + ' + ' + right,
            answer: left + right,
        };
    }
    function pg_sub() {
        const first = randGens[genTypes[0]]();
        const second = randGens[genTypes[1]]();
        const left = first + second;
        const right = first;
        return {
            prettyProblem: left + ' \u2013 ' + right,
            plainProblem: left + ' - ' + right,
            answer: left - right,
        };
    }
    function pg_mul() {
        const left = randGens[genTypes[2]]();
        const right = randGens[genTypes[3]]();
        return {
            prettyProblem: left + ' \xD7 ' + right,
            plainProblem: left + ' * ' + right,
            answer: left * right,
        };
    }
    function pg_div() {
        const first = randGens[genTypes[2]]();
        const second = randGens[genTypes[3]]();
        if (first !== 0) {
            const left = first * second;
            const right = first;
            return {
                prettyProblem: left + ' \xF7 ' + right,
                plainProblem: left + ' / ' + right,
                answer: left / right,
            };
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
    let genned;
    let thisProblemLog;
    function problemGeng() {
        genned = problemGen();
        thisProblemLog = {
            problem: genned.plainProblem,
            answer: genned.answer,
            entry: [],
            timeMs: -1,
        };
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
            if (value.length - lastEntry.length > 1 ||
                /[^-\d\s]/.test(value) ||
                lastEntry.length >= 2 + String(genned.answer).length
            ) {
                thisProblemLog.entry = null;
            }
            else {
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
        d_left.text('Seconds left: ' + d);
        if (d <= 0) {
            problemLog.push(thisProblemLog);
            answer.prop('disabled', true);
            const $doc = $(window.document);
            const bsEat = function bsEat(e) { return e.keyCode !== 8; };
            $doc.on('keydown', bsEat);
            clearInterval(timer);

            setTimeout(function () { $doc.off('keydown', bsEat); }, 1000);
            banner.find('.start').hide();
            banner.find('.end').show();

            // Calculate best/points, display to student
            const result = updateScoreAndPoints(correct_ct);
            let message = `Score: ${correct_ct}`;
            if (result && result.beatBest) { message += " (New best!)"; }
            message += `<br>Your best: ${result ? result.bestScore : correct_ct}`;
            message += `<br>Your points: ${result ? result.points : ""}`;
            banner.find('.correct').html(message);

            // --- Add this line to submit score to Supabase ---
            submitScoreToSupabase(lastname, hour, gameType, correct_ct, result.points);
            }, 'html');
        }
    }, 1000);
    if (wls.match(/\bpink\b/)) {
        $('.banner').css('background', 'pink');
    }
}

// On doc ready, start game (this line at the bottom!)
$(function () {
    init({
        add: false,
        sub: true,
        mul: false,
        div: false,
        add_left_min: 2,
        add_left_max: 12,
        add_right_min: 2,
        add_right_max: 12,
        duration: 120
    });
});

// Restart button event handler (if your HTML includes it)
$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    window.location.reload();
});

// Assume you have player's score in `currentScore`
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
