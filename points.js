import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "YOUR-SUPABASE-KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');

const gameTypes = ["addition","subtraction","multiplication","division","exponents"];
const scopeTypes = ["class","overall"];

// Build menu bar
function buildMenuBar(selectedGame, selectedScope) {
  const menuBar = document.getElementById('menu-bar');
  menuBar.innerHTML = '';
  for (const g of gameTypes) {
    for (const s of scopeTypes) {
      const active = (g === selectedGame && s === selectedScope) ? 'active' : '';
      const btn = document.createElement('button');
      btn.className = active;
      btn.textContent = `${g[0].toUpperCase() + g.slice(1)} (${s})`;
      btn.onclick = () => renderLeaderboard(g, s);
      menuBar.appendChild(btn);
    }
  }
}

// Display user's own info and best scores per operation
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

// Fetch scores for selected operation and scope
async function getLeaderboard(gameType, scope) {
  let qb = supabase.from('scores')
    .select('lastname, hour, score, points')
    .eq('game_type', gameType)
    .order('points',{ ascending: false });

  if (scope === "class") qb = qb.eq('hour', hour);

  // Only show top best score per person per hour:
  // You may want to adjust this to aggregate; here’s a simple version:
  const { data, error } = await qb;
  if (error) return `<p>Error: ${error.message}</p>`;
  if (!data || !data.length) return `<p>No scores yet!</p>`;

  // Bonus: Highlight my row
  let rows = data.map(row =>
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

// Render the selected leaderboard
async function renderLeaderboard(gameType, scope) {
  buildMenuBar(gameType, scope);
  document.getElementById('leaderboard-content').innerHTML = "Loading...";
  const html = await getLeaderboard(gameType, scope);
  document.getElementById('leaderboard-content').innerHTML = html;
}

showUserInfo();
// Default to Addition (Class)
renderLeaderboard('addition', 'class');
