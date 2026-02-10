import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

let currentLevel = 1; 

// --- 1. REDEMPTION & POINTS DISPLAY ---
document.getElementById('redeem-btn').onclick = async function() {
    const redeemAmount = parseInt(document.getElementById('redeem-amount').value, 10);
    const msgBox = document.getElementById('redeem-message');
    
    if (!redeemAmount || redeemAmount < 1) {
        msgBox.style.color = "#c00";
        msgBox.textContent = "Enter at least 1 point.";
        return;
    }

    const { data } = await supabase.from('scores').select('points').eq('lastname', lastname).eq('hour', hour);
    const totalPoints = data.reduce((acc, row) => acc + (row.points || 0), 0);

    if (redeemAmount > totalPoints) {
        msgBox.style.color = "#c00";
        msgBox.textContent = `Not enough points!`;
        return;
    }

    await supabase.from('scores').insert([{
        lastname, hour, game_type: 'redeem', score: 0, points: -redeemAmount
    }]);

    msgBox.style.color = "#03793A";
    msgBox.textContent = `Redeemed!`;
    showUserInfo(); 
};

// --- 2. STATS TABLE (No bulky fonts) ---
async function showUserInfo() {
    const { data } = await supabase.from('scores').select('game_type, score, points').eq('lastname', lastname).eq('hour', hour);
    const points = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;
    
    // Update Points in the Redemption Box
    document.getElementById('redeem-message').innerHTML = `Current Balance: <strong>${points}</strong>`;

    let html = `<h2>Welcome ${lastname} (Hour ${hour})</h2>
    <table class="leaderboard-table" style="width:100%;">
        <thead>
            <tr>
                <th style="text-align:left;">Mode</th>
                <th>Level 1</th>
                <th>Level 2</th>
            </tr>
        </thead>
        <tbody>`;

    gameTypes.forEach(gt => {
        const rows1 = data.filter(r => r.game_type === gt);
        const best1 = rows1.length > 0 ? Math.max(...rows1.map(r => r.score || 0)) : 0;
        const rows2 = data.filter(r => r.game_type === gt + "_lvl2");
        const best2 = rows2.length > 0 ? Math.max(...rows2.map(r => r.score || 0)) : 0;

        html += `<tr>
            <td style="text-align:left; text-transform:capitalize;">${gt}</td>
            <td>${best1}</td>
            <td style="color:#d9534f;">${best2}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('user-info').innerHTML = html;
}

// --- 3. LEADERBOARD SYSTEM ---
async function renderLeaderboard(gameType, scope) {
    // 1. Build Level Toggle (Placed at the very top of the window)
    const levelToggleHtml = `
        <div style="text-align:right; margin-bottom:10px;">
            <span style="font-weight:bold; margin-right:10px;">Difficulty:</span>
            <button class="${currentLevel === 1 ? 'active' : ''}" onclick="window.changeLevel(1, '${gameType}', '${scope}')">Level 1</button>
            <button class="${currentLevel === 2 ? 'active' : ''}" style="color:${currentLevel === 2 ? 'white' : '#d9534f'}; background:${currentLevel === 2 ? '#d9534f' : ''}" onclick="window.changeLevel(2, '${gameType}', '${scope}')">Level 2</button>
        </div>`;

    // 2. Build Game Menu
    const menuBar = document.getElementById('menu-bar');
    menuBar.innerHTML = '';
    gameTypes.forEach(g => {
        const btn = document.createElement('button');
        btn.className = (g === gameType ? 'active' : '');
        btn.textContent = g.charAt(0).toUpperCase() + g.slice(1);
        btn.onclick = () => renderLeaderboard(g, "class");
        menuBar.appendChild(btn);
    });

    // 3. Build Scope Menu
    const submenuBar = document.getElementById('submenu-bar');
    submenuBar.innerHTML = '';
    scopeTypes.forEach(s => {
        const btn = document.createElement('button');
        btn.className = (s === scope ? 'active' : '');
        btn.textContent = (s === "class" ? `Hour ${hour}` : 'Overall');
        btn.onclick = () => renderLeaderboard(gameType, s);
        submenuBar.appendChild(btn);
    });

    // 4. Fetch Data
    document.getElementById('leaderboard-content').innerHTML = levelToggleHtml + "<p>Loading...</p>";
    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data } = await qb;
    let tableHtml = levelToggleHtml;

    if (!data || !data.length) {
        tableHtml += `<p>No scores for Level ${currentLevel} yet!</p>`;
    } else {
        const users = {};
        data.forEach(row => {
            const key = row.lastname + "/" + row.hour;
            if (!users[key] || row.score > users[key].score) users[key] = row;
        });
        const agg = Object.values(users).sort((a, b) => b.score - a.score);
        
        tableHtml += `<table class="leaderboard-table" style="width:100%">
            <tr><th>Name</th><th>Hour</th><th>Score</th></tr>
            ${agg.map(r => `<tr${r.lastname == lastname && r.hour == hour ? ' style="background:#05B25A22"' : ''}>
                <td>${r.lastname}</td><td>${r.hour}</td><td>${r.score}</td>
            </tr>`).join('')}
        </table>`;
    }
    document.getElementById('leaderboard-content').innerHTML = tableHtml;
}

// Global function for the Level Switch buttons
window.changeLevel = (lvl, game, scope) => {
    currentLevel = lvl;
    renderLeaderboard(game, scope);
};

(async () => {
    await showUserInfo();
    renderLeaderboard('addition', 'class');
})();
