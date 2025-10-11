function rand(n) {
    return Math.floor(Math.random() * n);
}

function exponentProblems() {
    const problems = [];

    // bases 1-12 for exp 0, 1, 2
    for (let base = 1; base <= 12; base++) {
        problems.push({base, exponent: 0});
        problems.push({base, exponent: 1});
        problems.push({base, exponent: 2});
    }
    // bases 1-3 for exp 3
    for (let base = 1; base <= 3; base++) {
        problems.push({base, exponent: 3});
    }
    // bases 1-2 for exp 4
    for (let base = 1; base <= 2; base++) {
        problems.push({base, exponent: 4});
    }
    // base 1 for exp 5
    problems.push({base: 1, exponent: 5});

    return problems;
}

function powInt(base, exponent) {
    // since Math.pow/ ** can return decimals, make sure it's an integer result for these small numbers
    let result = 1;
    for(let i=0; i<exponent; i++) result *= base;
    return result;
}

function formatSuperscript(n) {
    const sup = {0:"⁰", 1:"¹", 2:"²", 3:"³", 4:"⁴", 5:"⁵"};
    return n.toString().split('').map(d=>sup[d]||d).join('');
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

    // Precompute problem set for randomness and reset on each play
    let allProblems = exponentProblems();

    function nextExponentProblem() {
        // Pick randomly from the list every time
        let pair = allProblems[rand(allProblems.length)];
        return {
            prettyProblem: pair.base + formatSuperscript(pair.exponent),
            plainProblem: pair.base + "^" + pair.exponent,
            answer: powInt(pair.base, pair.exponent),
        };
    }

    let genned, thisProblemLog;
    function nextProblem() {
        genned = nextExponentProblem();
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
            nextProblem();
            correct.text('Score: ' + ++correct_ct);
        }
        return true;
    });
    nextProblem();
    const duration = options.duration || 120;
    d_left.text('Seconds left: ' + duration);
    const timer = setInterval(function () {
        const d = duration - Math.floor((Date.now() - startTime) / 1000);
        d_left.text('Seconds left: ' + d);
        if (d <= 0) {
            problemLog.push(thisProblemLog);
            answer.prop('disabled', true);
            clearInterval(timer);
            banner.find('.start').hide();
            banner.find('.end').show();
            banner.find('.correct').text('Score: ' + correct_ct);
        }
    }, 1000);
}

$(function () {
    init({
        duration: 120  // Or set to 180 for 3 min
    });
});

$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    window.location.reload();
});
