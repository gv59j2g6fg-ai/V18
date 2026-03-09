const STORE_KEY='gym_v18_final_clean_state';
const STORE_KEY_TEMP='gym_v18_final_clean_state_temp';
const INC_KG=2.5;
const PIN_INC=1;
const MAIN_DAY_ORDER=['strength','fatloss','volume'];

const EXERCISE_DEFS=[
  {name:'4-Way Shoulder', type:'reps'},
  {name:'Arnold Press', type:'reps'},
  {name:'Bench Press', type:'reps'},
  {name:'Bent Over Row', type:'reps'},
  {name:'Cable Triceps Pushdown', type:'reps'},
  {name:'Close-Grip Dumbbell Press', type:'reps'},
  {name:'Deadlift', type:'reps'},
  {name:'Dumbbell Fly', type:'reps'},
  {name:'Dumbbell Press', type:'reps'},
  {name:"Farmer's Walk", type:'time'},
  {name:'Face Pull', type:'reps'},
  {name:'Hammer Curl', type:'reps'},
  {name:'Incline Bench Press', type:'reps'},
  {name:'Lat Pulldown', type:'reps'},
  {name:'Lateral Raise', type:'reps'},
  {name:'Palm Curl', type:'reps'},
  {name:'Rear Delt Raise', type:'reps'},
  {name:'Romanian Deadlift', type:'reps'},
  {name:'Seated Cable Row', type:'reps'},
  {name:'Shoulder Press', type:'reps'},
  {name:'Skull Crusher', type:'reps'},
  {name:'Squat', type:'reps'},
  {name:'Sumo Squat', type:'reps'},
];

const DEFAULT_DAY_SPECS={
  strength:[
    ['Deadlift',3,'5'],
    ['Bench Press',3,'5'],
    ['Bent Over Row',3,'5'],
    ['Shoulder Press',3,'5'],
    ["Farmer's Walk",2,'40'],
  ],
  fatloss:[
    ['Lat Pulldown',2,'12-15'],
    ['Arnold Press',2,'12-15'],
    ['Lateral Raise',2,'12-15'],
    ['Hammer Curl',2,'12-15'],
    ['Palm Curl',2,'12-15'],
    ["Farmer's Walk",2,'40'],
  ],
  volume:[
    ['Squat',3,'8-12'],
    ['Sumo Squat',3,'8-12'],
    ['Romanian Deadlift',3,'8-12'],
    ['Incline Bench Press',3,'8-12'],
    ['Lat Pulldown',3,'8-12'],
    ['Seated Cable Row',3,'8-12'],
    ['Close-Grip Dumbbell Press',3,'8-12'],
  ],
  recovery:[
    ['Bench Press',3,'60 total'],
    ['Lat Pulldown',3,'60 total'],
    ['Hammer Curl',3,'60 total'],
    ['Cable Triceps Pushdown',3,'60 total'],
  ],
};

const DAY_ORDER_HINTS={
  strength:['Deadlift','Bench Press','Bent Over Row','Shoulder Press',"Farmer's Walk"],
  fatloss:['Lat Pulldown','Arnold Press','Lateral Raise','Hammer Curl','Palm Curl',"Farmer's Walk"],
  volume:['Squat','Sumo Squat','Romanian Deadlift','Incline Bench Press','Lat Pulldown','Seated Cable Row','Close-Grip Dumbbell Press'],
  recovery:['Bench Press','Lat Pulldown','Hammer Curl','Cable Triceps Pushdown'],
};

const EXERCISE_CLASS={
  'Deadlift':'primary',
  'Squat':'primary',
  'Bench Press':'primary',
  'Sumo Squat':'primary',
  'Romanian Deadlift':'secondary',
  'Bent Over Row':'secondary',
  'Shoulder Press':'secondary',
  'Incline Bench Press':'secondary',
  'Lat Pulldown':'secondary',
  'Seated Cable Row':'secondary',
  'Dumbbell Press':'secondary',
  'Close-Grip Dumbbell Press':'isolation',
  'Arnold Press':'isolation',
  'Lateral Raise':'isolation',
  'Rear Delt Raise':'isolation',
  'Face Pull':'isolation',
  'Hammer Curl':'isolation',
  'Palm Curl':'isolation',
  'Cable Triceps Pushdown':'isolation',
  'Skull Crusher':'isolation',
  'Dumbbell Fly':'isolation',
  '4-Way Shoulder':'isolation',
  "Farmer's Walk":'finisher',
};

