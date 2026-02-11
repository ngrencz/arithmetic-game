import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6Fub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

let currentLevel = 1; // Track Lvl 1 or 2

// 1. REDEMPTION (Your original logic)
document.getElementById('redeem-btn').onclick = async function() {
    const redeemAmount = parseInt(document.getElementById('redeem-amount').value, 10);
    const msgBox = document.getElementById('redeem-message');

    const { data } = await supabase.from('scores').select('points').eq('lastname', lastname).eq('hour', hour);
    const totalPoints = data.reduce((acc, row) => acc + (row.points || 0), 0);

    if (redeemAmount > totalPoints) {
        msgBox.style.color = "#c00";
        msgBox.textContent = `Not enough points! You only have ${totalPoints}.`;
        return;
    }

    await supabase.from('scores').insert([{
        lastname, hour, game_type: 'redeem', score: 0, points: -redeemAmount
    }]);

    msgBox.style.color = "#03793A";
    msgBox.textContent = `Success! Balance: ${totalPoints - redeemAmount}`;
    await showUserInfo();
};

// 2. USER INFO (Two-Column Table)
async function showUserInfo() {
    const { data } = await supabase.from('scores').select('game_type, score, points').eq('lastname', lastname).eq('hour', hour);
    let points = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;
    
    let info = `<h2>Welcome ${lastname} (Hour ${hour})</h2>`;
    info += `<p><b>Points: ${points}</b></p>`;
    info += `<table class="leaderboard-table" style="width:100%"><tr><th>Mode</th><th>Lvl 1</th><th>Lvl 2</th></tr>`;

    for (const gt of gameTypes) {
        const rows1 = data.filter(r => r.game_type === gt);
        const best1 = rows1.length > 0 ? Math.max(...rows1.map(r => r.score || 0)) : 0;
        const rows2 = data.filter(r => r.game_type === gt + "_lvl2");
        const best2 = rows2.length > 0 ? Math.max(...rows2.map(r => r.score || 0)) : 0;
        info += `<tr><td>${gt}</td><td>${best1}</td><td style="color:#d9534f">${best2}</td></tr>`;
    }
    info += `</table>`;
    document.getElementById('user-info').innerHTML = info;
}

// 3. LEADERBOARD DATA
async function getLeaderboard(gameType, scope) {
    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data } = await qb;
    if (!data || !data.length) return `<p>No scores for Level ${currentLevel} yet!</p>`;

    const users = {};
    data.forEach(row => {
        const key = row.lastname + "/" + row.hour;
        if (!users[key] || row.score > users[key].score) users[key] = row;
    });
    const agg = Object.values(users).sort((a, b) => b.score - a.score);

    let rows = agg.map(row =>
        `<tr${row.lastname == lastname && row.hour == hour ? ' style="background:#03793A22"' : ''}>
            <td>${row.lastname}</td><td>${row.hour}</td><td>${row.score}</td>
        </tr>`).join('');

    return `<table class="leaderboard-table" style="width:100%"><tr><th>Name</th><th>Hour</th><th>Score</th></tr>${rows}</table>`;
}

// 4. MENUS
function buildOperationMenu(selectedGame, scope) {
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = '';
    
    // Level Toggle Row
    const lvlBox = document.createElement('div');
    lvlBox.style.marginBottom = "10px";
    lvlBox.innerHTML = `
        <button id="lvl1-btn" style="background:${currentLevel==1?'#03793A':''}; color:${currentLevel==1?'white':''}">Level 1</button>
        <button id="lvl2-btn" style="background:${currentLevel==2?'#d9534f':''}; color:${currentLevel==2?'white':''}">Level 2</button>
    `;
    menuBar.appendChild(lvlBox);

    document.getElementById('lvl1-btn').onclick = () => { currentLevel = 1; renderLeaderboard(selectedGame, scope); };
    document.getElementById('lvl2-btn').onclick = () => { currentLevel = 2; renderLeaderboard(selectedGame, scope); };

    // Game Buttons (2 rows of 3)
    const grid = document.createElement('div');
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr 1fr";
    grid.style.gap = "5px";

    for (const g of gameTypes) {
        const btn = document.createElement('button');
        btn.textContent = g.charAt(0).toUpperCase() + g.slice(1);
        if (g === selectedGame) { btn.style.background = "#03793A"; btn.style.color = "white"; }
        btn.onclick = () => renderLeaderboard(g, scope);
        grid.appendChild(btn);
    }
    menuBar.appendChild(grid);
}

function buildScopeMenu(gameType, selectedScope) {
    const submenuBar = document.getElementById('submenu-bar');
    submenuBar.innerHTML = '';
    for (const s of scopeTypes) {
        const btn = document.createElement('button');
        if (s === selectedScope) { btn.style.background = "#03793A"; btn.style.color = "white"; }
        btn.textContent = (s === "class" ? `Hour ${hour}` : 'Overall');
        btn.onclick = () => renderLeaderboard(gameType, s);
        submenuBar.appendChild(btn);
    }
}

async function renderLeaderboard(gameType, scope) {
    buildOperationMenu(gameType, scope);
    buildScopeMenu(gameType, scope);
    document.getElementById('leaderboard-content').innerHTML = "Loading...";
    const html = await getLeaderboard(gameType, scope);
    document.getElementById('leaderboard-content').innerHTML = html;
}

// INIT
(async () => {
    await showUserInfo();
    renderLeaderboard('addition', 'class');
})();
