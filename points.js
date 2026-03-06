import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname') || "";
const hour = localStorage.getItem('mathgame_hour') || "";
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
const scopeTypes = ["class", "overall"];

let currentLevel = 1; 
let cachedAllData = []; // Stores the full database locally for instant tab switching

document.addEventListener('DOMContentLoaded', () => {
    initPage();
});

// --- 1. INFINITE PAGINATION HELPER ---
// Bypasses the 1,000 row limit by fetching chunks until the database is empty
async function fetchAllScores() {
    let allData = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('scores')
            .select('lastname, hour, score, points, game_type, created_at')
            .neq('lastname', null)
            .range(from, from + step - 1);
        
        if (error) {
            console.error("Error fetching scores:", error);
            break;
        }
        
        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += step;
            if (data.length < step) hasMore = false; // Reached the end
        } else {
            hasMore = false;
        }
    }
    return allData;
}

async function initPage() {
    document.getElementById('user-info').innerHTML = "<h3 style='color:#64748b; margin:0;'>Downloading live data...</h3>";
    document.getElementById('leaderboard-content').innerHTML = "<p style='text-align:center; color:#64748b;'>Syncing global leaderboards...</p>";

    // Fetch EVERYTHING once at boot
    cachedAllData = await fetchAllScores();

    showUserInfo();
    renderLeaderboard('addition', 'class');
    setupRedemption();
}

// --- 2. USER STATS & BALANCE ---
function showUserInfo() {
    const myData = cachedAllData.filter(r => r.lastname === lastname && r.hour === hour);
    const totalPoints = myData.reduce((acc, row) => acc + (row.points || 0), 0);

    let html = `<h2>Welcome, ${lastname} (Hour ${hour})</h2>`;
    html += `<div style="font-size:1.2em; color:#03793A; font-weight:bold; margin-bottom:10px;">Available Points: ${totalPoints}</div>`;
    document.getElementById('user-info').innerHTML = html;
}

// --- 3. LEADERBOARDS ---
function renderLeaderboard(gameType, scope) {
    const menuDiv = document.getElementById('menu-bar');
    menuDiv.innerHTML = gameTypes.map(gt => 
        `<button class="${gt === gameType ? 'active' : ''}" onclick="window.changeGame('${gt}', '${scope}')">${gt.charAt(0).toUpperCase() + gt.slice(1)}</button>`
    ).join('');
    menuDiv.innerHTML += `<button class="${gameType === 'overall' ? 'active' : ''}" onclick="window.changeGame('overall', '${scope}')">Overall Points</button>`;

    const subMenuDiv = document.getElementById('submenu-bar');
    subMenuDiv.innerHTML = scopeTypes.map(st => 
        `<button class="${st === scope ? 'active' : ''}" onclick="window.changeGame('${gameType}', '${st}')">${st.charAt(0).toUpperCase() + st.slice(1)}</button>`
    ).join('');

    const contentDiv = document.getElementById('leaderboard-content');
    
    // Memory filtering makes tab switching instant
    let filteredData = cachedAllData;
    if (scope === 'class') {
        filteredData = filteredData.filter(r => r.hour === hour);
    }

    let tableHtml = "";

    if (gameType === 'overall') {
        const pointsMap = {};
        filteredData.forEach(r => {
            if (!r.lastname) return;
            pointsMap[r.lastname] = (pointsMap[r.lastname] || 0) + (r.points || 0);
        });

        const sorted = Object.entries(pointsMap)
            .map(([name, pts]) => ({ lastname: name, points: pts }))
            .sort((a, b) => b.points - a.points);

        tableHtml = `
        <h3>Overall Points Leaderboard (${scope})</h3>
        <table class="leaderboard-table">
            <tr><th>Rank</th><th>Name</th><th>Total Points</th></tr>
            ${sorted.map((r, i) => `
            <tr${r.lastname === lastname ? ' style="background:#05B25A22"' : ''}>
                <td>${i + 1}</td><td>${r.lastname}</td><td>${r.points}</td>
            </tr>`).join('')}
        </table>`;
    } else {
        const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
        const gameData = filteredData.filter(r => r.game_type === dbType && r.score > 0);
        
        const bestScores = {};
        gameData.forEach(r => {
            if (!r.lastname) return;
            if (!bestScores[r.lastname] || r.score > bestScores[r.lastname].score) {
                bestScores[r.lastname] = r;
            }
        });

        const sorted = Object.values(bestScores).sort((a, b) => b.score - a.score);

        tableHtml = `
        <h3>${gameType.charAt(0).toUpperCase() + gameType.slice(1)} Leaderboard (${scope})</h3>
        <div style="text-align:center; margin-bottom:10px;">
            <button id="set-lvl1" class="${currentLevel === 1 ? 'active' : ''}" style="padding:5px 15px; margin-right:5px; cursor:pointer;">Level 1</button>
            <button id="set-lvl2" class="${currentLevel === 2 ? 'active' : ''}" style="padding:5px 15px; cursor:pointer;">Level 2</button>
        </div>
        <table class="leaderboard-table">
            <tr><th>Rank</th><th>Name</th><th>Score</th></tr>
            ${sorted.map((r, i) => `
            <tr${r.lastname === lastname ? ' style="background:#05B25A22"' : ''}>
                <td>${i + 1}</td><td>${r.lastname}</td><td>${r.score}</td>
            </tr>`).join('')}
        </table>`;
    }
    
    contentDiv.innerHTML = tableHtml;

    if (document.getElementById('set-lvl1')) {
        document.getElementById('set-lvl1').onclick = () => { if(currentLevel!==1){ currentLevel=1; renderLeaderboard(gameType, scope); }};
        document.getElementById('set-lvl2').onclick = () => { if(currentLevel!==2){ currentLevel=2; renderLeaderboard(gameType, scope); }};
    }
}

// --- 4. REDEMPTION ---
function setupRedemption() {
    const btn = document.getElementById('redeem-btn');
    if (!btn) return;
    btn.onclick = async () => {
        const val = parseInt(document.getElementById('redeem-amount').value);
        if (isNaN(val) || val < 1) return;

        const myData = cachedAllData.filter(r => r.lastname === lastname && r.hour === hour);
        const total = myData.reduce((acc, row) => acc + (row.points || 0), 0);

        if (val > total) {
            alert("Not enough points!");
            return;
        }

        btn.disabled = true;
        btn.innerText = "Processing...";

        const { error } = await supabase.from('scores').insert([{ lastname, hour, game_type: 'redeem', points: -val, score: 0 }]);
        
        if (!error) {
            document.getElementById('redeem-message').innerHTML = "<span style='color:green; font-weight:bold;'>Points redeemed successfully! Refreshing...</span>";
            setTimeout(() => location.reload(), 1500);
        } else {
            document.getElementById('redeem-message').innerHTML = "<span style='color:red'>Error redeeming points.</span>";
            btn.disabled = false;
            btn.innerText = "Redeem";
        }
    };
}

// --- GLOBAL HELPERS ---
window.changeGame = function(newGame, newScope) {
    renderLeaderboard(newGame, newScope);
};
