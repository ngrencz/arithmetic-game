import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "YOUR-SUPABASE-KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');
const gameTypes = ["addition","subtraction","multiplication","division","exponents"];
const scopeTypes = ["class","overall"];

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

// Aggregates to keep best score + points per student
function aggregateLeaderboard(data) {
  // Keys: lastname + hour
  const users = {};
  data.forEach(row => {
    const key = row.lastname + "/" + row.hour;
    // Only keep entry if it's a higher score
    if (!users[key] || row.score > users[key].score) {
      users[key] = {
        lastname: row.lastname,
        hour: row.hour,
        score: row.score,
        points: row.points
      };
    }
  });
  // Sorting by points descending
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

  // Aggregate best scores per user
  const agg = aggregateLeaderboard(data);
  let rows = agg.map(row =>
    `<tr${row.lastname==lastname&&row.hour==hour ? ' style="background:#05B25A22"' : ''}>
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

// Menu and render logic omitted for brevity, matches previous example:
function buildMenuBar(selectedGame, selectedScope) { /* ... */ }
async function renderLeaderboard(gameType, scope) { /* ... */ }

showUserInfo();
renderLeaderboard('addition', 'class');
