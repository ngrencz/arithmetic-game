I hear you—let’s stop over-complicating it. The "broken" moment happened when we tried to delete that duplicate line and the logic for the buttons got disconnected.

Here is the exact last working structure, fixed with the correct syntax for the 3x2 grid and the color-coding. I have double-checked every bracket.

JavaScript
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

let currentLevel = 1; 

// --- 1. REDEEM POINTS ---
document.getElementById('redeem-btn').onclick = async function() {
    const redeemAmount = parseInt(document.getElementById('redeem-amount').value, 10);
    const msgBox = document.getElementById('redeem-message');

    const { data } = await supabase.from('scores').select('points').eq('lastname', lastname).eq('hour', hour);
    const totalPoints = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;

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
    await showUserInfo();
};

// --- 2. USER STATS TABLE ---
async function showUserInfo() {
    const { data } = await supabase.from('scores').select('game_type, score, points').eq('lastname', lastname).eq('hour', hour);
    const points = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;
    
    const msgBox = document.getElementById('redeem-message');
    if (msgBox) msgBox.innerHTML = `Balance: <strong>${points}</strong>`;

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

    for (const gt of gameTypes) {
        const rows1 = data ? data.filter(r => r.game_type === gt) : [];
        const best1 = rows1.length > 0 ? Math.max(...rows1.map(r => r.score || 0)) : 0;
        const rows2 = data ? data.filter(r => r.game_type === gt + "_lvl2") : [];
        const best2 = rows2.length > 0 ? Math.max(...rows2.map(r => r.score || 0)) : 0;

        html += `<tr>
            <td style="text-align:left; text-transform:capitalize;">${gt}</td>
            <td>${best1}</td>
            <td style="color:#d9534f; font-weight:bold;">${best2}</td>
        </tr>`;
    }
    html += `</tbody></table>`;
    document.getElementById('user-info').innerHTML = html;
}

// --- 3. LEADERBOARD ---
async function renderLeaderboard(gameType, scope) {
    const contentDiv = document.getElementById('leaderboard-content');
    const menuBar = document.getElementById('menu-bar');
    const submenuBar = document.getElementById('submenu-bar');

    // Build Game Grid (3x2)
    menuBar.innerHTML = '';
    menuBar.style.display = 'grid';
    menuBar.style.gridTemplateColumns = 'repeat(3, 1fr)';
    menuBar.style.gap = '8px';
    menuBar.style.marginBottom = '15px';

    gameTypes.forEach(g => {
        const btn = document.createElement('button');
        const isSel = (g === gameType);
        btn.className = isSel ? 'active' : '';
        if (isSel) { btn.style.backgroundColor = '#03793A'; btn.style.color = 'white'; }
        btn.textContent = g.charAt(0).toUpperCase() + g.slice(1);
        btn.onclick = () => renderLeaderboard(g, scope);
        menuBar.appendChild(btn);
    });

    // Build Scope Menu
    submenuBar.innerHTML = '';
    scopeTypes.forEach(s => {
        const btn = document.createElement('button');
        const isAct = (s === scope);
        btn.className = isAct ? 'active' : '';
        if (isAct) { btn.style.backgroundColor = '#03793A'; btn.style.color = 'white'; }
        btn.textContent = (s === 'class' ? 'Hour ' + hour : 'Overall');
        btn.onclick = () => renderLeaderboard(gameType, s);
        submenuBar.appendChild(btn);
    });

    // Level Toggle
    const is1 = (currentLevel === 1);
    const is2 = (currentLevel === 2);
    const levelToggleHtml = `
        <div style="text-align:right; margin-bottom:10px;">
            <span style="font-weight:bold; margin-right:10px; font-size: 0.9em;">Difficulty:</span>
            <button id="set-lvl1" class="${is1?'active':''}" style="background:${is1?'#03793A':''}; color:${is1?'white':''};">Level 1</button>
            <button id="set-lvl2" class="${is2?'active':''}" style="background:${is2?'#d9534f':''}; color:${is2?'white':'#d9534f'}; border:1px solid #d9534f;">Level 2</button>
        </div>`;

    contentDiv.innerHTML = levelToggleHtml + "<p style='text-align:center;'>Loading...</p>";

    // Attach Toggle Clicks
    document.getElementById('set-lvl1').onclick = () => { currentLevel = 1; renderLeaderboard(gameType, scope); };
    document.getElementById('set-lvl2').onclick = () => { currentLevel = 2; renderLeaderboard(gameType, scope); };

    // Fetch
    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data } = await qb;
    let tableHtml = levelToggleHtml;

    if (!data || data.length === 0) {
        tableHtml += `<p style="text-align:center; padding: 20px;">No scores yet!</p>`;
    } else {
        const users = {};
        data.forEach(row => {
            const key = row.lastname + "/" + row.hour;
            if (!users[key] || row.score > users[key].score) users[key] = row;
        });
        const agg = Object.values(users).sort((a, b) => b.score - a.score);
        
        tableHtml += `<table class="leaderboard-table" style="width:100%">
            <tr><th>Name</th><th>Hour</th><th>Score</th></tr>
            ${agg.map(r => `<tr${r.lastname==lastname && r.hour==hour ? ' style="background:#03793A22; font-weight:bold;"':''}>
                <td>${r.lastname}</td><td>${r.hour}</td><td>${r.score}</td>
            </tr>`).join('')}
        </table>`;
    }
    contentDiv.innerHTML = tableHtml;

    // Re-attach Toggle Clicks after table load
    document.getElementById('set-lvl1').onclick = () => { currentLevel = 1; renderLeaderboard(gameType, scope); };
    document.getElementById('set-lvl2').onclick = () => { currentLevel = 2; renderLeaderboard(gameType, scope); };
}

// --- START ---
(async () => {
    await showUserInfo();
    renderLeaderboard('addition', 'class');
})();
