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

    // 1. Version and UI Setup
    const version = "v1.03-fix"; 
    
    // 2. Build Menus
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

    // 3. Create the Toggle HTML
    const levelToggleHtml = `
        <div style="text-align:right; margin-bottom:10px;">
            <span style="font-size: 0.7em; color: #888; margin-right: 15px;">${version}</span>
            <span style="font-weight:bold; margin-right:10px; font-size: 0.9em;">Difficulty:</span>
            <button id="set-lvl1" class="lvl-btn" 
                style="color:${currentLevel === 1 ? 'white' : '#03793A'}; background:${currentLevel === 1 ? '#03793A' : 'transparent'}; border: 1px solid #03793A; padding: 5px 10px; cursor: pointer; border-radius: 4px;">
                Level 1
            </button>
            <button id="set-lvl2" class="lvl-btn" 
                style="color:${currentLevel === 2 ? 'white' : '#d9534f'}; background:${currentLevel === 2 ? '#d9534f' : 'transparent'}; border: 1px solid #d9534f; padding: 5px 10px; cursor: pointer; border-radius: 4px;">
                Level 2
            </button>
        </div>`;

    contentDiv.innerHTML = levelToggleHtml + "<p>Loading Leaderboard...</p>";

    // --- THE FIX: Attach listeners immediately after setting innerHTML ---
    document.getElementById('set-lvl1').addEventListener('click', () => {
        if (currentLevel !== 1) {
            currentLevel = 1;
            renderLeaderboard(gameType, scope);
        }
    });

    document.getElementById('set-lvl2').addEventListener('click', () => {
        if (currentLevel !== 2) {
            currentLevel = 2;
            renderLeaderboard(gameType, scope);
        }
    });

    // 4. Fetch Data from Supabase
    const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
    let qb = supabase.from('scores').select('lastname, hour, score').eq('game_type', dbType);
    if (scope === "class") qb = qb.eq('hour', hour);

    const { data, error } = await qb;
    
    // 5. Render Table
    let tableHtml = levelToggleHtml; // Keep the buttons at the top
    if (!data || data.length === 0) {
        tableHtml += `<p style="padding: 20px;">No scores for Level ${currentLevel} yet!</p>`;
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

    // --- RE-ATTACH listeners one last time because we just overwrote the innerHTML again ---
    document.getElementById('set-lvl1').onclick = () => { currentLevel = 1; renderLeaderboard(gameType, scope); };
    document.getElementById('set-lvl2').onclick = () => { currentLevel = 2; renderLeaderboard(gameType, scope); };
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
