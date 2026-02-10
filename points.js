import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname') || "";
const hour = localStorage.getItem('mathgame_hour') || "";
const gameModes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];

let currentView = "addition"; // Default game to show
let currentLevelView = 1;     // Toggle between 1 and 2

async function init() {
    updateUserInfo();
    setupMenu();
    loadLeaderboard();
    setupRedemption();
}

// --- Display Student's Stats ---
async function updateUserInfo() {
    if (!lastname || !hour) return;

    const { data, error } = await supabase
        .from('scores')
        .select('game_type, score, points')
        .eq('lastname', lastname)
        .eq('hour', hour);

    if (error) return;

    let totalPoints = 0;
    const bests = {}; // Store best scores for each mode/level

    data.forEach(row => {
        totalPoints += (row.points || 0);
        if (!bests[row.game_type] || row.score > bests[row.game_type]) {
            bests[row.game_type] = row.score;
        }
    });

    let statsHTML = `<div class="card-box">
        <h2>Welcome, ${lastname}!</h2>
        <p style="font-size:1.5em; color:#03793A;">Total Points Available: <strong>${totalPoints}</strong></p>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; text-align:left; font-size:0.9em;">
            <div><strong>Mode</strong></div><div><strong>Lvl 1 | Lvl 2</strong></div>`;

    gameModes.forEach(mode => {
        const s1 = bests[mode] || 0;
        const s2 = bests[mode + "_lvl2"] || 0;
        statsHTML += `<div>${mode}:</div><div>${s1} | <span style="color:#d9534f">${s2}</span></div>`;
    });

    statsHTML += `</div></div>`;
    document.getElementById('user-info').innerHTML = statsHTML;
}

// --- Setup Leaderboard Menus ---
function setupMenu() {
    const menu = document.getElementById('menu-bar');
    const submenu = document.getElementById('submenu-bar');

    // Game Mode Tabs
    gameModes.forEach(mode => {
        const btn = document.createElement('button');
        btn.textContent = mode.toUpperCase();
        btn.onclick = () => { currentView = mode; loadLeaderboard(); };
        menu.appendChild(btn);
    });

    // Level Toggle
    submenu.innerHTML = `
        <button onclick="window.setLevel(1)">Level 1 Leaderboard</button>
        <button onclick="window.setLevel(2)" style="color:#d9534f">Level 2 Leaderboard</button>
    `;
}

window.setLevel = (lvl) => {
    currentLevelView = lvl;
    loadLeaderboard();
};

// --- Load the actual Leaderboard ---
async function loadLeaderboard() {
    const dbType = currentLevelView === 2 ? `${currentView}_lvl2` : currentView;
    
    const { data, error } = await supabase
        .from('scores')
        .select('lastname, hour, score')
        .eq('game_type', dbType)
        .order('score', { ascending: false })
        .limit(10);

    let html = `<h3>Top 10: ${currentView.toUpperCase()} (Level ${currentLevelView})</h3>
                <table style="width:100%"><tr><th>Name</th><th>Hour</th><th>Score</th></tr>`;
    
    if (data && data.length > 0) {
        data.forEach(row => {
            html += `<tr><td>${row.lastname}</td><td>${row.hour}</td><td>${row.score}</td></tr>`;
        });
    } else {
        html += `<tr><td colspan="3">No scores yet!</td></tr>`;
    }
    html += `</table>`;
    document.getElementById('leaderboard-content').innerHTML = html;
}

// --- Handle Point Redemption ---
function setupRedemption() {
    const btn = document.getElementById('redeem-btn');
    btn.onclick = async () => {
        const amount = parseInt(document.getElementById('redeem-amount').value);
        if (!lastname || isNaN(amount) || amount <= 0) return;

        const { error } = await supabase.from('scores').insert([{
            lastname, hour, points: -amount, game_type: 'redeem', score: 0
        }]);

        const msg = document.getElementById('redeem-message');
        if (!error) {
            msg.textContent = "Successfully redeemed!";
            msg.style.color = "green";
            updateUserInfo(); // Refresh points
        } else {
            msg.textContent = "Error redeeming.";
            msg.style.color = "red";
        }
    };
}

init();
