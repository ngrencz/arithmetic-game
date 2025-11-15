import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co"; // your URL
const SUPABASE_KEY = "YOUR-SUPABASE-KEY"; // your key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testLeaderboard() {
  document.getElementById('leaderboard-content').textContent = "Loading...";
  const { data, error } = await supabase
    .from('scores')
    .select('lastname, hour, game_type, score, points')
    .order('points', { ascending: false })
    .limit(10);

  if (error) {
    document.getElementById('leaderboard-content').textContent = "Supabase query error: " + error.message;
    return;
  }
  if (!data || !data.length) {
    document.getElementById('leaderboard-content').textContent = "No scores found in Supabase!";
    return;
  }
  let html = `<table><tr>
    <th>Last Name</th><th>Hour</th><th>Game Type</th>
    <th>Score</th><th>Points</th></tr>`;
  data.forEach(row=>{
    html += `<tr><td>${row.lastname}</td><td>${row.hour}</td>
    <td>${row.game_type}</td><td>${row.score}</td><td>${row.points}</td></tr>`;
  });
  html += `</table>`;
  document.getElementById('leaderboard-content').innerHTML = html;
}
testLeaderboard();
