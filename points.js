import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents"];
const scopeTypes = ["class", "overall"];
document.getElementById('redeem-btn').onclick = async function() {
  const redeemAmount = parseInt(document.getElementById('redeem-amount').value, 10);
  const msgBox = document.getElementById('redeem-message');
  msgBox.style.color = "#c00"; // red for errors

  if (!redeemAmount || redeemAmount < 1) {
    msgBox.textContent = "Enter at least 1 point to redeem.";
    return;
  }

  // 1. Fetch all point transactions for this user/hour
  const { data, error } = await supabase
    .from('scores')
    .select('points')
    .eq('lastname', lastname)
    .eq('hour', hour);

  if (error || !data) {
    msgBox.textContent = "Could not load your points; try again.";
    return;
  }
  // 2. Calculate current balance by sum
  const totalPoints = data.reduce((acc, row) => acc + (row.points || 0), 0);

  if (redeemAmount > totalPoints) {
    msgBox.textContent = `Not enough points! You only have ${totalPoints}.`;
    return;
  }

  // 3. Log the redemption by creating a negative points entry
  const { error: insertError } = await supabase
    .from('scores')
    .insert([{
      lastname,
      hour,
      game_type: 'redeem',          // Use 'redeem' or similar
      score: 0,                     // No game score, this is a redemption
      points: -redeemAmount,        // Negative entry for ledger
      created_at: new Date().toISOString()
    }]);

  if (insertError) {
    msgBox.textContent = "Error recording redemption; try again.";
    return;
  }

  msgBox.style.color = "#03793A"; // green for success
  msgBox.textContent = `Success! Redeemed ${redeemAmount} point${redeemAmount > 1 ? 's' : ''}. You now have ${totalPoints - redeemAmount} points left.`;

  // Optionally, refresh user info display if you want instant update:
  await showUserInfo();
};
// ASYNC: SHOW USER INFO FROM SUPABASE ONLY
async function showUserInfo() {
  document.getElementById('user-info').innerHTML =
    `<h2>Welcome ${lastname} (Hour ${hour})</h2><p>Loading your scores...</p>`;

  const { data, error } = await supabase
    .from('scores')
    .select('game_type, score, points')
    .eq('lastname', lastname)
    .eq('hour', hour);

  if (error || !data || !data.length) {
    document.getElementById('user-info').innerHTML =
      `<h2 id="user-header">Welcome ${lastname} (Hour ${hour})</h2><p>No scores found.</p>`;
    return;
  }

  let info = `<h2 id="user-header">Welcome ${lastname} (Hour ${hour})</h2><ul>`;
  // get their best score per game type from their scores
  let points = data.reduce((acc, row) => acc + (row.points || 0), 0);
  for (const gt of gameTypes) {
    // If you might have multiple rows per gameType, find max score:
    const rows = data.filter(r => r.game_type === gt);
    const bestScore = rows.length > 0 ? Math.max(...rows.map(r => r.score || 0)) : 0;
    info += `<li>Best ${gt}: <b>${bestScore}</b></li>`;
  }
  info += `</ul><b>Your Points: ${points}</b>`;
  document.getElementById('user-info').innerHTML = info;
}

// AGGREGATE LEADERBOARD DATA
function aggregateLeaderboard(data) {
  const users = {};
  data.forEach(row => {
    const key = row.lastname + "/" + row.hour;
    if (!users[key] || row.score > users[key].score) {
      users[key] = {
        lastname: row.lastname,
        hour: row.hour,
        score: row.score,
        points: row.points
      };
    }
  });
  return Object.values(users).sort((a, b) => b.score - a.score);
}

// GET LEADERBOARD DATA PURELY FROM SUPABASE
async function getLeaderboard(gameType, scope) {
  let qb = supabase.from('scores')
    .select('lastname, hour, score, game_type, points')
    .eq('game_type', gameType);

  if (scope === "class") qb = qb.eq('hour', hour);

  const { data, error } = await qb;
  if (error) return `<p>Error: ${error.message}</p>`;
  if (!data || !data.length) return `<p>No scores yet!</p>`;

  // Aggregate: each user's best score for gameType/hour
  const users = {};
  data.forEach(row => {
    const key = row.lastname + "/" + row.hour;
    if (!users[key] || row.score > users[key].score) {
      users[key] = {
        lastname: row.lastname,
        hour: row.hour,
        score: row.score,
        points: row.points
      };
    }
  });
  const agg = Object.values(users).sort((a, b) => b.score - a.score);

  let rows = agg.map(row =>
    `<tr${row.lastname == lastname && row.hour == hour ? ' style="background:#05B25A22"' : ''}>
      <td>${row.lastname}</td>
      <td>${row.hour}</td>
      <td>${row.score}</td>
    </tr>`
  ).join('');

  return `<table>
    <tr><th>Last Name</th><th>Hour</th><th>Best Score</th></tr>
    ${rows}
  </table>`;
}

// MENU SYSTEM (UNCHANGED; PURELY COSMETIC)
function buildOperationMenu(selectedGame) {
  const menuBar = document.getElementById('menu-bar');
  menuBar.innerHTML = '';
  for (const g of gameTypes) {
    const btn = document.createElement('button');
    btn.className = (g === selectedGame ? 'active' : '');
    btn.textContent = g[0].toUpperCase() + g.slice(1);
    btn.onclick = () => {
      buildScopeMenu(g, "class");
      renderLeaderboard(g, "class");
    };
    menuBar.appendChild(btn);
  }
}

function buildScopeMenu(gameType, selectedScope) {
  const submenuBar = document.getElementById('submenu-bar');
  submenuBar.innerHTML = '';
  for (const s of scopeTypes) {
    const btn = document.createElement('button');
    btn.className = (s === selectedScope ? 'active' : '');
    btn.textContent = (s === "class" ? `Class Hour (${hour})` : 'Overall');
    btn.onclick = () => {
      buildScopeMenu(gameType, s);
      renderLeaderboard(gameType, s);
    };
    submenuBar.appendChild(btn);
  }
}

// RENDER BOTH USER INFO AND LEADERBOARD ON LOAD
async function renderLeaderboard(gameType, scope) {
  buildOperationMenu(gameType);
  buildScopeMenu(gameType, scope);
  document.getElementById('leaderboard-content').innerHTML = "Loading...";
  const html = await getLeaderboard(gameType, scope);
  document.getElementById('leaderboard-content').innerHTML = html;
}

// INIT PAGE -- ALL ASYNC
(async () => {
  await showUserInfo();
  renderLeaderboard('addition', 'class');
})();
