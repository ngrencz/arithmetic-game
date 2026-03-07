import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";

const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Aggressively hunt for the user ID across both Bellringer and Module storage
const urlParams = new URLSearchParams(window.location.search);
const lastname = urlParams.get('lastname') || sessionStorage.getItem('target_user') || localStorage.getItem('mathgame_lastname') || "";
const hour = urlParams.get('hour') || sessionStorage.getItem('target_hour') || localStorage.getItem('mathgame_hour') || "00";

const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents", "roots"];
let currentLevel = 1; 
let cachedAllData = []; 

document.addEventListener('DOMContentLoaded', () => { initPage(); });

// --- SMART ALIAS GENERATOR ---
const adjectives = ["Acute", "Obtuse", "Right", "Radical", "Rational", "Prime", "Even", "Odd", "Linear", "Quadratic", "Absolute", "Infinite", "Parallel", "Similar", "Congruent", "Positive", "Negative"];
const nouns = ["Axolotl", "Badger", "Cheetah", "Dolphin", "Falcon", "Giraffe", "Iguana", "Jaguar", "Kangaroo", "Ostrich", "Penguin", "Raccoon", "Tiger", "Walrus", "Zebra", "Rhino", "Panda"];

function getAnonymousAlias(rawString) {
    if (!rawString) return "Mystery Player";
    
    // If it's a legacy nickname (no dashes, no @, standard length), don't change it
    if (!rawString.includes('-') && !rawString.includes('@') && rawString.length < 25) {
        return rawString.charAt(0).toUpperCase() + rawString.slice(1);
    }
    
    // Otherwise, it's an SSO UUID. Hash it.
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
        hash = ((hash << 5) - hash) + rawString.charCodeAt(i);
        hash = hash & hash; 
    }
    hash = Math.abs(hash);

    return `${adjectives[hash % adjectives.length]} ${nouns[(hash >> 3) % nouns.length]}`;
}

// Bypasses 1000 row limit
async function fetchAllScores() {
    let allData = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase.from('scores').select('lastname, hour, score, points, game_type').neq('lastname', null).range(from, from + step - 1);
        if (error) break;
        if (data && data.length > 0) {
            allData = allData.concat(data);
            from += step;
            if (data.length < step) hasMore = false; 
        } else { hasMore = false; }
    }
    return allData;
}

async function initPage() {
    cachedAllData = await fetchAllScores();
    showUserInfo();
    renderLeaderboard('addition', 'class');
    setupRedemption();
}

