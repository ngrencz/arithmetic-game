// --- Supabase Setup ---
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function showMessage(msg, color="green") {
  $("#admin-message").css("color", color).text(msg).fadeIn().delay(1800).fadeOut();
}

// 1. Populate hour dropdown, then load students & points for that hour
async function loadHours() {
  const { data, error } = await supabase
    .from('scores')
    .select('hour');
  if (error) return showMessage("Could not fetch hours", "red");
  const hours = [...new Set(data.map(row => row.hour).filter(h => h))];
  $("#hour-select").empty();
  hours.forEach(hour => {
    $("#hour-select").append(`<option value="${hour}">${hour}</option>`);
  });
}

// Show table of students/points for selected hour
$("#refresh-list").click(async function () {
  const hour = $("#hour-select").val();
  const { data, error } = await supabase
    .from('scores')
    .select('lastname, points')
    .eq('hour', hour);
  if (error) return showMessage("Could not fetch students.", "red");
  // Group by name and sum points
  const table = {};
  data.forEach(row => {
    table[row.lastname] = (table[row.lastname] || 0) + (row.points || 0);
  });
  const $tbody = $("#hour-table tbody").empty();
  Object.entries(table).forEach(([name, points]) => {
    $tbody.append(`<tr><td>${name}</td><td>${points}</td></tr>`);
  });
  showMessage("Hour table updated.", "green");
});

// 2. Manual points add (adds a "scores" entry)
$("#add-points-btn").click(async function () {
  const name = $("#add-points-name").val().trim();
  const hour = $("#add-points-hour").val().trim();
  const gameType = $("#add-points-game-type").val().trim();
  const points = parseInt($("#add-points-amount").val()) || 1;
  if (!name || !hour || !gameType) return showMessage("Missing info to add points.", "red");
  // Insert dummy "score" to add points
  const { error } = await supabase
    .from('scores')
    .insert([{lastname: name, hour, game_type: gameType, score: 0, points}]);
  showMessage(error ? "Error adding points." : "Points added!");
});

// 3. Change a student's hour (all scores under old hour get new hour)
$("#change-hour-btn").click(async function () {
  const name = $("#change-hour-name").val().trim();
  const oldHour = $("#change-hour-old-hour").val().trim();
  const newHour = $("#change-hour-new-hour").val().trim();
  if (!name || !oldHour || !newHour) return showMessage("Need name, both hours.", "red");
  const { error, data } = await supabase
    .from('scores')
    .update({hour: newHour})
    .eq('lastname', name)
    .eq('hour', oldHour);
  showMessage(error ? "Error changing hour." : `Hour updated! ${data?.length || 'No'} rows modified.`);
});

// 4. Add student (insert into scores for login)
$("#add-student-btn").click(async function () {
  const name = $("#add-student-name").val().trim();
  if (!name) return showMessage("Please enter a name.", "red");
  // Add with empty hour/game_type/0 scores/points as dummy entry
  const { error } = await supabase
    .from('scores')
    .insert([{lastname: name, hour: '', game_type: '', score: 0, points: 0}]);
  showMessage(error ? "Error adding student." : "Student added!");
});

// 5. Change student name everywhere (update all scores for old name)
$("#change-name-btn").click(async function () {
  const oldName = $("#name-old").val().trim();
  const newName = $("#name-new").val().trim();
  if (!oldName || !newName) return showMessage("Need old and new names.", "red");
  const { error, data } = await supabase
    .from('scores')
    .update({lastname: newName})
    .eq('lastname', oldName);
  showMessage(error ? "Error changing name." : `Name changed in ${data?.length || 'No'} rows.`);
});

// 6. Find names with ≤ 2 entries
$("#find-low-count-btn").click(async function () {
  $("#low-count-list").empty().append('<li>Loading...</li>');
  const { data, error } = await supabase.from('scores').select('lastname');
  if (error) return showMessage("Could not load names.", "red");
  const nameCounts = {};
  data.forEach(row => {
    if (row.lastname)
      nameCounts[row.lastname] = (nameCounts[row.lastname] || 0) + 1;
  });
  $("#low-count-list").empty();
  Object.entries(nameCounts)
    .filter(([name, count]) => count <= 2)
    .forEach(([name, count]) => {
      $("#low-count-list").append(`<li>${name}: ${count} entries</li>`);
    });
  if (!Object.values(nameCounts).some(ct => ct <= 2)) {
    $("#low-count-list").append(`<li>No low-count names found.</li>`);
  }
  showMessage("Low-count names checked.", "blue");
});

// On page load, load all available hours
$(function () {
  loadHours();
});
