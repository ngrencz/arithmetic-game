// --- Supabase Setup ---
const SUPABASE_URL = "https://khazeoycsjdqnmwodncw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoYXplb3ljc2pkcW5td29kbmN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MDMwOTMsImV4cCI6MjA3ODQ3OTA5M30.h-WabaGcQZ968sO2ImetccUaRihRFmO2mUKCdPiAbEI";
const adminSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function loadStudentNamesForHour(hour) {
  if (!hour) {
    let $dropdown = $("#add-points-name").empty();
    $dropdown.append('<option value="">Select Student</option>');
    return;
  }
  const { data, error } = await adminSupabase
    .from('scores')
    .select('lastname')
    .eq('hour', hour);
  if (error) return showMessage("Could not fetch names", "red");
  let names = [...new Set(data.map(row => row.lastname).filter(n => n && n.trim() !== ""))];
  names.sort((a, b) => a.localeCompare(b));
  let $dropdown = $("#add-points-name").empty();
  $dropdown.append('<option value="">Select Student</option>');
  names.forEach(name => {
    $dropdown.append(`<option value="${name}">${name}</option>`);
  });
}

// (2) Then create this as its own function (move it OUT of the other function):

async function loadAllStudentsWithHour() {
  const { data, error } = await adminSupabase
    .from('scores')
    .select('lastname, hour');
  if (error) return showMessage("Could not fetch students", "red");
  let pairs = [];
  const seen = new Set();
  data.forEach(row => {
    const key = `${row.lastname}|${row.hour}`;
    if (row.lastname && row.hour && !seen.has(key)) {
      pairs.push({ lastname: row.lastname, hour: row.hour });
      seen.add(key);
    }
  });
  pairs.sort((a, b) => {
    const nameCompare = a.lastname.localeCompare(b.lastname);
    if (nameCompare !== 0) return nameCompare;
    return a.hour.localeCompare(b.hour);
  });
  let $dropdown = $("#change-hour-student").empty();
  $dropdown.append('<option value="">Select Student</option>');
  pairs.forEach(pair => {
    $dropdown.append(
      `<option value="${pair.lastname}" data-hour="${pair.hour}">${pair.lastname}</option>`
    );
  });
}
$(function () {
  loadHours();
  loadAllStudentsWithHour();
});

$("#add-points-hour").on("change", function() {
  const hour = $(this).val();
  loadStudentNamesForHour(hour);
});
$("#change-hour-student").on("change", function() {
  const $selectedOption = $("#change-hour-student option:selected");
  const selectedHour = $selectedOption.data("hour");
  $("#change-hour-old-hour").val(selectedHour);
});
function showMessage(msg, color="green") {
  $("#admin-message").css("color", color).text(msg).fadeIn().delay(1800).fadeOut();
}

// 1. Populate hour dropdown, then load students & points for that hour
async function loadHours() {
  const { data, error } = await adminSupabase
    .from('scores')
    .select('hour');
  if (error) return showMessage("Could not fetch hours", "red");
  let hours = [...new Set(data.map(row => row.hour).filter(h => h))];
  // Sort hours (alphabetically; for numbers, add custom logic!)
  hours = hours.sort((a, b) => {
    // If hours are numbers, sort numerically.
    // If mixed, sort alphabetically.
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });
  $("#hour-select").empty();
  hours.forEach(hour => {
    $("#hour-select").append(`<option value="${hour}">${hour}</option>`);
  });
}

