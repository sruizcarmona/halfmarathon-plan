// app.js — loads plan.json, renders scrollable cards grouped by month
// stores user progress in localStorage

const PLAN_URL = 'plan.json';
const STORAGE_KEY = 'hm_plan_progress_v1';

let planData;
let monthKeys = [];
let currentMonthIndex = 0;

async function loadPlan(){
  const res = await fetch(PLAN_URL);
  const plan = await res.json();
  planData = plan;
  monthKeys = groupWeeksByMonth(plan);
  renderMonth(monthKeys[currentMonthIndex]);
}

function formatDate(d){
  const dt = new Date(d);
  return dt.toLocaleDateString();
}

function loadProgress(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch(e){ return {}; }
}
function saveProgress(p){ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

function sessionId(weekIdx, sessIdx){ return `w${weekIdx}_s${sessIdx}` }

function groupWeeksByMonth(plan){
  const sd = new Date(plan.meta.start_date);
  const monthDict = {};
  plan.weeks.forEach((w, wi) => {
    const weekStart = new Date(sd.getTime() + (w.idx-1)*7*24*3600*1000);
    const monthName = weekStart.toLocaleString('default', { month:'short', year:'numeric'});
    if(!monthDict[monthName]) monthDict[monthName]=[];
    monthDict[monthName].push(w);
  });
  return Object.keys(monthDict);
}

function renderMonth(monthName){
  const holder = document.getElementById('plan-holder');
  holder.innerHTML = '';
  document.getElementById('month-name').textContent = monthName;
  
  const progress = loadProgress();
  let total = 0; let completed = 0;

  // get weeks for this month
  const sd = new Date(planData.meta.start_date);
  const weeksInMonth = planData.weeks.filter(w => {
    const weekStart = new Date(sd.getTime() + (w.idx-1)*7*24*3600*1000);
    const mName = weekStart.toLocaleString('default',{month:'short',year:'numeric'});
    return mName === monthName;
  });

  weeksInMonth.forEach((w, wi) =>{
    const card = document.createElement('div');
    card.className = 'week-card';
    const h = document.createElement('h3');
    h.textContent = `${w.title}`;
    card.appendChild(h);

    w.sessions.forEach((s, si) =>{
      total +=1;
      const sid = sessionId(w.idx, si);
      if(progress[sid] && progress[sid].done) completed += 1;

      const ses = document.createElement('div');
      ses.className='session';
      const today = markIfToday(planData.meta.start_date, w.idx);
      if(today) ses.classList.add('today-marker');

      const meta = document.createElement('div');
      meta.className='meta';
      meta.innerHTML = `<div><strong>${s.day} · ${s.type}</strong></div><div class='small'>${s.dist}</div>`;
      ses.appendChild(meta);

      const p = document.createElement('p');
      p.textContent = `Pace: ${s.pace}`;
      ses.appendChild(p);

      const controls = document.createElement('div');
      controls.className='controls';
      
      const cb = document.createElement('input');
      cb.type='checkbox'; cb.className='checkbox';
      cb.checked = !!(progress[sid] && progress[sid].done);
      cb.addEventListener('change',()=>{
        progress[sid] = progress[sid] || {};
        progress[sid].done = cb.checked;
        saveProgress(progress); updateStats(total, completedOffset(progress));
      });
      controls.appendChild(cb);

      const distanceInput = document.createElement('input');
      distanceInput.className='input'; distanceInput.placeholder='km';
      distanceInput.value = progress[sid] ? (progress[sid].distance || '') : '';
      distanceInput.style.width='70px';
      distanceInput.addEventListener('input',()=>{
        progress[sid] = progress[sid] || {};
        progress[sid].distance = distanceInput.value;
        saveProgress(progress); updateStats(total, completedOffset(progress));
      });

      const paceInput = document.createElement('input');
      paceInput.className='input'; paceInput.placeholder='min/km';
      paceInput.value = progress[sid] ? (progress[sid].pace || '') : '';
      paceInput.style.width='90px';
      paceInput.addEventListener('input',()=>{
        progress[sid] = progress[sid] || {};
        progress[sid].pace = paceInput.value;
        saveProgress(progress);
      });

      controls.appendChild(distanceInput);
      controls.appendChild(paceInput);

      ses.appendChild(controls);
      card.appendChild(ses);
    });

    holder.appendChild(card);
  });

  updateStats(total, completedOffset(progress));
}

function completedOffset(progress){
  return Object.values(progress).filter(p => p && p.done).length;
}
function updateStats(total, completed){
  document.getElementById('completed-count').textContent=completed;
  document.getElementById('total-sessions').textContent=total;
  const progress = loadProgress();
  let sum=0;
  Object.values(progress).forEach(p=>{
    if(p && p.distance){
      const v=parseFloat(String(p.distance).replace(',','.'));
      if(!isNaN(v)) sum+=v;
    }
  });
  document.getElementById('distance-sum').textContent = sum ? (sum.toFixed(1)+' km') : '—';
}

function markIfToday(start_date_iso, weekIdx){
  const sd = new Date(start_date_iso);
  const weekStart = new Date(sd.getTime() + (weekIdx-1)*7*24*3600*1000);
  const now = new Date();
  const weekEnd = new Date(weekStart.getTime() + 6*24*3600*1000);
  return now >= weekStart && now <= weekEnd;
}

function setupNavigation() {
    const prev = document.getElementById('prev-month');
    const next = document.getElementById('next-month');
    const monthLabel = document.getElementById('month-name');

    if (!prev || !next || !monthLabel) {
        console.error("Month navigation elements missing from HTML");
        return;
    }

    prev.addEventListener('click', () => {
        if (currentMonthIndex > 0) {
            currentMonthIndex--;
            renderMonth(monthKeys[currentMonthIndex]);
        }
    });

    next.addEventListener('click', () => {
        if (currentMonthIndex < monthKeys.length - 1) {
            currentMonthIndex++;
            renderMonth(monthKeys[currentMonthIndex]);
        }
    });
}

// main
setupNavigation();
loadPlan().catch(err=>{
  console.error('Failed to load plan.json', err);
  const holder = document.getElementById('plan-holder');
  holder.innerHTML='<div class="week-card"><p>Failed to load plan.json — make sure it is present.</p></div>';
});