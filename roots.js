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

    // Precompute all valid root problems in the given range
    const min = options.root_min || 2;
    const max = options.root_max || 20;
    const problems = [];

    // Squares: √n², answers n (for n=root_min to root_max)
    for (let n = min; n <= max; n++) {
        problems.push({
            prompt: "√" + (n * n),
            plain: "sqrt(" + (n * n) + ")",
            answer: n
        });
    }
    // Cubic roots:
    problems.push({ prompt: "∛8", plain: "cbrt(8)", answer: 2 });
    problems.push({ prompt: "∛27", plain: "cbrt(27)", answer: 3 });

    function nextRootProblem() {
        const prob = problems[rand(problems.length)];
        return {
            prettyProblem: prob.prompt,
            plainProblem: prob.plain,
            answer: prob.answer
        };
    }

    let genned, thisProblemLog;
    function nextProblem() {
        genned = nextRootProblem();
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
                value.length - lastEntry.length > 1 ||
                /[^-\d\s]/.test(value) ||
                lastEntry.length >= 2 + String(genned.answer).length
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
        root_min: 2,
        root_max: 12,
        duration: 120 // or 180
    });
});

$(document).on('click', '#try-again', function(e) {
    e.preventDefault();
    window.location.reload();
});