// Weekly Participation report
async function generateWeeklyParticipationReport() {
  const weekStartInput = document.getElementById('week-start-date').value;
  const selectedHour = document.getElementById('report-hour-select').value; 

  if (!weekStartInput) {
    return showMessage("Please select a week start date (Monday).", "red");
  }

  // 1. Calculate Date Range (Force to UTC to prevent shifting)
  const weekStart = new Date(weekStartInput + "T00:00:00Z"); // Force UTC start
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 4); // Friday

  const startISO = weekStart.toISOString();
  // Set endISO to the very end of Friday UTC
  const endISO = new Date(weekEnd).toISOString().split('T')[0] + "T23:59:59.999Z";

  // 2. Fetch Student List
  let studentQuery = adminSupabase
    .from('scores')
    .select('lastname, hour')
    .neq('lastname', null);

  if (selectedHour) {
    studentQuery = studentQuery.eq('hour', selectedHour);
  }

  const { data: allStudents, error: allStudentsError } = await studentQuery
    .order('hour', { ascending: true })
    .order('lastname', { ascending: true });

  if (allStudentsError) return showMessage("Error: " + allStudentsError.message, "red");

  const studentHourSet = new Map();
  allStudents.forEach(({lastname, hour}) => {
    if (lastname && hour) {
      const key = lastname + '|' + hour;
      studentHourSet.set(key, {lastname, hour});
    }
  });

  // 3. Fetch Play Entries
  let playsQuery = adminSupabase
    .from('scores')
    .select('lastname, hour, created_at, game_type')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .not('game_type', 'in', '(bonus,redeem)');

  if (selectedHour) {
    playsQuery = playsQuery.eq('hour', selectedHour);
  }

  const { data: plays, error: playsError } = await playsQuery;
  if (playsError) return showMessage("Error: " + playsError.message, "red");

  // 4. Map Participation using UTC Days
  const participationMap = new Map();
  plays.forEach(({lastname, hour, created_at}) => {
    if (!lastname || !hour || !created_at) return;
    const key = lastname + '|' + hour;
    
    const date = new Date(created_at);
    // Use getUTCDay: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const dayOfWeek = date.getUTCDay();
    
    if (dayOfWeek < 1 || dayOfWeek > 5) return; // Skip weekends
    
    if (!participationMap.has(key)) participationMap.set(key, new Set());
    participationMap.get(key).add(dayOfWeek);
  });

  // 5. Build HTML Table
  const allWeekDays = [1, 2, 3, 4, 5]; // Mon, Tue, Wed, Thu, Fri
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let reportHTML = '<h4>Weekly Participation Report</h4>';
  reportHTML += '<table border="1" cellpadding="5"><tr><th>Hour</th><th>Student</th><th>Missing Days</th></tr>';

  studentHourSet.forEach(({lastname, hour}, key) => {
    const playedDayNumbers = participationMap.get(key) || new Set();
    
    // Find which days from [1,2,3,4,5] are NOT in the playedDayNumbers set
    const missingDays = allWeekDays
      .filter(d => !playedDayNumbers.has(d))
      .map(d => dayNames[d]);

    if (missingDays.length > 0) {
      reportHTML += `<tr><td>${hour}</td><td>${lastname}</td><td>${missingDays.join(', ')}</td></tr>`;
    } else {
      // Optional: Show "None" or "Complete" if you want to see everyone
      // reportHTML += `<tr><td>${hour}</td><td>${lastname}</td><td style="color:green;">Complete</td></tr>`;
    }
  });

  reportHTML += '</table>';
  document.getElementById('weekly-report').innerHTML = reportHTML;
  showMessage("Weekly report generated.", "green");
}
// Hook up button
document.getElementById('generate-weekly-report').addEventListener('click', generateWeeklyParticipationReport);

// Show table of students/points for selected hour
$("#refresh-list").click(async function () {
  const hour = $("#hour-select").val();
  const { data, error } = await adminSupabase
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
Object.entries(table)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([name, points]) => {
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
  const { error } = await adminSupabase
    .from('scores')
    .insert([{lastname: name, hour, game_type: gameType, score: 0, points}]);
  showMessage(error ? "Error adding points." : "Points added!");
});

// 3. Change a student's hour (all scores under old hour get new hour)
$("#change-hour-btn").click(async function () {
  const selection = $("#change-hour-student").val();
  const parts = selection.split("|");
  const name = parts[0];
  const oldHour = $("#change-hour-old-hour").val();
  const newHour = $("#change-hour-new-hour").val();
  const check = await adminSupabase
  .from('scores')
  .select('id, lastname, hour')
  .eq('lastname', name)
  .eq('hour', oldHour);
console.log('Matching rows before update:', check.data);
  console.log('ChangeHour Attempt:', { name, oldHour, newHour });
  if (!name || !oldHour || !newHour) return showMessage("Need student and both hours.", "red");
  const { error, data } = await adminSupabase
    .from('scores')
    .update({hour: newHour})
    .eq('lastname', name)
    .eq('hour', oldHour)
    .select();
  console.log('Supabase Update Result:', { error, data });
  showMessage(error ? "Error changing hour." : `Hour updated! ${data?.length || 'No'} rows modified.`);
  // Optionally reload student list to reflect changes:
  loadAllStudentsWithHour();
});

// 4. Add student (insert into scores for login)
$("#add-student-btn").click(async function () {
  const name = $("#add-student-name").val().trim();
  const hour = $("#add-student-hour").val();
  if (!name || !hour) return showMessage("Please enter both name and hour.", "red");
  // Add initial entry for this student and hour only
  const { error } = await adminSupabase
    .from('scores')
    .insert([{lastname: name, hour, game_type: '', score: 0, points: 0}]);
  showMessage(error ? "Error adding student." : "Student added!");
  // Optionally, refresh your lists:
  loadAllStudentsWithHour();
});

// 5. Change student name everywhere (update all scores for old name)
$("#change-name-btn").click(async function () {
  const oldName = $("#name-old").val().trim();
  const newName = $("#name-new").val().trim();
  if (!oldName || !newName) return showMessage("Need old and new names.", "red");
  const { error, data } = await adminSupabase
    .from('scores')
    .update({lastname: newName})
    .eq('lastname', oldName);
  showMessage(error ? "Error changing name." : `Name changed in ${data?.length || 'No'} rows.`);
});

// 6. Find names with ≤ 2 entries
$("#find-low-count-btn").click(async function () {
  $("#low-count-list").empty().append('<li>Loading...</li>');
  const { data, error } = await adminSupabase.from('scores').select('lastname');
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
