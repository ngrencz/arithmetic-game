import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.38.5";
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI"; // your key 
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const lastname = localStorage.getItem('mathgame_lastname');
const hour = localStorage.getItem('mathgame_hour');

const gameTypes = ["addition","subtraction","multiplication","division","exponents"];

async function getUserStats() {
  let info = `<h2>Welcome ${lastname} (Hour ${hour})</h2>`;
  let points = 0;
  info += '<ul>';
  for (const gt of gameTypes) {
    const best = localStorage.getItem(`mathgame_${lastname}_${hour}_bestscore_${gt}`) || "0";
    info += `<li>Best ${gt}: <b>${best}</b></li>`;
  }
  points = localStorage.getItem(`mathgame_${lastname}_${hour}_points`) || "0";
  info += `</ul><b>Your Points: ${points}</b>`;
  document.getElementById('user-info').innerHTML = info;
}

async function getLeaderboard(filterHour = null) {
  let query = supabase.from('scores').select('lastname,hour,points').order('points', { ascending: false }).limit(20);
  if (filterHour) query = query.eq('hour', filterHour);
  const { data, error } = await query;
  if (error) return `<p>Error: ${error.message}</p>`;
  if (!data || !data.length) return `<p>No scores yet!</p>`;
  let rows = data.map(row => `<tr><td>${row.lastname}</td><td>${row.hour}</td><td>${row.points}</td></tr>`).join('');
  return `<table><tr><th>Last Name</th><th>Hour</th><th>Points</th></tr>${rows}</table>`;
}

async function renderLeaderboards() {
  document.getElementById('class-leaderboard').innerHTML = "Loading...";
  document.getElementById('class-leaderboard').innerHTML = await getLeaderboard(hour);

  document.getElementById('all-leaderboard').innerHTML = "Loading...";
  document.getElementById('all-leaderboard').innerHTML = await getLeaderboard();
}

getUserStats();
renderLeaderboards();
