// app.js — loads plan.json, renders scrollable cards, stores user progress in localStorage

const PLAN_URL = 'plan.json';
const STORAGE_KEY = 'hm_plan_progress_v1';

async function loadPlan(){
  const res = await fetch(PLAN_URL);
  const plan = await res.json();
  return plan;
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

function render(plan){
  document.getElementById('race-date').textContent = formatDate(plan.meta.race_date);
  document.getElementById('start-date').textContent = formatDate(plan.meta.start_date);

  const holder = document.getElementById('plan-holder');
  holder.innerHTML = '';

  const progress = loadProgress();
  let total = 0; let completed = 0;

  plan.weeks.forEach((w, wi) =>{
    const card = document.createElement('div');
    card.className = 'week-card';
    const h = document.createElement('h3');
    h.textContent = `${w.title}`;
    card.appendChild(h);

    w.sessions.forEach((s, si) =>{
      total += 1;
      const sid = sessionId(w.idx, si);
      if(progress[sid] && progress[sid].done) completed += 1;

      const ses = document.createElement('div');
      ses.className = 'session';
      // today marker
      const today = markIfToday(plan.meta.start_date, w.idx);
      if(today){ ses.classList.add('today-marker'); }

      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<div><strong>${s.day} · ${s.type}</strong></div><div class="small">${s.dist}</div>`;
      ses.appendChild(meta);

      const p = document.createElement('p');
      p.textContent = `Pace: ${s.pace}`;
      ses.appendChild(p);

      const controls = document.createElement('div');
      controls.className = 'controls';

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className='checkbox';
      cb.checked = !!(progress[sid] && progress[sid].done);
      cb.addEventListener('change', ()=>{
        progress[sid] = progress[sid] || {};
        progress[sid].done = cb.checked;
        saveProgress(progress); updateStats(total, completedOffset(progress));
      });
      controls.appendChild(cb);

      const distanceInput = document.createElement('input');
      distanceInput.className = 'input'; distanceInput.placeholder = 'km';
      distanceInput.value = progress[sid] ? (progress[sid].distance || '') : '';
      distanceInput.style.width = '70px';
      distanceInput.addEventListener('input', ()=>{
        progress[sid] = progress[sid] || {};
        progress[sid].distance = distanceInput.value;
        saveProgress(progress); updateStats(total, completedOffset(progress));
      });
      const paceInput = document.createElement('input');
      paceInput.className='input'; paceInput.placeholder='min/km'; paceInput.value = progress[sid] ? (progress[sid].pace || '') : '';
      paceInput.style.width='90px';
      paceInput.addEventListener('input', ()=>{
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

  // initial stats
  updateStats(total, completedOffset(progress));
}

function completedOffset(progress){
  return Object.values(progress).filter(p => p && p.done).length;
}
function updateStats(total, completed){
  document.getElementById('completed-count').textContent = completed;
  document.getElementById('total-sessions').textContent = total;
  // distance sum (basic)
  const progress = loadProgress();
  let sum = 0;
  Object.values(progress).forEach(p=>{
    if(p && p.distance){
      const v = parseFloat(String(p.distance).replace(',','.'));
      if(!isNaN(v)) sum += v;
    }
  });
  document.getElementById('distance-sum').textContent = sum ? (sum.toFixed(1) + ' km') : '—';
}

function markIfToday(start_date_iso, weekIdx){
  // compute week index: start_date + (weekIdx-1) weeks
  const sd = new Date(start_date_iso);
  const weekStart = new Date(sd.getTime() + (weekIdx-1)*7*24*3600*1000);
  const now = new Date();
  // if today's date between weekStart and weekStart+6 days
  const weekEnd = new Date(weekStart.getTime() + 6*24*3600*1000);
  return now >= weekStart && now <= weekEnd;
}

// main
loadPlan().then(plan=> render(plan)).catch(err=>{
  console.error('Failed to load plan.json', err);
  const holder = document.getElementById('plan-holder');
  holder.innerHTML = '<div class="week-card"><p>Failed to load plan.json — make sure it is present.</p></div>';
});