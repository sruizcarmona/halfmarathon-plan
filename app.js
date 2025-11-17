// app.js — full clean updated version with vertical months, current week highlight, wider cards

// --- CONFIG ---
const RACE_DAY = new Date("2026-01-18");
const START_DAY = new Date("2025-11-17"); // Adjust if needed
const STORAGE_KEY = 'hm_plan_progress_v2';
const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

// --- UTILS ---
function formatDate(date) {
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch(e) { return {}; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
function sessionId(weekIdx, sessIdx) { return `w${weekIdx}_s${sessIdx}`; }

// --- MAIN ---
document.addEventListener("DOMContentLoaded", () => {
  loadPlan().catch(err => {
    console.error("Failed to load plan.json", err);
    const holder = document.getElementById("plan-holder");
    holder.innerHTML = '<div class="week-card"><p>Failed to load plan.json — make sure it is present.</p></div>';
  });
});

// --- LOAD PLAN ---
async function loadPlan() {
  const response = await fetch("plan.json");
  const plan = await response.json();
  renderWeeks(plan);
}

// --- RENDER WEEKS ---
function renderWeeks(plan) {
  const holder = document.getElementById("plan-holder");
  holder.innerHTML = '';

  // populate header date spans from constants (accept multiple id variants)
  const raceEl = document.getElementById('race-date');
  if (raceEl) raceEl.textContent = formatDate(RACE_DAY);
  const startEl = document.getElementById('start-date');
  if (startEl) startEl.textContent = formatDate(START_DAY);

  const totalWeeks = plan.weeks.length;
  const now = new Date();

  let currentMonth = '';
  const totalSessions = plan.weeks.reduce((sum, wk) => {
    if (Array.isArray(wk)) return sum + wk.length;
    if (wk && Array.isArray(wk.sessions)) return sum + wk.sessions.length;
    return sum;
  }, 0);
  
  for (let i = 0; i < totalWeeks; i++) {
    const weekNumber = i + 1;
    const weekStartDate = new Date(START_DAY.getTime() + i * MS_WEEK);
    const weekEndDate = new Date(weekStartDate.getTime() + 6 * MS_DAY);

    // Month header
    const monthName = weekStartDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (monthName !== currentMonth) {
        // create month wrapper
        const monthWrapper = document.createElement('div');
        monthWrapper.className = 'month-wrapper';
        
        const monthHeader = document.createElement('h2');
        monthHeader.textContent = monthName;
        monthWrapper.appendChild(monthHeader);

        const weekContainer = document.createElement('div');
        weekContainer.className = 'week-container';
        monthWrapper.appendChild(weekContainer);

        holder.appendChild(monthWrapper);
        currentMonth = monthName;
    }

    const monthWrapper = holder.querySelector('.month-wrapper:last-child');
    const weekContainer = monthWrapper.querySelector('.week-container');

    const weeksToGo = Math.max(0, Math.ceil((RACE_DAY - weekStartDate)/MS_WEEK));

    const card = document.createElement('div');
    card.className = 'week-card';
    card.style.padding = '16px';
    card.style.marginBottom = '16px';
    card.style.borderRadius = '8px';
    card.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
    card.style.background = (now >= weekStartDate && now <= weekEndDate) ? 'rgba(0,200,0,0.12)' : 'white';

    const title = `<h3 style="margin:0;">${weeksToGo} ${weeksToGo === 1 ? 'week' : 'weeks'} to go</h3>`;
    const subtitle = `<div style="font-size:14px;color:#555;">Week ${weekNumber} · ${formatDate(weekStartDate)} – ${formatDate(weekEndDate)}</div>`;

    let daysHtml = '';
    (plan.weeks[i].sessions || []).forEach((s, si) => {
      const sid = sessionId(weekNumber, si);
      const sessProg = loadProgress()[sid] || {};
      
      const dayIndex = {"mon":0,"tue":1,"wed":2,"thu":3,"fri":4,"sat":5,"sun":6}[s.day.toLowerCase().slice(0,3)] ?? 1;
      const sessionDate = new Date(weekStartDate.getTime() + dayIndex*MS_DAY);

      daysHtml += `<div class="day-item" style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;">
        <div class="day-info">
          <strong>${s.day}</strong> — ${formatDate(sessionDate)}<br>
          <span style="font-size:13px;color:#555;">${s.type}: ${s.dist || ''} <br> Pace: ${s.pace || ''}</span>
        </div>
        <div class="day-progress" style="display:flex;align-items:center;gap:4px;">
            <input type="checkbox" class="checkbox" ${sessProg.done ? 'checked' : ''}>
            <input class='input' placeholder='km' style='width:50px;' value='${sessProg.distance||''}'>
            <input class='input' placeholder='min/km' style='width:70px;' value='${sessProg.pace||''}'>
        </div>
      </div>`;
    });
        
    card.innerHTML = title + subtitle + `<div class='day-list'>${daysHtml}</div>`;
    weekContainer.appendChild(card);

    // Add listeners for checkboxes and inputs
    const dayItems = card.querySelectorAll('.day-item');
    dayItems.forEach((elem, si) => {
        const checkbox = elem.querySelector('.checkbox');
        const inputs = elem.querySelectorAll('.input');
        const sid = sessionId(weekNumber, si);
        const prog = loadProgress()[sid] || {};

        // set initial values from localStorage
        checkbox.checked = prog.done || false;
        inputs[0].value = prog.distance || '';
        inputs[1].value = prog.pace || '';

        // Checkbox listener
        checkbox.addEventListener('change', () => {
            const p = loadProgress();
            p[sid] = p[sid] || {};
            p[sid].done = checkbox.checked;
            saveProgress(p);
            updateStats();
        });

        // Distance input listener
        inputs[0].addEventListener('input', () => {
            const p = loadProgress();
            p[sid] = p[sid] || {};
            p[sid].distance = inputs[0].value;
            saveProgress(p);
            updateStats();
        });

        // Pace input listener
        inputs[1].addEventListener('input', () => {
            const p = loadProgress();
            p[sid] = p[sid] || {};
            p[sid].pace = inputs[1].value;
            saveProgress(p);
            updateStats();
        });
    });

    // per-week work done above
  }

  // helpers moved out of the per-week loop: compute completed count
  function completedOffset(progressObj){
    if(!progressObj || typeof progressObj !== 'object') return 0;
    return Object.values(progressObj).filter(p => p && p.done).length;
  }

  // recompute and render global stats for the whole plan
  function updateStats(){
    const progress = loadProgress();

    // 1) total sessions: use the precomputed `totalSessions` for the plan
    const total = totalSessions;

    // 2) completed sessions: count keys in progress where done===true
    const completed = completedOffset(progress);

    // 3) distance sum
    let sum = 0;
    Object.values(progress).forEach(p => {
      if(p && p.distance != null && p.distance !== '') {
        const n = parseFloat(String(p.distance).replace(',', '.'));
        if(!Number.isNaN(n)) sum += n;
      }
    });

    // 4) write to DOM safely (check elements exist)
    const completedEl = document.getElementById('completed-count');
    const totalEl     = document.getElementById('total-sessions');
    const sumEl       = document.getElementById('distance-sum');

    if(completedEl) completedEl.textContent = String(completed);
    if(totalEl)     totalEl.textContent = String(total);
    if(sumEl)       sumEl.textContent = sum ? (sum.toFixed(1) + ' km') : '—';
  }

  // initial render of stats
  updateStats();
}
