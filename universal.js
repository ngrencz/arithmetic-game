/**
 * universal.js - Bellringer Speed Game (HARDENED & SANDBOX READY)
 * Features: IIFE Closure, Try/Catch Safety Nets, Sandbox API Hook
 */

(function() {
    // --- 1. Supabase Setup ---
    const SB_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
    // 🚨 Paste your actual key below before deploying:
    const SB_KEY = "KEYGOESHERE";
    const supabase = window.supabase.createClient(SB_URL, SB_KEY);

    // --- 2. State Variables ---
    const params = new URLSearchParams(window.location.search);
    const currentUser = params.get('lastname') || localStorage.getItem('mathgame_lastname') || "";
    const currentHour = params.get('hour') || localStorage.getItem('mathgame_hour') || "";

    let selectedLevel = 1; 

    // Determine the game type based on day of week (0=Sun, 1=Mon... Friday is index 4)
    let gameType = params.get("game") || ["addition", "subtraction", "multiplication", "division", "roots"][((new Date()).getDay()+6)%7 % 5];

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
    }

    // --- 3. Initialization ---
    $(document).ready(function() {
        $('.level-btn').on('click', function() {
            selectedLevel = parseInt($(this).data('level')); 
            
            if (selectedLevel === 2) {
                options.left_min = -12;
                options.right_min = -12;
                if (gameType === "roots") {
                    options.sqrt = true;
                    options.exp = false; 
                }
            } else {
                options.left_min = 2; 
                options.right_min = 2;
                if (gameType === "roots") {
                    options.sqrt = false; 
                    options.exp = true; 
                }
            }

            $('#level-select').hide();
            $('.start').show();
            startGame();
        });
    });

    // --- 4. Database Helpers (Hardened) ---
    async function fetchTotalPoints(user, hr) {
        try {
            if (!user || !hr) return 0;
            const { data, error } = await supabase.from('scores').select('points').eq('lastname', user).eq('hour', hr);
            return (error || !data) ? 0 : data.reduce((sum, row) => sum + (row.points || 0), 0);
        } catch(e) {
            console.error("DB Fetch Points Error:", e);
            return 0;
        }
    }

    async function fetchBestScore(user, hr, targetGameType) {
        try {
            if (!user || !hr || !targetGameType) return 0;
            const { data, error } = await supabase.from('scores').select('score').eq('lastname', user).eq('hour', hr).eq('game_type', targetGameType);
            return (error || !data) ? 0 : data.reduce((max, row) => Math.max(max, row.score || 0), 0);
        } catch(e) {
            console.error("DB Fetch Best Score Error:", e);
            return 0;
        }
    }

    async function submitScoreToSupabase(lastname, hour, gameType, score, points) {
    const { error } = await supabase.from('scores').insert([{ 
        lastname: lastname, 
        hour: hour, 
        game_type: gameType, 
        score: score, 
        points: points 
    }]);
    
    if (error) {
        alert("Supabase Error: " + error.message);
        console.error(error);
        }
    }

    // --- 5. Math Utilities ---
    function rand(n) { return Math.floor(Math.random() * n); }
    function randRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    function updateScoreAndPoints(currentScore, bestScoreFromDB) {
        if (!currentUser || !currentHour) return { bestScore: 0, points: 0, beatBest: false, sessionPoints: 0 };
        
        const keyBest = `mathgame_${currentUser}_${currentHour}_bestscore_${gameType}`;
        const keyPoints = `mathgame_${currentUser}_${currentHour}_points`;
        
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
        if (currentUser) {
            const dbType = selectedLevel === 2 ? `${gameType}_lvl2` : gameType;

            Promise.all([fetchBestScore(currentUser, currentHour, dbType), fetchTotalPoints(currentUser, currentHour)])
                .then(([bestScore, points]) => {
                    $('.left').html(`
                        <span class="game-userinfo">
                            ${currentUser} (${currentHour}) | Lvl: ${selectedLevel} | Best: ${bestScore} | Points: ${points}
                        </span><br><br>
                        <span class="game-seconds">Seconds left: <span class="seconds">0</span></span>
                    `);
                    initGameEngine(options);
                })
                .catch(err => {
                    console.error("Game Initialization Error:", err);
                    initGameEngine(options); // Fallback so they can still play if DB fails
                });
        }
    }

    // --- 6. Main Game Engine ---
    function initGameEngine(opts) {
        let problemStartTime;
        const game = $('#game');
        const problem = game.find('.problem');
        const answer = game.find('.answer');
        const banner = game.find('.banner');
        const correct = game.find('.correct');
        answer.focus();

        function pg_add() {
            const left = randRange(opts.left_min, opts.left_max);
            const right = randRange(opts.right_min, opts.right_max);
            const displayRight = right < 0 ? `(${right})` : right;
            return { prettyProblem: left + ' + ' + displayRight, answer: left + right };
        }

        function pg_sub() {
            let left = randRange(opts.left_min, opts.left_max);
            let right = randRange(opts.right_min, opts.right_max);
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
            const left = randRange(opts.left_min, opts.left_max);
            const right = randRange(opts.right_min, opts.right_max);
            const displayRight = right < 0 ? `(${right})` : right;
            return { prettyProblem: left + ' × ' + displayRight, answer: left * right };
        }

        function pg_div() {
            let divisor = 0;
            while (divisor === 0) { divisor = randRange(opts.left_min, opts.left_max); }
            const quotient = randRange(opts.right_min, opts.right_max);
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
        if (opts.add) pgs.push(pg_add);
        if (opts.sub) pgs.push(pg_sub);
        if (opts.mul) pgs.push(pg_mul);
        if (opts.div) pgs.push(pg_div);
        if (opts.exp) pgs.push(pg_exp);
        if (opts.sqrt) pgs.push(pg_sqrt);

        let genned;
        function problemGeng() {
            try {
                genned = pgs[rand(pgs.length)]();
                problemStartTime = Date.now();
                problem.text(genned.prettyProblem);
                answer.val('');
                
                // 🟢 TELL THE SANDBOX THE ANSWER
                window.expectedTestAnswer = genned.answer;
            } catch (e) {
                console.error("Problem Generation Error:", e);
            }
        }

        let correct_ct = 0;
        const startTime = Date.now();
        problemGeng();

        answer.on('input', function (e) {
        try {
            if (e.currentTarget.value.trim() === String(genned.answer)) {
                correct_ct++;
                $('.correct').first().text('Score: ' + correct_ct);
                problemGeng();
            }
        } catch(err) {
            console.error("Input processing error:", err);
        }
    });

        const timer = setInterval(function () {
            try {
                const d = opts.duration - Math.floor((Date.now() - startTime) / 1000);
                $('.seconds').text(Math.max(0, d));
                
                if (d <= 0) {
                    clearInterval(timer);
                    answer.prop('disabled', true);
                    
                    const dbType = selectedLevel === 2 ? `${gameType}_lvl2` : gameType;
                    
                    fetchBestScore(currentUser, currentHour, dbType).then(best => {
                        const res = updateScoreAndPoints(correct_ct, best);
                        
                        submitScoreToSupabase(currentUser, currentHour, dbType, correct_ct, res.sessionPoints)
                            .finally(() => {
                                banner.find('.start').hide();
                                banner.find('.end').show().find('.correct').html(`Score: ${correct_ct}<br>Best: ${res.bestScore}`);
                                
                                // Guaranteed Escape Hatch
                                setTimeout(() => { window.location.href = 'points.html'; }, 3000);
                            });
                    }).catch(err => {
                        console.error("Endgame DB Resolution Error:", err);
                        setTimeout(() => { window.location.href = 'points.html'; }, 2000);
                    });
                }
            } catch (err) {
                console.error("Timer Loop Crash:", err);
                clearInterval(timer);
                setTimeout(() => { window.location.href = 'points.html'; }, 2000);
            }
        }, 1000);
    }

    $(document).on('click', '#try-again', function(e) { 
        e.preventDefault();
        window.location.reload(); 
    });

})();