const CLASS_SCORE={primary:10, secondary:20, isolation:30, finisher:40};

function uid(p='id'){ return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`; }
function localISO(d=new Date()){ const off=d.getTimezoneOffset(); return new Date(d.getTime()-off*60000).toISOString().slice(0,10); }
function addDays(iso,n){ const d=new Date(`${iso}T00:00:00`); d.setDate(d.getDate()+n); return localISO(d); }
function normalizeName(name){ return (name||'').toString().trim().replace(/\s+/g,' '); }

function saveState(s){
  const json=JSON.stringify(s);
  localStorage.setItem(STORE_KEY_TEMP, json);
  localStorage.setItem(STORE_KEY, json);
  localStorage.removeItem(STORE_KEY_TEMP);
}
function loadState(){
  try{
    const src=localStorage.getItem(STORE_KEY_TEMP) || localStorage.getItem(STORE_KEY);
    return src ? JSON.parse(src) : null;
  }catch(e){
    return null;
  }
}

function sortExercisesInPlace(list){
  list.sort((a,b)=>{
    if(!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
    return normalizeName(a.name).localeCompare(normalizeName(b.name), undefined, {numeric:true, sensitivity:'base'});
  });
  return list;
}
function ensureDefaultExercises(exercises){
  const byName=new Map(exercises.map(ex=>[normalizeName(ex.name).toLowerCase(), ex]));
  EXERCISE_DEFS.forEach(def=>{
    const key=normalizeName(def.name).toLowerCase();
    if(!byName.has(key)){
      const ex={id:uid('ex'), name:def.name, type:def.type, archived:false};
      exercises.push(ex);
      byName.set(key, ex);
    }
  });
  return sortExercisesInPlace(exercises);
}
function makeDefaultTemplates(exercises){
  const getId=(name)=> exercises.find(e=>normalizeName(e.name).toLowerCase()===normalizeName(name).toLowerCase())?.id || '';
  const mk=(name, sets, target)=>({id:uid('row'), exId:getId(name), sets:String(sets), target:String(target), weight:'', pin:'', rir:'', keep:true, rest:'60'});
  return Object.fromEntries(Object.entries(DEFAULT_DAY_SPECS).map(([day, rows])=>[day, rows.map(([name,sets,target])=>mk(name,sets,target))]));
}
function defaultState(){
  const exercises=ensureDefaultExercises([]);
  return {
    exercises,
    templates: makeDefaultTemplates(exercises),
    sessions:{},
    templateLive:{strength:[], fatloss:[], volume:[], recovery:[]},
    lastCompleted:null,
    lastMainCompleted:null,
  };
}
function migrateState(s){
  if(!s || typeof s!=='object') return defaultState();
  s.exercises=Array.isArray(s.exercises)?s.exercises:[];
  ensureDefaultExercises(s.exercises);
  s.templates=makeDefaultTemplates(s.exercises);
  s.templateLive=(s.templateLive && typeof s.templateLive==='object') ? s.templateLive : {strength:[], fatloss:[], volume:[], recovery:[]};
  ['strength','fatloss','volume','recovery'].forEach(day=>{ if(!Array.isArray(s.templateLive[day])) s.templateLive[day]=[]; });
  s.sessions=(s.sessions && typeof s.sessions==='object') ? s.sessions : {};
  s.lastCompleted=s.lastCompleted && typeof s.lastCompleted==='object' ? s.lastCompleted : null;
  s.lastMainCompleted=s.lastMainCompleted && typeof s.lastMainCompleted==='object' ? s.lastMainCompleted : null;
  return s;
}

let state=migrateState(loadState() || defaultState());
saveState(state);

const dateInput=document.getElementById('dateInput');
const prevDay=document.getElementById('prevDay');
const nextDay=document.getElementById('nextDay');
const todayBtn=document.getElementById('todayBtn');
const tabs=[...document.querySelectorAll('.tab')];
const workoutCard=document.getElementById('workoutCard');
const manageCard=document.getElementById('manageCard');
const historyCard=document.getElementById('historyCard');
const dayTitle=document.getElementById('dayTitle');
const dayPill=document.getElementById('dayPill');
const dayHint=document.getElementById('dayHint');
const daySelect=document.getElementById('daySelect');
const tbody=document.getElementById('tbody');
const saveBtn=document.getElementById('saveBtn');
const repeatLastBtn=document.getElementById('repeatLastBtn');
const resetDraftBtn=document.getElementById('resetDraftBtn');
const resetDayBtn=document.getElementById('resetDayBtn');
const addRowBtn=document.getElementById('addRowBtn');
const draftStatus=document.getElementById('draftStatus');
const note=document.getElementById('note');
const newName=document.getElementById('newName');
const newType=document.getElementById('newType');
const addExBtn=document.getElementById('addExBtn');
const exList=document.getElementById('exList');
const rangeSel=document.getElementById('rangeSel');
const search=document.getElementById('search');
const histList=document.getElementById('histList');
const exportBtn=document.getElementById('exportBtn');
const importFile=document.getElementById('importFile');

let currentDate=localISO();
let currentView='workout';
let currentDayType='strength';
let draft=null;
let dirty=false;
let activeTimer=null;

dateInput.value=currentDate;

function exById(id){ return state.exercises.find(e=>e.id===id) || null; }
function exNameById(id){ return normalizeName(exById(id)?.name || ''); }
function activeExercises(){ return state.exercises.filter(e=>!e.archived).slice().sort((a,b)=>normalizeName(a.name).localeCompare(normalizeName(b.name), undefined, {numeric:true, sensitivity:'base'})); }
function dayHintIndex(day, name){ const arr=DAY_ORDER_HINTS[day] || []; const idx=arr.findIndex(x=>normalizeName(x).toLowerCase()===normalizeName(name).toLowerCase()); return idx>=0 ? idx : 999; }
function classScoreForName(name){ return CLASS_SCORE[EXERCISE_CLASS[normalizeName(name)] || 'isolation'] || 30; }
function sortRowsForDay(dayType, rows){
  return (rows||[]).sort((a,b)=>{
    const an=exNameById(a.exId);
    const bn=exNameById(b.exId);
    const ah=dayHintIndex(dayType, an), bh=dayHintIndex(dayType, bn);
    if(ah!==bh) return ah-bh;
    const ac=classScoreForName(an), bc=classScoreForName(bn);
    if(ac!==bc) return ac-bc;
    return an.localeCompare(bn, undefined, {numeric:true, sensitivity:'base'});
  });
}
function fmtDay(t){ return t==='strength'?'Strength Day':t==='fatloss'?'Fat Loss Day':t==='volume'?'Volume Day':t==='recovery'?'Recovery Day':'Workout'; }
function nextDayType(afterType){ const idx=MAIN_DAY_ORDER.indexOf(afterType || 'strength'); return idx>=0 ? MAIN_DAY_ORDER[(idx+1)%MAIN_DAY_ORDER.length] : 'strength'; }
function lastMainCompleted(){ return state.lastMainCompleted || (state.lastCompleted?.dayType!=='recovery' ? state.lastCompleted : null); }
function getPlannedTemplate(dayType){
  const live=state.templateLive?.[dayType];
  if(Array.isArray(live) && live.length) return live.map(r=>({...r}));
  return (state.templates?.[dayType]||[]).map(r=>({...r}));
}
function resetPlannedDayTemplate(dayType){ state.templateLive[dayType]=[]; saveState(state); }
function rebuildDraftFromDay(dayType){
  const tpl=getPlannedTemplate(dayType).map(r=>({...r, id:uid('row'), rir:'', tempSkip:false, keep:(r.keep!==false), rest:(r.rest||'60')}));
  currentDayType=dayType;
  draft={dayType, rows:sortRowsForDay(dayType, tpl)};
  dirty=false;
}
function ensureDraftFor(dateISO){
  const saved=state.sessions?.[dateISO];
  if(saved && saved.rows && saved.rows.length){
    currentDayType=saved.dayType || 'strength';
    draft=JSON.parse(JSON.stringify(saved));
    draft.rows=(draft.rows||[]).map(r=>({...r, tempSkip:false, keep:(r.keep!==false)}));
    dirty=false;
    return;
  }
  const last=lastMainCompleted();
  rebuildDraftFromDay(last ? nextDayType(last.dayType) : 'strength');
}
function markDirty(){ dirty=true; draftStatus.textContent='Draft (unsaved changes)'; }

function setTopUI(){
  dayTitle.textContent=fmtDay(currentDayType);
  dayPill.textContent=currentDayType==='strength'?'Strength':currentDayType==='fatloss'?'Fat Loss':currentDayType==='volume'?'Volume':'Recovery';
  dayHint.textContent='Auto-rotates Strength → Fat Loss → Volume. Recovery is manual and does not change the next main day.';
  daySelect.value=currentDayType || 'strength';
  const saved=state.sessions?.[currentDate];
  daySelect.disabled=!!(saved && saved.rows && saved.rows.length);
  draftStatus.textContent=dirty ? 'Draft (unsaved changes)' : 'Draft (not saved)';
  note.textContent=currentDayType==='recovery'
    ? 'Recovery stays manual. Weight and pin carry forward exactly as last time. RIR 0/1/2 all hold on Recovery. ADD checked keeps a new exercise for this day next time. ✕ skips for today only.'
    : 'Weight and pin always prefill next time. RIR 2 progresses. RIR 0 or 1 holds. ADD checked keeps a new exercise for this day next time. ✕ skips for today only.';
}
function render(){
  tabs.forEach(b=>b.classList.toggle('active', b.dataset.tab===currentView));
  workoutCard.classList.toggle('hidden', currentView!=='workout');
  manageCard.classList.toggle('hidden', currentView!=='manage');
  historyCard.classList.toggle('hidden', currentView!=='history');
  if(currentView==='workout') renderWorkout();
  if(currentView==='manage') renderManage();
  if(currentView==='history') renderHistory();
}
function renderWorkout(){
  setTopUI();
  tbody.innerHTML='';
  sortRowsForDay(draft?.dayType || currentDayType, draft?.rows || []);
  (draft?.rows || []).filter(r=>!r.tempSkip).forEach(r=>tbody.appendChild(renderRow(r)));
}
function renderRow(r){
  const tr=document.createElement('tr');
  const td1=document.createElement('td');
  const sel=document.createElement('select'); sel.className='input';
  const o0=document.createElement('option'); o0.value=''; o0.textContent='Select…'; sel.appendChild(o0);
  const opts=[...activeExercises()];
  const rowEx=exById(r.exId);
  if(rowEx && rowEx.archived && !opts.find(x=>x.id===rowEx.id)) opts.unshift(rowEx);
  opts.forEach(ex=>{ const o=document.createElement('option'); o.value=ex.id; o.textContent=ex.archived ? `${ex.name} (archived)` : ex.name; sel.appendChild(o); });
  sel.value=r.exId || '';
  sel.onchange=()=>{ r.exId=sel.value; sortRowsForDay(draft.dayType, draft.rows); markDirty(); renderWorkout(); };
  td1.appendChild(sel);

  const td2=document.createElement('td');
  const sets=document.createElement('input'); sets.className='input'; sets.inputMode='numeric'; sets.value=r.sets ?? '';
  sets.oninput=()=>{ r.sets=sets.value; markDirty(); };
  td2.appendChild(sets);

  const td3=document.createElement('td');
  const reps=document.createElement('input'); reps.className='input'; reps.value=r.target ?? '';
  reps.oninput=()=>{ r.target=reps.value; markDirty(); };
  td3.appendChild(reps);

  const td4=document.createElement('td');
  const w=document.createElement('input'); w.className='input'; w.inputMode='decimal'; w.placeholder='kg'; w.value=r.weight ?? '';
  w.oninput=()=>{ r.weight=w.value; markDirty(); };
  td4.appendChild(w);

  const td5=document.createElement('td');
  const pin=document.createElement('input'); pin.className='input'; pin.inputMode='numeric'; pin.placeholder='Pin'; pin.value=r.pin ?? '';
  pin.oninput=()=>{ r.pin=pin.value; markDirty(); };
  td5.appendChild(pin);

  const td6=document.createElement('td');
  const rir=document.createElement('select'); rir.className='rirSelect';
  rir.innerHTML=`<option value="">RIR</option><option value="2">2</option><option value="1">1</option><option value="0">0</option>`;
  rir.value=(r.rir ?? '').toString();
  rir.onchange=()=>{ r.rir=rir.value; markDirty(); };
  td6.appendChild(rir);

  const td7=document.createElement('td'); td7.className='center';
  const keep=document.createElement('input'); keep.type='checkbox'; keep.className='keepChk'; keep.checked=(r.keep!==false);
  keep.onchange=()=>{ r.keep=keep.checked; markDirty(); };
  td7.appendChild(keep);

  const td8=document.createElement('td'); td8.className='center';
  const xb=document.createElement('button'); xb.className='xmini'; xb.type='button'; xb.textContent='✕'; xb.title='Skip this exercise today only';
  xb.onclick=()=>{ r.tempSkip=true; markDirty(); note.textContent='Skipped for this session only. It will come back next time this day loads.'; renderWorkout(); };
  td8.appendChild(xb);

  tr.append(td1,td2,td3,td4,td5,td6,td7,td8);
  return tr;
}
function addRow(){
  draft.rows.push({id:uid('row'), exId:'', sets:'2', target:'', weight:'', pin:'', rir:'', keep:false, rest:'60', tempSkip:false});
  sortRowsForDay(draft.dayType, draft.rows);
  markDirty(); renderWorkout();
}
function bumpKgStr(w, dir){ const x=parseFloat((w||'').toString().replace(',','.')); if(!isFinite(x)) return w; return String(Math.round((x + dir*INC_KG)*10)/10); }
function bumpPinStr(p, dir){ const x=parseInt((p||'').toString(),10); if(!isFinite(x)) return p; return String(x + dir*PIN_INC); }
function computeNextFromRow(dayType, row){
  const out={...row};
  const rir=parseInt((row.rir || '').toString(),10);
  const hasRir=(rir===0||rir===1||rir===2);
  if(dayType==='recovery' || !hasRir){ out.rir=''; return out; }
  const ex=exById(row.exId);
  if(ex?.type==='time'){
    if(rir===2){
      const t=parseInt((row.target||'').toString(),10);
      if(isFinite(t)) out.target=String(t+5);
      if((row.weight||'').toString().trim()!=='') out.weight=bumpKgStr(row.weight, +1);
    }
    out.rir='';
    return out;
  }
  const hasWeight=(row.weight||'').toString().trim()!=='';
  const hasPin=(row.pin||'').toString().trim()!=='';
  if(rir===2){
    if(hasWeight) out.weight=bumpKgStr(row.weight, +1);
    if(hasPin) out.pin=bumpPinStr(row.pin, +1);
  }
  out.rir='';
  return out;
}
function saveWorkout(){
  const cleaned=(draft.rows||[]).filter(r=>(r.exId||'').toString().trim()!=='' && !r.tempSkip);
  const savedRows=sortRowsForDay(draft.dayType, cleaned.map(r=>({...r, tempSkip:false})));
  state.sessions[currentDate]={dayType:draft.dayType, rows:savedRows};
  state.lastCompleted={date:currentDate, dayType:draft.dayType};
  if(draft.dayType!=='recovery') state.lastMainCompleted={date:currentDate, dayType:draft.dayType};

  const nextTemplateRows=(draft.rows||[])
    .filter(r=>(r.exId||'').toString().trim()!=='' && r.keep===true)
    .map(r=>{
      const next=r.tempSkip ? {...r} : computeNextFromRow(draft.dayType, r);
      delete next.tempSkip;
      return {...next, id:uid('row'), keep:true};
    });
  state.templateLive[draft.dayType]=sortRowsForDay(draft.dayType, nextTemplateRows.map(r=>({...r})));
  saveState(state);

  currentDate=addDays(currentDate, 1);
  dateInput.value=currentDate;
  ensureDraftFor(currentDate);
  dirty=false;
  stopTimer();
  render();
  note.textContent=draft.dayType==='recovery' ? 'Saved. Recovery did not change the next main day.' : 'Saved. Rotated to next main day.';
}
function repeatLastWorkout(){
  const entries=Object.entries(state.sessions||{}).filter(([iso,s])=>iso!==currentDate && s?.rows?.length).sort((a,b)=>a[0]<b[0]?1:-1);
  if(!entries.length){ alert('No previous saved workout found.'); return; }
  const [, lastSess]=entries[0];
  stopTimer();
  currentDayType=lastSess.dayType || 'strength';
  draft={ dayType:currentDayType, rows:sortRowsForDay(currentDayType, (lastSess.rows||[]).map(r=>({...r, id:uid('row'), rir:'', tempSkip:false}))) };
  dirty=true;
  render();
  note.textContent='Loaded last saved workout into today\'s draft.';
}
function resetDraft(){
  if(!confirm('Reset draft for this date? (Does not delete saved history)')) return;
  stopTimer();
  ensureDraftFor(currentDate);
  dirty=false;
  render();
}
function resetDayTemplate(){
  const saved=state.sessions?.[currentDate];
  if(saved && saved.rows && saved.rows.length){ alert('This date is already saved. Open a new date for that day, then reset the day template there.'); return; }
  const label=fmtDay(currentDayType);
  if(!confirm(`Reset ${label} to its default exercises?`)) return;
  stopTimer();
  resetPlannedDayTemplate(currentDayType);
  rebuildDraftFromDay(currentDayType);
  dirty=false;
  note.textContent=`${label} reset to default exercises.`;
  render();
}
function openDate(iso){ stopTimer(); currentDate=iso; dateInput.value=currentDate; ensureDraftFor(currentDate); dirty=false; render(); }

function stopTimer(){ if(!activeTimer) return; clearInterval(activeTimer.intervalId); activeTimer=null; }

// Tabs
for(const b of tabs){ b.onclick=()=>{ currentView=b.dataset.tab; render(); }; }
prevDay.onclick=()=>openDate(addDays(currentDate,-1));
nextDay.onclick=()=>openDate(addDays(currentDate,1));
todayBtn.onclick=()=>openDate(localISO());
dateInput.onchange=()=>openDate(dateInput.value || localISO());
if(daySelect){
  daySelect.onchange=()=>{
    const saved=state.sessions?.[currentDate];
    if(saved && saved.rows && saved.rows.length){ daySelect.value=saved.dayType || currentDayType || 'strength'; return; }
    stopTimer();
    rebuildDraftFromDay(daySelect.value);
    render();
  };
}
addRowBtn.onclick=addRow;
saveBtn.onclick=saveWorkout;
resetDraftBtn.onclick=resetDraft;
if(resetDayBtn) resetDayBtn.onclick=resetDayTemplate;
if(repeatLastBtn) repeatLastBtn.onclick=repeatLastWorkout;

function renderManage(){
  exList.innerHTML='';
  sortExercisesInPlace(state.exercises);
  for(const ex of state.exercises.slice()){
    const div=document.createElement('div'); div.className='item';
    const name=document.createElement('div'); name.style.fontWeight='800'; name.textContent=ex.name;
    const t=document.createElement('div'); t.className='pill'; t.textContent=ex.type==='time' ? 'Time (sec)' : 'Reps + Weight';
    const st=document.createElement('div'); st.className='pill'; st.textContent=ex.archived ? 'Archived' : 'Active';
    const rename=document.createElement('button'); rename.className='btn'; rename.textContent='Rename';
    rename.onclick=()=>{ const n=prompt('Rename exercise', ex.name); if(!n) return; ex.name=normalizeName(n); sortExercisesInPlace(state.exercises); saveState(state); renderManage(); };
    const toggle=document.createElement('button'); toggle.className='btn'; toggle.textContent=ex.type==='time' ? 'Set to Reps' : 'Set to Time';
    toggle.onclick=()=>{ ex.type=ex.type==='time' ? 'reps' : 'time'; saveState(state); renderManage(); };
    const arch=document.createElement('button'); arch.className='btn danger'; arch.textContent=ex.archived ? 'Restore' : 'Archive';
    arch.onclick=()=>{ ex.archived=!ex.archived; sortExercisesInPlace(state.exercises); saveState(state); renderManage(); };
    div.append(name,t,st,rename,toggle,arch);
    exList.appendChild(div);
  }
}
addExBtn.onclick=()=>{
  const n=normalizeName(newName.value||'');
  if(!n) return;
  if(state.exercises.some(ex=>normalizeName(ex.name).toLowerCase()===n.toLowerCase())){ alert('That exercise already exists.'); return; }
  state.exercises.push({id:uid('ex'), name:n, type:newType.value, archived:false});
  sortExercisesInPlace(state.exercises);
  newName.value='';
  saveState(state);
  renderManage();
};

function renderHistory(){
  const days=parseInt(rangeSel.value,10);
  const cutoff=addDays(localISO(), -days);
  const q=(search.value||'').trim().toLowerCase();
  const entries=Object.entries(state.sessions||{}).filter(([iso,s])=>iso>=cutoff && s?.rows?.length).sort((a,b)=>a[0]<b[0]?1:-1);
  histList.innerHTML='';
  for(const [iso, sess] of entries){
    const rows=sess.rows.filter(r=>{ const ex=exById(r.exId); if(!ex) return false; return !q || ex.name.toLowerCase().includes(q); });
    if(!rows.length) continue;
    const card=document.createElement('div'); card.className='hcard';
    card.innerHTML=`<div class="hhead" style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><strong>${iso}</strong> <span class="pill">${sess.dayType||'day'}</span></div><button class="xbtn" title="Delete this day" aria-label="Delete">✕</button></div>`;
    const delBtn=card.querySelector('.xbtn');
    delBtn.onclick=(ev)=>{ ev.stopPropagation(); if(!confirm(`Delete ${iso}?`)) return; delete state.sessions[iso]; saveState(state); renderHistory(); };
    card.onclick=()=>{ currentView='workout'; openDate(iso); };
    const list=document.createElement('div'); list.style.marginTop='8px'; list.style.display='grid'; list.style.gap='6px';
    for(const r of rows){
      const ex=exById(r.exId); const line=document.createElement('div'); line.className='muted small';
      if(ex?.type==='time') line.textContent=`${ex.name}: ${r.sets} sets • ${r.target||''} sec • ${r.weight||''} kg • pin ${r.pin||''} • RIR ${r.rir||''}`;
      else line.textContent=`${ex.name}: ${r.sets}×${r.target||''} @ ${r.weight||''} kg • pin ${r.pin||''} • RIR ${r.rir||''}`;
      list.appendChild(line);
    }
    card.appendChild(list);
    histList.appendChild(card);
  }
}
rangeSel.onchange=renderHistory;
search.oninput=renderHistory;

exportBtn.onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`workout_backup_${localISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
importFile.onchange=async()=>{
  const f=importFile.files?.[0];
  if(!f) return;
  try{
    const incoming=JSON.parse(await f.text());
    if(!incoming?.exercises || !incoming?.sessions){ alert('Backup not recognized.'); return; }
    if(!confirm('Import backup? This replaces your data on this device.')) return;
    state=migrateState(incoming);
    saveState(state);
    stopTimer();
    openDate(localISO());
    alert('Imported.');
  }catch(e){
    alert('Import failed.');
  }finally{
    importFile.value='';
  }
};

if('serviceWorker' in navigator){ window.addEventListener('load', ()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{})); }
ensureDraftFor(currentDate);
render();
