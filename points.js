import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname') || "";
const hour = localStorage.getItem('mathgame_hour') || "";
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

let currentLevel = 1; 

// This ensures the script waits for the HTML to be ready
document.addEventListener('DOMContentLoaded', () => {
    initPage();
});

async function initPage() {
    await showUserInfo();
    await renderLeaderboard('addition', 'class');
    setupRedemption();
}

// --- 1. USER STATS & BALANCE ---
async function showUserInfo() {
    const userInfoDiv = document.getElementById('user-info');
    if (!userInfoDiv) return;

    // Fetch everything for this user
    const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('lastname', lastname)
        .eq('hour', hour);

    if (error) {
        userInfoDiv.innerHTML = "<p>Error connecting to database.</p>";
        return;
    }

    const points = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;
    
    // Update balance display in the redeem box
    const msgBox = document.getElementById('redeem-message');
    if (msgBox) msgBox.innerHTML = `Balance: <strong>${points}</strong>`;

    let html = `<h2 style="font-family: inherit;">Welcome ${lastname} (Hour ${hour})</h2>
    <table class="leaderboard-table" style="width:100%; border-collapse: collapse;">
        <thead>
            <tr>
                <th style="text-align:left; padding: 8px;">Mode</th>
                <th>Level 1</th>
                <th>Level 2</th>
            </tr>
        </thead>
        <tbody>`;

    gameTypes.forEach(gt => {
        const best1 = Math.max(...(data.filter(r => r.game_type === gt).map(r => r.score || 0)), 0);
        const best2 = Math.max(...(data.filter(r => r.game_type === gt + "_lvl2").map(r => r.score || 0)), 0);

        html += `<tr>
            <td style="text-align:left; text-transform:capitalize; padding: 8px;">${gt}</td>
            <td style="text-align:center;">${best1}</td>
            <td style="text-align:center; color:#d9534f;">${best2}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    userInfoDiv.innerHTML = html;
}

// --- 2. LEADERBOARD ---
async function renderLeaderboard(gameType, scope) {
    const contentDiv = document.getElementById('leaderboard-content');
    const menuBar = document.getElementById('menu-bar');
    const submenuBar = document.getElementById('submenu-bar');
    if (!contentDiv) return;

    // Build Game Menu
    menuBar.innerHTML = '';
    // Apply grid styling to the menuBar container
    menuBar.style.display = 'grid';
    menuBar.style.gridTemplateColumns = 'repeat(3, 1fr)'; // 3 equal columns
    menuBar.style.gap = '8px'; // Space between buttons
    menuBar.style.marginBottom = '15px';

    gameTypes.forEach(g => {
        const btn = document.createElement('button');
        btn.className = (g === gameType ? 'active' : '');
        // Remove default margins so the grid handles spacing
        btn.style.margin = '0'; 
        btn.style.width = '100%';
        btn.textContent = g.charAt(0).toUpperCase() + g.slice(1);
        btn.onclick = () => renderLeaderboard(g, scope);
        menuBar.appendChild(btn);
    });

    // Build Scope Menu
    submenuBar.innerHTML = scopeTypes.map(s => 
        `<button class="${s === scope ? 'active' : ''}" onclick="window.dispatchLeaderboard('${gameType}', '${s}')">${s === 'class' ? 'Hour ' + hour : 'Overall'}</button>`
    ).join('');

    // Level Toggle
    const levelToggleHtml = `
        <div style="text-align:right; margin-bottom:10px;">
            <span style="font-weight:bold; margin-right:10px; font-size: 0.9em;">Difficulty:</span>
            <button id="set-lvl1" class="lvl-btn ${currentLevel === 1 ? 'active' : ''}" 
                style="color:${currentLevel === 1 ? 'white' : '#03793A'}; background:${currentLevel === 1 ? '#03793A' : ''}">
                Level 1
            </button>
            <button id="set-lvl2" class="lvl-btn ${currentLevel === 2 ? 'active' : ''}" 
                style="color:${currentLevel === 2 ? 'white' : '#d9534f'}; background:${currentLevel === 2 ? '#d9534f' : ''}">
                Level 2
            </button>
        </div>`;

    contentDiv.innerHTML = levelToggleHtml + "<p>Loading...</p>";

    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data } = await qb;

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
}

// --- 3. REDEMPTION ---
function setupRedemption() {
    const btn = document.getElementById('redeem-btn');
    if (!btn) return;
    btn.onclick = async () => {
        const val = parseInt(document.getElementById('redeem-amount').value);
        if (isNaN(val) || val < 1) return;

        const { data } = await supabase.from('scores').select('points').eq('lastname', lastname).eq('hour', hour);
        const total = data ? data.reduce((acc, row) => acc + (row.points || 0), 0) : 0;

        if (val > total) {
            alert("Not enough points!");
            return;
        }

        await supabase.from('scores').insert([{ lastname, hour, game_type: 'redeem', points: -val, score: 0 }]);
        showUserInfo();
    };
}

// --- GLOBAL HELPERS (Required for onclick in modules) ---
window.dispatchLeaderboard = (g, s) => renderLeaderboard(g, s);
window.changeLevel = (l, g, s) => { currentLevel = l; renderLeaderboard(g, s); };
