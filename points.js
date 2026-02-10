import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname') || "";
const hour = localStorage.getItem('mathgame_hour') || "";
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

let currentLevel = 1; 

// --- 1. REDEMPTION LOGIC ---
const redeemBtn = document.getElementById('redeem-btn');
if (redeemBtn) {
    redeemBtn.onclick = async function() {
        const amountInput = document.getElementById('redeem-amount');
        const msgBox = document.getElementById('redeem-message');
        const redeemAmount = parseInt(amountInput.value, 10);

        if (!redeemAmount || redeemAmount < 1) {
            msgBox.style.color = "#c00";
            msgBox.textContent = "Enter at least 1 point.";
            return;
        }

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
        showUserInfo(); 
    };
}

// --- 2. STATS TABLE ---
async function showUserInfo() {
    const userInfoDiv = document.getElementById('user-info');
    if (!userInfoDiv) return;

    const { data, error } = await supabase.from('scores').select('game_type, score, points').eq('lastname', lastname).eq('hour', hour);
    if (error) console.error("Error fetching User Info:", error);

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

    gameTypes.forEach(gt => {
        const rows1 = data ? data.filter(r => r.game_type === gt) : [];
        const best1 = rows1.length > 0 ? Math.max(...rows1.map(r => r.score || 0)) : 0;
        const rows2 = data ? data.filter(r => r.game_type === gt + "_lvl2") : [];
        const best2 = rows2.length > 0 ? Math.max(...rows2.map(r => r.score || 0)) : 0;

        html += `<tr>
            <td style="text-align:left; text-transform:capitalize;">${gt}</td>
            <td>${best1}</td>
            <td style="color:#d9534f;">${best2}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    userInfoDiv.innerHTML = html;
}

// --- 3. LEADERBOARD SYSTEM ---
async function renderLeaderboard(gameType, scope) {
    const contentDiv = document.getElementById('leaderboard-content');
    const menuBar = document.getElementById('menu-bar');
    const submenuBar = document.getElementById('submenu-bar');
    if (!contentDiv) return;

    // Build Menus First
    menuBar.innerHTML = '';
    gameTypes.forEach(g => {
        const btn = document.createElement('button');
        btn.className = (g === gameType ? 'active' : '');
        btn.textContent = g.charAt(0).toUpperCase() + g.slice(1);
        btn.onclick = () => renderLeaderboard(g, scope);
        menuBar.appendChild(btn);
    });

    submenuBar.innerHTML = '';
    scopeTypes.forEach(s => {
        const btn = document.createElement('button');
        btn.className = (s === scope ? 'active' : '');
        btn.textContent = (s === "class" ? `Hour ${hour}` : 'Overall');
        btn.onclick = () => renderLeaderboard(gameType, s);
        submenuBar.appendChild(btn);
    });

    const levelToggleHtml = `
        <div style="text-align:right; margin-bottom:10px;">
            <span style="font-weight:bold; margin-right:10px; font-size: 0.9em;">Difficulty:</span>
            <button id="set-lvl1" class="lvl-btn ${currentLevel === 1 ? 'active' : ''}">Level 1</button>
            <button id="set-lvl2" class="lvl-btn ${currentLevel === 2 ? 'active' : ''}" style="color:${currentLevel === 2 ? 'white' : '#d9534f'}; background:${currentLevel === 2 ? '#d9534f' : ''}">Level 2</button>
        </div>`;

    contentDiv.innerHTML = levelToggleHtml + "<p>Loading Leaderboard...</p>";

    // Re-attach Toggle Listeners immediately
    document.getElementById('set-lvl1').onclick = () => { currentLevel = 1; renderLeaderboard(gameType, scope); };
    document.getElementById('set-lvl2').onclick = () => { currentLevel = 2; renderLeaderboard(gameType, scope); };

    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data, error } = await qb;
    if (error) console.error("Leaderboard Error:", error);

    let tableHtml = levelToggleHtml;

    if (!data || data.length === 0) {
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
    contentDiv.innerHTML = tableHtml;

    // Final re-attach for the buttons after the table renders
    document.getElementById('set-lvl1').onclick = () => { currentLevel = 1; renderLeaderboard(gameType, scope); };
    document.getElementById('set-lvl2').onclick = () => { currentLevel = 2; renderLeaderboard(gameType, scope); };
}

// --- INIT ---
(async () => {
    await showUserInfo();
    await renderLeaderboard('addition', 'class');
})();
