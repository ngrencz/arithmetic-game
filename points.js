import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');
const gameTypes = ["addition", "subtraction", "multiplication", "division", "exponents"];
const scopeTypes = ["class", "overall"];

function showUserInfo() {
  let info = `<h2>Welcome ${lastname} (Hour ${hour})</h2>`;
  let points = localStorage.getItem(`mathgame_${lastname}_${hour}_points`) || "0";
  info += "<ul>";
  for (const gt of gameTypes) {
    const best = localStorage.getItem(`mathgame_${lastname}_${hour}_bestscore_${gt}`) || "0";
    info += `<li>Best ${gt}: <b>${best}</b></li>`;
  }
  info += `</ul><b>Your Points: ${points}</b>`;
  document.getElementById('user-info').innerHTML = info;
}

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
  return Object.values(users).sort((a, b) => b.points - a.points);
}

async function getLeaderboard(gameType, scope) {
  let qb = supabase.from('scores')
    .select('lastname, hour, score, points, game_type')
    .eq('game_type', gameType);

  if (scope === "class") qb = qb.eq('hour', hour);

  const { data, error } = await qb;
  if (error) return `<p>Error: ${error.message}</p>`;
  if (!data || !data.length) return `<p>No scores yet!</p>`;

  const agg = aggregateLeaderboard(data);
  let rows = agg.map(row =>
    `<tr${row.lastname == lastname && row.hour == hour ? ' style="background:#05B25A22"' : ''}>
      <td>${row.lastname}</td>
      <td>${row.hour}</td>
      <td>${row.score}</td>
      <td>${row.points}</td>
    </tr>`
  ).join('');
  return `<table>
    <tr><th>Last Name</th><th>Hour</th><th>Best Score</th><th>Points</th></tr>
    ${rows}
  </table>`;
}

// LEVEL ONE: Show operations menu
function buildOperationMenu(selectedGame) {
  const menuBar = document.getElementById('menu-bar');
  menuBar.innerHTML = '';
  for (const g of gameTypes) {
    const btn = document.createElement('button');
    btn.className = (g === selectedGame ? 'active' : '');
    btn.textContent = g[0].toUpperCase() + g.slice(1);
    btn.onclick = () => {
      buildScopeMenu(g, "class"); // Default to "class" when changing op
      renderLeaderboard(g, "class");
    };
    menuBar.appendChild(btn);
  }
}

// LEVEL TWO: Show scope menu after op clicked
function buildScopeMenu(gameType, selectedScope) {
  const submenuBar = document.getElementById('submenu-bar');
  submenuBar.innerHTML = '';
  for (const s of scopeTypes) {
    const btn = document.createElement('button');
    btn.className = (s === selectedScope ? 'active' : '');
    btn.textContent = (s === "class" ? `Class Hour (${hour})` : 'Overall');
    btn.onclick = () => {
      buildScopeMenu(gameType, s); // To update active state
      renderLeaderboard(gameType, s);
    };
    submenuBar.appendChild(btn);
  }
}

// RENDER
async function renderLeaderboard(gameType, scope) {
  buildOperationMenu(gameType);
  buildScopeMenu(gameType, scope);
  document.getElementById('leaderboard-content').innerHTML = "Loading...";
  const html = await getLeaderboard(gameType, scope);
  document.getElementById('leaderboard-content').innerHTML = html;
}

// INIT
showUserInfo();
renderLeaderboard('addition', 'class');
