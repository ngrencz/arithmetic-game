import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');

// Added "roots" to your list
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

// NEW: Track which level leaderboard we are looking at
let currentLevel = 1; 

// --- 1. REDEMPTION LOGIC ---
document.getElementById('redeem-btn').onclick = async function() {
    const redeemAmount = parseInt(document.getElementById('redeem-amount').value, 10);
    const msgBox = document.getElementById('redeem-message');
    msgBox.style.color = "#c00"; 

    if (!redeemAmount || redeemAmount < 1) {
        msgBox.textContent = "Enter at least 1 point.";
        return;
    }

    const { data, error } = await supabase
        .from('scores')
        .select('points')
        .eq('lastname', lastname)
        .eq('hour', hour);

    const totalPoints = data.reduce((acc, row) => acc + (row.points || 0), 0);

    if (redeemAmount > totalPoints) {
        msgBox.textContent = `Not enough! You only have ${totalPoints}.`;
        return;
    }

    const { error: insertError } = await supabase.from('scores').insert([{
        lastname, hour, game_type: 'redeem', score: 0, points: -redeemAmount
    }]);

    if (insertError) {
        msgBox.textContent = "Error; try again.";
        return;
    }

    msgBox.style.color = "#03793A";
    msgBox.textContent = `Success! You have ${totalPoints - redeemAmount} left.`;
    await showUserInfo();
};

// --- 2. SHOW USER INFO (Updated for Level 2) ---
async function showUserInfo() {
    const { data, error } = await supabase
        .from('scores')
        .select('game_type, score, points')
        .eq('lastname', lastname)
        .eq('hour', hour);

    let points = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;
    
    let info = `<h2 id="user-header">Welcome ${lastname} (Hour ${hour})</h2>`;
    info += `<p style="font-size:1.2em; color:#03793A;"><b>Your Total Points: ${points}</b></p><ul>`;

    for (const gt of gameTypes) {
        // Find best Lvl 1
        const rows1 = data.filter(r => r.game_type === gt);
        const best1 = rows1.length > 0 ? Math.max(...rows1.map(r => r.score || 0)) : 0;
        
        // Find best Lvl 2
        const rows2 = data.filter(r => r.game_type === gt + "_lvl2");
        const best2 = rows2.length > 0 ? Math.max(...rows2.map(r => r.score || 0)) : 0;

        info += `<li>${gt[0].toUpperCase() + gt.slice(1)}: <b>${best1}</b> | <span style="color:#d9534f">Lvl 2: ${best2}</span></li>`;
    }
    info += `</ul>`;
    document.getElementById('user-info').innerHTML = info;
}

// --- 3. LEADERBOARD SYSTEM ---
async function getLeaderboard(gameType, scope) {
    // Determine the database string (e.g. "addition" vs "addition_lvl2")
    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;

    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data, error } = await qb;
    if (!data || !data.length) return `<p>No scores yet for Level ${currentLevel}!</p>`;

    // Aggregate best score per student
    const users = {};
    data.forEach(row => {
        const key = row.lastname + "/" + row.hour;
        if (!users[key] || row.score > users[key].score) {
            users[key] = { lastname: row.lastname, hour: row.hour, score: row.score };
        }
    });
    const agg = Object.values(users).sort((a, b) => b.score - a.score);

    let rows = agg.map(row =>
        `<tr${row.lastname == lastname && row.hour == hour ? ' style="background:#05B25A22"' : ''}>
            <td>${row.lastname}</td><td>${row.hour}</td><td>${row.score}</td>
        </tr>`
    ).join('');

    return `<table><tr><th>Last Name</th><th>Hour</th><th>Best Score</th></tr>${rows}</table>`;
}

// --- 4. MENU SYSTEM (Updated with Level Toggle) ---
function buildOperationMenu(selectedGame) {
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = '';
    
    // Add a Level Toggle Button first
    const lvlBtn = document.createElement('button');
    lvlBtn.style.background = currentLevel === 2 ? "#d9534f" : "#444";
    lvlBtn.style.color = "white";
    lvlBtn.textContent = `Switch to Level ${currentLevel === 1 ? '2' : '1'}`;
    lvlBtn.onclick = () => {
        currentLevel = currentLevel === 1 ? 2 : 1;
        renderLeaderboard(selectedGame, "class");
    };
    menuBar.appendChild(lvlBtn);

    // Standard Game Buttons
    for (const g of gameTypes) {
        const btn = document.createElement('button');
        btn.className = (g === selectedGame ? 'active' : '');
        btn.textContent = g[0].toUpperCase() + g.slice(1);
        btn.onclick = () => renderLeaderboard(g, "class");
        menuBar.appendChild(btn);
    }
}

function buildScopeMenu(gameType, selectedScope) {
    const submenuBar = document.getElementById('submenu-bar');
    submenuBar.innerHTML = `<h3>Level ${currentLevel} Leaderboard</h3>`;
    for (const s of scopeTypes) {
        const btn = document.createElement('button');
        btn.className = (s === selectedScope ? 'active' : '');
        btn.textContent = (s === "class" ? `Class Hour (${hour})` : 'Overall');
        btn.onclick = () => renderLeaderboard(gameType, s);
        submenuBar.appendChild(btn);
    }
}

async function renderLeaderboard(gameType, scope) {
    buildOperationMenu(gameType);
    buildScopeMenu(gameType, scope);
    document.getElementById('leaderboard-content').innerHTML = "Loading...";
    const html = await getLeaderboard(gameType, scope);
    document.getElementById('leaderboard-content').innerHTML = html;
}

(async () => {
    await showUserInfo();
    renderLeaderboard('addition', 'class');
})();
