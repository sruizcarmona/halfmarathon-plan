// app.js — Fixed, robust, full version
// Works with your plan.json (weeks with "idx" and "sessions" arrays)

// --- CONFIG ---
const PLAN_START = new Date("2025-11-17"); // Monday of week 1 (adjust if you want)
const RACE_DATE  = new Date("2026-01-18");
const STORAGE_KEY = 'hm_plan_progress_v1';
const MS_DAY = 24 * 3600 * 1000;
const MS_WEEK = 7 * MS_DAY;

// --- UTILS ---
function fmtShort(d){
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); // "18 Nov"
}
function fmtFull(d){
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' }); // "Tue, 18 Nov"
}
function safeNumber(v, fallback = 0){
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// day name -> index where Monday=0
const DAY_INDEX = {
  mon:0, monday:0,
  tue:1, tuesday:1,
  wed:2, wednesday:2,
  thu:3, thursday:3,
  fri:4, friday:4,
  sat:5, saturday:5,
  sun:6, sunday:6
};

// --- STATE FOR MONTH NAV ---
let monthGroups = {};   // { "Nov 2025": [weekObj,...], ... }
let monthKeys = [];     // ordered keys
let currentMonthIndex = 0;

// --- LOCALSTORAGE helpers ---
function loadProgress(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e){ return {}; } }
function saveProgress(p){ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function sessionId(weekIdx, sessIdx){ return `w${weekIdx}_s${sessIdx}`; }

// --- Build monthGroups from plan ---
async function loadPlan(){
  const res = await fetch('plan.json');
  if(!res.ok) throw new Error('fetch plan.json failed');
  const plan = await res.json();

  // Reset
  monthGroups = {};

  // Iterate weeks — plan.weeks is expected to be an array
  plan.weeks.forEach((w, i) => {
    // weekIndex: prefer w.idx or fallback to i+1
    const weekIndex = safeNumber(w.idx, i+1);

    // compute weekStart (Monday)
    const weekStart = new Date(PLAN_START.getTime() + (weekIndex - 1) * MS_WEEK);

    // month key like "November 2025"
    const monthKey = weekStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    // store week plus computed metadata for convenience
    const weekCopy = Object.assign({}, w, { _weekIndex: weekIndex, _weekStartMs: weekStart.getTime() });

    if(!monthGroups[monthKey]) monthGroups[monthKey] = [];
    monthGroups[monthKey].push(weekCopy);
  });

  // sort monthKeys chronologically
  monthKeys = Object.keys(monthGroups).sort((a,b)=>{
    // parse first week start of each month for ordering
    const aDate = new Date(monthGroups[a][0]._weekStartMs);
    const bDate = new Date(monthGroups[b][0]._weekStartMs);
    return aDate - bDate;
  });

  // ensure currentMonthIndex points to the first month that contains the current date (if any)
  const now = new Date();
  let foundIndex = monthKeys.findIndex(key => {
    const firstWeekStart = new Date(monthGroups[key][0]._weekStartMs);
    const lastWeek = monthGroups[key][monthGroups[key].length - 1];
    const lastWeekEnd = new Date(lastWeek._weekStartMs + (6 * MS_DAY));
    return now >= firstWeekStart && now <= lastWeekEnd;
  });
  if(foundIndex >= 0) currentMonthIndex = foundIndex;
  else currentMonthIndex = 0;

  renderMonth(monthKeys[currentMonthIndex]);
}

// --- Render one month (replace plan-holder contents) ---
function renderMonth(monthKey){
  const holder = document.getElementById('plan-holder');
  holder.innerHTML = ''; // clear

  // safety
  if(!monthKey || !monthGroups[monthKey]) {
    document.getElementById('month-name').textContent = monthKey || '—';
    holder.innerHTML = '<div class="week-card"><p>No weeks found for this month.</p></div>';
    updateStats(); // still refresh stats
    return;
  }

  document.getElementById('month-name').textContent = monthKey;

  const progress = loadProgress();
  let totalSessions = 0;

  monthGroups[monthKey].forEach((week) => {
    const weekIndex = safeNumber(week._weekIndex, 1);
    const weekStart = new Date(week._weekStartMs);
    const weekEnd = new Date(week._weekStartMs + 6 * MS_DAY);
    const weeksToGoRaw = (RACE_DATE - weekStart) / MS_WEEK;
    const weeksToGo = Math.max(0, Math.ceil(weeksToGoRaw));

    // Build card
    const card = document.createElement('div');
    card.className = 'week-card';

    // header
    const header = document.createElement('div');
    header.className = 'week-header';
    header.innerHTML = `
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;">
        <div>
          <h3 style="margin:0;color:var(--accent2)">${weeksToGo} weeks to go</h3>
          <div style="color:var(--muted);font-size:14px;margin-top:4px">Week ${weekIndex} · ${fmtShort(weekStart)} – ${fmtShort(weekEnd)}</div>
        </div>
        <div style="text-align:right" class="small">Start: ${fmtShort(weekStart)}</div>
      </div>
    `;
    card.appendChild(header);

    // sessions list
    (week.sessions || []).forEach((s, si) => {
      totalSessions += 1;
      const sid = sessionId(weekIndex, si);

      const sess = document.createElement('div');
      sess.className = 'session';
      // compute session date: find day index from s.day (e.g. "Tue")
      const dayKey = String((s.day||'').toLowerCase()).slice(0,3); // 'tue' etc
      const dayIndex = DAY_INDEX[dayKey] ?? DAY_INDEX[(s.day||'').toLowerCase()] ?? 1; // default Tue->1
      const sessionDate = new Date(week._weekStartMs + dayIndex * MS_DAY);

      // progress values
      const p = progress[sid] || {};

      // build inner HTML w/ inputs
      sess.innerHTML = `
        <div class="meta" style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <strong>${s.day}</strong> — <span class="small">${fmtFull(sessionDate)}</span>
            <div class="small" style="margin-top:6px">${s.type} · ${s.dist || ''} · Pace: ${s.pace || ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <label style="display:flex;align-items:center;gap:6px;">
              <input type="checkbox" class="checkbox" ${p.done ? 'checked' : ''}>
              <span class="small">Done</span>
            </label>
            <div style="display:flex;gap:6px">
              <input class="input" placeholder="km" style="width:64px" value="${p.distance ? p.distance : ''}">
              <input class="input" placeholder="min/km" style="width:84px" value="${p.pace ? p.pace : ''}">
            </div>
          </div>
        </div>
      `;

      // attach listeners for this session
      const checkbox = sess.querySelector('.checkbox');
      const distInput = sess.querySelectorAll('.input')[0];
      const paceInput = sess.querySelectorAll('.input')[1];

      checkbox.addEventListener('change', () => {
        const prog = loadProgress();
        prog[sid] = prog[sid] || {};
        prog[sid].done = checkbox.checked;
        saveProgress(prog);
        updateStats(); // recalc totals
      });
      distInput.addEventListener('input', () => {
        const prog = loadProgress();
        prog[sid] = prog[sid] || {};
        prog[sid].distance = distInput.value;
        saveProgress(prog);
        updateStats();
      });
      paceInput.addEventListener('input', () => {
        const prog = loadProgress();
        prog[sid] = prog[sid] || {};
        prog[sid].pace = paceInput.value;
        saveProgress(prog);
      });

      // today marker: highlight if now falls in this week
      const now = new Date();
      if(now >= weekStart && now <= weekEnd) {
        sess.classList.add('today-marker');
      }

      card.appendChild(sess);
    });

    holder.appendChild(card);
  });

  updateStats();
}

// --- Stats (global across all months) ---
function updateStats(){
  const progress = loadProgress();
  const allKeys = Object.keys(progress);
  const completed = allKeys.filter(k => progress[k] && progress[k].done).length;

  // sum distances
  let sum = 0;
  allKeys.forEach(k => {
    const v = progress[k] && progress[k].distance;
    if(v !== undefined && v !== null && v !== '') {
      const n = parseFloat(String(v).replace(',','.'));
      if(!Number.isNaN(n)) sum += n;
    }
  });

  // total sessions: count from plan (safe)
  let total = 0;
  Object.values(monthGroups).forEach(arr => {
    arr.forEach(w => total += (w.sessions || []).length);
  });

  const completedEl = document.getElementById('completed-count');
  const totalEl = document.getElementById('total-sessions');
  const sumEl = document.getElementById('distance-sum');

  if(completedEl) completedEl.textContent = completed;
  if(totalEl) totalEl.textContent = total;
  if(sumEl) sumEl.textContent = sum ? (sum.toFixed(1) + ' km') : '—';
}

// --- Navigation setup (expects #prev-month, #next-month, #month-name in DOM) ---
function setupNavigation(){
  const prev = document.getElementById('prev-month');
  const next = document.getElementById('next-month');

  // If nav doesn't exist in the HTML, create it just above #plan-holder
  if(!prev || !next){
    const container = document.querySelector('main .container') || document.body;
    const nav = document.createElement('div');
    nav.id = 'month-nav';
    nav.style.display = 'flex';
    nav.style.justifyContent = 'center';
    nav.style.gap = '12px';
    nav.style.marginBottom = '12px';

    const pbtn = document.createElement('button'); pbtn.id = 'prev-month'; pbtn.textContent = '◀';
    const span = document.createElement('span'); span.id = 'month-name'; span.style.fontWeight = '600';
    const nbtn = document.createElement('button'); nbtn.id = 'next-month'; nbtn.textContent = '▶';

    nav.appendChild(pbtn); nav.appendChild(span); nav.appendChild(nbtn);
    const planHolder = document.getElementById('plan-holder');
    container.insertBefore(nav, planHolder);
  }

  // now attach listeners (elements should exist)
  const p = document.getElementById('prev-month');
  const nx = document.getElementById('next-month');

  p.addEventListener('click', () => {
    if(currentMonthIndex > 0){
      currentMonthIndex--;
      renderMonth(monthKeys[currentMonthIndex]);
    }
  });
  nx.addEventListener('click', () => {
    if(currentMonthIndex < monthKeys.length - 1){
      currentMonthIndex++;
      renderMonth(monthKeys[currentMonthIndex]);
    }
  });
}

// --- INIT ---
setupNavigation();
loadPlan().catch(err => {
  console.error('Failed to load plan.json', err);
  const holder = document.getElementById('plan-holder');
  if(holder) holder.innerHTML = '<div class="week-card"><p>Failed to load plan.json — make sure it is present.</p></div>';
});
