function rand(n) {
    return Math.floor(Math.random() * n);
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

    // Default to 3 minutes if not specified
    const duration = 180;

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
        const left = randGens.add_left();
        const right = randGens.add_right();
        return {
            prettyProblem: left + ' + ' + right,
            plainProblem: left + ' + ' + right,
            answer: left + right,
        };
    }
    function pg_sub() {
        const first = randGens.add_left();
        const second = randGens.add_right();
        const left = first + second;
        const right = first;
        return {
            prettyProblem: left + ' – ' + right,
            plainProblem: left + ' - ' + right,
            answer: left - right,
        };
    }
    function pg_mul() {
        const left = randGens.mul_left();
        const right = randGens.mul_right();
        return {
            prettyProblem: left + ' × ' + right,
            plainProblem: left + ' * ' + right,
            answer: left * right,
        };
    }
    function pg_div() {
        const first = randGens.mul_left();
        const second = randGens.mul_right();
        if (first !== 0) {
            const left = first * second;
            const right = first;
            return {
                prettyProblem: left + ' ÷ ' + right,
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
    let genned, thisProblemLog;
    function nextProblem() {
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
            if (
                value.length - lastEntry.length > 1 || // paste
                /[^-\d\s]/.test(value) || // non-numeric
                lastEntry.length >= 2 + String(genned.answer).length // too long
            ) {
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
            nextProblem();
            correct.text('Score: ' + ++correct_ct);
        }
        return true;
    });
    nextProblem();
    d_left.text('Seconds left: ' + duration);
    const timer = setInterval(function () {
        const d = duration - Math.floor((Date.now() - startTime) / 1000);
        d_left.text('Seconds left: ' + d);
        if (d <= 0) {
            problemLog.push(thisProblemLog);
            answer.prop('disabled', true);
            clearInterval(timer);

            // End screen setup
            banner.find('.start').hide();
            banner.find('.end').show();
            banner.find('.final-score').text('Score: ' + correct_ct);
        }
    }, 1000);
}

// On DOM ready, start the game:
$(function () {
    init({
        add: true,
        sub: false,
        mul: false,
        div: false,
        add_left_min: 2,
        add_left_max: 12,
        add_right_min: 2,
        add_right_max: 12
        // You can enable sub/mul/div and ranges if you wish
    });
});

// Optional: Try Again button reloads the page
//$(document).on('click', '#try-again', function (e) {
//    e.preventDefault();
//    window.location.reload();
});