// --- USER INFO, PBS, AND RANKS ---
function showUserInfo() {
    const myData = cachedAllData.filter(r => r.lastname === lastname && r.hour === hour);
    const totalPoints = myData.reduce((acc, row) => acc + (row.points || 0), 0);
    
    const pbs = { addition: {score:0, rank:'-'}, subtraction: {score:0, rank:'-'}, multiplication: {score:0, rank:'-'}, division: {score:0, rank:'-'}, exponents: {score:0, rank:'-'}, roots: {score:0, rank:'-'} };
    
    // 1. Get Personal Bests
    myData.forEach(r => {
        const baseGame = r.game_type.replace('_lvl2', '');
        if (pbs[baseGame] !== undefined && r.score > pbs[baseGame].score) pbs[baseGame].score = r.score;
    });

    // 2. Calculate Global Rank for each PB
    gameTypes.forEach(gt => {
        const gameData = cachedAllData.filter(r => r.game_type === gt && r.score > 0);
        const bestScores = {};
        gameData.forEach(r => {
            if (!bestScores[r.lastname] || r.score > bestScores[r.lastname]) bestScores[r.lastname] = r.score;
        });
        const sorted = Object.entries(bestScores).sort((a, b) => b[1] - a[1]);
        const myRankIndex = sorted.findIndex(x => x[0] === lastname);
        if (myRankIndex !== -1 && pbs[gt].score > 0) pbs[gt].rank = `#${myRankIndex + 1}`;
    });

    let pbHtml = `<div class="pb-grid">`;
    gameTypes.forEach(gt => {
        pbHtml += `<div class="pb-item"><div style="font-size:0.75rem; color:#64748b; text-transform:uppercase; font-weight:bold;">${gt}</div><div class="pb-val">${pbs[gt].score}</div><div style="font-size:0.8rem; color:#3b82f6; font-weight:bold; margin-top:3px;">Rank: ${pbs[gt].rank}</div></div>`;
    });
    pbHtml += `</div>`;

    document.getElementById('user-info').innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <h2 style="margin:0; color:#1e293b; font-size:1.5rem;">Welcome, ${getAnonymousAlias(lastname)} <span style="font-size:1rem; color:#94a3b8;">(That's you!)</span></h2>
            <div style="font-size:1.2rem; font-weight:bold; color:#10b981; background:#dcfce7; padding:8px 15px; border-radius:20px; border:1px solid #22c55e;">Wallet: ${totalPoints} pts</div>
        </div>
        <h4 style="margin: 25px 0 0 0; color:#334155; border-bottom: 2px solid #f1f5f9; padding-bottom:5px;">Your Personal Bests</h4>
        ${pbHtml}
    `;
}

// --- LEADERBOARD RENDERER ---
function renderLeaderboard(gameType, scope) {
    const menuDiv = document.getElementById('menu-bar');
    menuDiv.innerHTML = gameTypes.map(gt => 
        `<button class="${gt === gameType ? 'active' : ''}" onclick="window.changeGame('${gt}', '${scope}')">${gt.charAt(0).toUpperCase() + gt.slice(1)}</button>`
    ).join('') + `<button class="${gameType === 'overall' ? 'active' : ''}" onclick="window.changeGame('overall', '${scope}')" style="background:#1e293b; color:white; border-color:#0f172a;">Overall Points</button>`;

    const contentDiv = document.getElementById('leaderboard-content');
    let filteredData = cachedAllData;
    if (scope === 'class') filteredData = filteredData.filter(r => r.hour === hour);

    let tableHtml = "";

    if (gameType === 'overall') {
        const pointsMap = {};
        filteredData.forEach(r => {
            if (!r.lastname) return;
            pointsMap[r.lastname] = (pointsMap[r.lastname] || 0) + (r.points || 0);
        });

        const sorted = Object.entries(pointsMap).map(([name, pts]) => ({ lastname: name, points: pts })).sort((a, b) => b.points - a.points).slice(0, 50);

        tableHtml = `
        <div class="lb-controls">
            <div class="control-group" style="visibility:hidden;"><button class="toggle-btn">Placeholder</button></div>
            <h2 style="margin:0; color:#1e293b;">Overall Point Leaders</h2>
            <div class="control-group">
                <button class="toggle-btn ${scope === 'class' ? 'active' : ''}" onclick="window.changeGame('overall', 'class')">My Class</button>
                <button class="toggle-btn ${scope === 'overall' ? 'active' : ''}" onclick="window.changeGame('overall', 'overall')">Global</button>
            </div>
        </div>
        <table class="leaderboard-table">
            <tr><th>Rank</th><th>Secret Identity</th><th>Total Points</th></tr>
            ${sorted.map((r, i) => `<tr${r.lastname === lastname ? ' style="background:#fef9c3; border-left: 4px solid #f59e0b;"' : ''}><td><strong style="color:#94a3b8;">#${i + 1}</strong></td><td style="font-weight:bold; color:#334155;">${getAnonymousAlias(r.lastname)}</td><td style="color:#10b981; font-weight:bold;">${r.points} pts</td></tr>`).join('')}
        </table>`;
    } else {
        const dbType = currentLevel === 2 ? `${gameType}_lvl2` : gameType;
        const gameData = filteredData.filter(r => r.game_type === dbType && r.score > 0);
        const bestScores = {};
        
        gameData.forEach(r => {
            if (!r.lastname) return;
            if (!bestScores[r.lastname] || r.score > bestScores[r.lastname].score) bestScores[r.lastname] = r;
        });

        const sorted = Object.values(bestScores).sort((a, b) => b.score - a.score).slice(0, 50);
        const titleStr = gameType.charAt(0).toUpperCase() + gameType.slice(1);

        tableHtml = `
        <div class="lb-controls">
            <div class="control-group">
                <button class="toggle-btn ${currentLevel === 1 ? 'active' : ''}" onclick="window.changeLevel(1, '${gameType}', '${scope}')">Level 1</button>
                <button class="toggle-btn ${currentLevel === 2 ? 'active' : ''}" onclick="window.changeLevel(2, '${gameType}', '${scope}')">Level 2</button>
            </div>
            <h2 style="margin:0; color:#1e293b;">${titleStr} Leaders</h2>
            <div class="control-group">
                <button class="toggle-btn ${scope === 'class' ? 'active' : ''}" onclick="window.changeGame('${gameType}', 'class')">My Class</button>
                <button class="toggle-btn ${scope === 'overall' ? 'active' : ''}" onclick="window.changeGame('${gameType}', 'overall')">Global</button>
            </div>
        </div>
        <table class="leaderboard-table">
            <tr><th>Rank</th><th>Secret Identity</th><th>Best Score</th></tr>
            ${sorted.map((r, i) => `<tr${r.lastname === lastname ? ' style="background:#fef9c3; border-left: 4px solid #f59e0b;"' : ''}><td><strong style="color:#94a3b8;">#${i + 1}</strong></td><td style="font-weight:bold; color:#334155;">${getAnonymousAlias(r.lastname)}</td><td style="color:#3b82f6; font-weight:bold; font-size:1.1rem;">${r.score}</td></tr>`).join('')}
        </table>`;
    }
    
    contentDiv.innerHTML = tableHtml;
}

// --- REDEMPTION ---
function setupRedemption() {
    const btn = document.getElementById('redeem-btn');
    if (!btn) return;
    btn.onclick = async () => {
        const val = parseInt(document.getElementById('redeem-amount').value);
        if (isNaN(val) || val < 1) return;

        const myData = cachedAllData.filter(r => r.lastname === lastname && r.hour === hour);
        const total = myData.reduce((acc, row) => acc + (row.points || 0), 0);

        if (val > total) return alert("Not enough points in your wallet!");

        btn.disabled = true;
        btn.innerText = "Processing...";

        const { error } = await supabase.from('scores').insert([{ lastname, hour, game_type: 'redeem', points: -val, score: 0 }]);
        
        if (!error) {
            document.getElementById('redeem-message').innerHTML = "<span style='color:#10b981;'>Success! Refreshing...</span>";
            setTimeout(() => location.reload(), 1500);
        } else {
            document.getElementById('redeem-message').innerHTML = "<span style='color:#ef4444'>Error redeeming points.</span>";
            btn.disabled = false;
            btn.innerText = "Redeem Now";
        }
    };
}

// --- GLOBALS ---
window.changeGame = function(newGame, newScope) { renderLeaderboard(newGame, newScope); };
window.changeLevel = function(lvl, gameType, scope) { currentLevel = lvl; renderLeaderboard(gameType, scope); };