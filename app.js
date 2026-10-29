'use strict';
/* HAFS Focus: local-first static PWA. No private RESET LAB credentials or backend. */
const STORAGE_KEY = 'hafs-focus-v2';
const LEGACY_KEY = 'hafs-focus-study-v1';
const OFFSET = 9*3600000, DAY_MS = 86400000;
const GRADES = ['1','2','3'];
const TRACKS = { natural:'자연과학과정', humanities:'인문사회과정', international:'국제과정' };
const SUBJECTS = ['국어','영어','수학','사회','과학','한국사','일본어','수행','기타'];
const TYPES = ['자습','인강','숙제','복습','기타'];
const WEEKDAYS = ['일','월','화','수','목','금','토'];
const PERIODS = [['09:05','09:55'],['10:05','10:55'],['11:05','11:55'],['12:05','12:55'],['14:00','14:50'],['15:00','15:50'],['16:00','16:50']];
const pad = n => String(n).padStart(2,'0');
const $ = id => document.getElementById(id);
const hhmm = ms => { const d = new Date(ms + OFFSET); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
function kst(ms=Date.now()){ const d=new Date(ms+OFFSET); return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate(),weekday:d.getUTCDay(),hour:d.getUTCHours(),minute:d.getUTCMinutes()}; }
function dayKey(ms=Date.now()){const x=kst(ms);return `${x.year}-${pad(x.month)}-${pad(x.day)}`;}
function dayStart(ms=Date.now()){return Math.floor((ms+OFFSET)/DAY_MS)*DAY_MS-OFFSET;}
function duration(ms){const s=Math.floor(Math.max(0,ms)/1000);return `${pad(Math.floor(s/3600))}:${pad(Math.floor((s%3600)/60))}:${pad(s%60)}`;}
function durationShort(ms){const m=Math.floor(Math.max(0,ms)/60000);return `${Math.floor(m/60)}h ${pad(m%60)}m`;}
function timeMin(hm){const [h,m]=hm.split(':').map(Number);return h*60+m;}
function emptyTable(){return Array.from({length:5},()=>Array(8).fill(''));}
function cleanTable(value){return Array.isArray(value)&&value.length===5&&value.every(a=>Array.isArray(a)&&a.length===8)?value.map(a=>a.map(x=>typeof x==='string'?x.slice(0,30):'')):emptyTable();}
function profileKey(profile){return `${profile.grade}:${profile.track}`;}
function validProfile(p){return p&&GRADES.includes(String(p.grade))&&Object.hasOwn(TRACKS,p.track);}
function freshState(){return {version:2,profile:null,timetables:{},selectedSubject:'수학',selectedType:'자습',active:null,sessions:[],tasks:[]};}
function normalizeState(raw){
  const s=freshState(); if(!raw||typeof raw!=='object') return s;
  if(validProfile(raw.profile))s.profile={grade:String(raw.profile.grade),track:raw.profile.track};
  if(SUBJECTS.includes(raw.selectedSubject))s.selectedSubject=raw.selectedSubject;
  if(TYPES.includes(raw.selectedType))s.selectedType=raw.selectedType;
  if(raw.timetables&&typeof raw.timetables==='object'){
    for(const g of GRADES)for(const track of Object.keys(TRACKS)){const key=`${g}:${track}`;if(Object.hasOwn(raw.timetables,key))s.timetables[key]=cleanTable(raw.timetables[key]);}
  }
  // Legacy local prototype had only grade, one timetable, and an unpaused timer.
  if(raw.version!==2){
    if(!s.profile&&GRADES.includes(String(raw.grade)))s.migrationGrade=String(raw.grade);
    if(raw.timetable)s.legacyTable=cleanTable(raw.timetable);
  }
  if(Array.isArray(raw.sessions))s.sessions=raw.sessions.filter(x=>x&&SUBJECTS.includes(x.subject)&&Number.isFinite(x.startedAt)&&Number.isFinite(x.endedAt)&&x.endedAt>=x.startedAt&&x.endedAt<Date.now()+60000).slice(-10000).map(x=>({subject:x.subject,type:TYPES.includes(x.type)?x.type:'자습',startedAt:x.startedAt,endedAt:x.endedAt,intervals:Array.isArray(x.intervals)?x.intervals.filter(i=>Array.isArray(i)&&i.length===2&&Number.isFinite(i[0])&&Number.isFinite(i[1])&&i[1]>=i[0]&&i[0]>=x.startedAt&&i[1]<=x.endedAt):[[x.startedAt,x.endedAt]]}));
  if(Array.isArray(raw.tasks))s.tasks=raw.tasks.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x.due)).slice(-1500).map(x=>({id:x.id,title:x.title.slice(0,100),due:x.due,done:!!x.done}));
  if(raw.active&&SUBJECTS.includes(raw.active.subject)&&Number.isFinite(raw.active.startedAt)&&raw.active.startedAt<=Date.now()){
    const a=raw.active, intervals=Array.isArray(a.intervals)?a.intervals.filter(i=>Array.isArray(i)&&i.length===2&&i[1]>=i[0]&&i[0]>=a.startedAt):[];
    const segmentStart=Number.isFinite(a.segmentStart)&&a.segmentStart>=a.startedAt&&a.segmentStart<=Date.now()?a.segmentStart:null;
    s.active={subject:a.subject,type:TYPES.includes(a.type)?a.type:'자습',startedAt:a.startedAt,intervals,segmentStart};
  }else if(raw.activeSession&&SUBJECTS.includes(raw.activeSession.subject)&&Number.isFinite(raw.activeSession.startedAt)&&raw.activeSession.startedAt<=Date.now()){
    s.active={subject:raw.activeSession.subject,type:'자습',startedAt:raw.activeSession.startedAt,intervals:[],segmentStart:raw.activeSession.startedAt};
  }
  return s;
}
function overlap(a,b,start,end){return Math.max(0,Math.min(b,end)-Math.max(a,start));}
function sessionIntervals(s,now=Date.now()){
  const ranges=Array.isArray(s.intervals)?s.intervals:[];
  return s.segmentStart!=null?[...ranges,[s.segmentStart,now]]:ranges;
}
function activeElapsed(s,now=Date.now()){return s?sessionIntervals(s,now).reduce((sum,[a,b])=>sum+Math.max(0,b-a),0):0;}
function totalsInDay(sessions,active,start,now=Date.now()){
  const totals=Object.fromEntries(SUBJECTS.map(x=>[x,0]));
  for(const s of sessions){if(!Object.hasOwn(totals,s.subject))continue;const ranges=s.intervals?.length?s.intervals:[[s.startedAt,s.endedAt]];for(const [a,b] of ranges)totals[s.subject]+=overlap(a,b,start,start+DAY_MS);}
  if(active&&Object.hasOwn(totals,active.subject))for(const [a,b] of sessionIntervals(active,now))totals[active.subject]+=overlap(a,b,start,start+DAY_MS);
  return totals;
}
function dailySlots(grade,weekday,subjectRow=[]){
  // Official GMC weekday schedule, verified 2026-10-29; track-specific class names are user-edited, never fabricated.
  if(weekday===0||weekday===6)return [
    ['08:00','09:00','조식','meal'],['09:00','12:55','자유 시간 · 자습/학교활동','free'],
    ['12:55','13:40','중식','meal'],['14:00','17:40','자유 시간 · 자습/학교활동','free'],
    ['17:40','18:30','석식 및 간식','meal'],['18:50','23:40','자유 시간 · 자습/학교활동','free'],
    ['23:40','23:45','Roll Call','event']
  ];
  const breakfast={1:['08:10','08:30'],2:['07:50','08:10'],3:['07:30','07:50']}[grade];
  const lunch={1:['13:25','13:40'],2:['13:10','13:25'],3:['12:55','13:10']}[grade];
  const dinner={1:['18:20','18:40'],2:['18:00','18:20'],3:['17:40','18:00']}[grade];
  const checkout={1:'08:10',2:'08:00',3:'07:50'}[grade];
  const periods=[...PERIODS,weekday===1?['17:00','17:50']:['16:50','17:40']];
  const slots=[
    [grade==='3'?'06:40':'07:00',grade==='3'?'06:50':'07:10','기상','event'],
    [...breakfast,'조식','meal'],
    [checkout,checkout,'GMC 체크아웃 마감','marker'],
    ['09:00','09:05','조회','event']
  ];
  periods.forEach(([a,b],i)=>slots.push([a,b,subjectRow[i]?.trim()||`${i+1}교시`,'class']));
  slots.push([...lunch,'중식','meal'],[...dinner,'석식','meal'],['19:00','20:20','ET / 자기주도학습 (전반부)','study'],['20:20','20:50','휴식 및 간식','break'],['20:50',grade==='3'?'23:20':'23:00','자기주도학습 (후반부) · ET 2교시는 20:40~22:00','study'],['23:40','23:45','Roll Call','event']);
  return slots.sort((a,b)=>timeMin(a[0])-timeMin(b[0]));
}
function safeId(){return `${Date.now()}-${Math.random().toString(36).slice(2)}`;}

// Browser-only application below; pure functions above also run in Node smoke tests.
if(typeof document!=='undefined'){
  let state;
  try{const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_KEY);state=normalizeState(raw?JSON.parse(raw):null);}catch{state=freshState();}
  let currentTab='home',lastDay='',lastMinute='',installPrompt=null;
  function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch{notify('브라우저 저장에 실패했습니다. 저장 공간이나 비공개 모드를 확인하세요.');return false;}}
  function notify(msg){const n=$('app-notice');n.textContent=msg;n.classList.remove('hide');}
  function clearNotice(){$('app-notice').classList.add('hide');}
  function showSetup(){const modal=$('setup-overlay');modal.hidden=!!state.profile;document.body.classList.toggle('setup-open',!state.profile);if(!state.profile){modal.querySelector(`input[name=grade][value="${state.migrationGrade||'1'}"]`).checked=true;}}
  function setupProfile(grade,track){
    if(!GRADES.includes(grade)||!Object.hasOwn(TRACKS,track))return;
    state.profile={grade,track};
    if(state.legacyTable){const key=profileKey(state.profile);if(!state.timetables[key])state.timetables[key]=state.legacyTable;delete state.legacyTable;}
    delete state.migrationGrade;save();showSetup();renderAll();
  }
  function currentTable(){const key=profileKey(state.profile);return state.timetables[key]||(state.timetables[key]=emptyTable());}
  function openTab(tab){if(!$(tab)||!$(tab).classList.contains('page'))return;currentTab=tab;document.querySelectorAll('.nav-btn').forEach(btn=>{const yes=btn.dataset.tab===tab;btn.classList.toggle('selected',yes);btn.setAttribute('aria-current',yes?'page':'false');});document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===tab));$('pagetitle').textContent=tab==='timer'?'STUDY LAB':tab.toUpperCase();$('eyebrow').textContent=`HAFS FOCUS / ${String(['home','timer','schedule','planner','analytics','settings'].indexOf(tab)+1).padStart(2,'0')}`;window.scrollTo?.({top:0,behavior:'instant'});}
  function profileText(){return `${state.profile.grade}학년 · ${TRACKS[state.profile.track]}`;}
  function renderProfile(){if(!state.profile)return;$('quick-profile').textContent=profileText();$('sidebar-profile').textContent=profileText();$('settings-grade').value=state.profile.grade;$('settings-track').value=state.profile.track;}
  function renderClock(){const now=Date.now(),p=kst(now);$('headerdate').textContent=`${p.month}.${pad(p.day)} ${WEEKDAYS[p.weekday]} ${pad(p.hour)}:${pad(p.minute)}`;const a=state.active,elapsed=activeElapsed(a,now);$('timer-display').textContent=duration(elapsed);$('home-clock').textContent=duration(elapsed);$('home-timer-time').textContent=duration(elapsed);$('home-active').textContent=a?`${a.subject} · ${a.segmentStart==null?'일시정지':'측정 중'}`:'측정 중인 세션 없음';$('home-timer-subject').textContent=`선택 과목: ${a?.subject||state.selectedSubject}`;$('timer-state').textContent=!a?'READY TO FOCUS':a.segmentStart==null?'PAUSED':'FOCUSING';$('timer-description').textContent=!a?'과목을 선택한 다음 시작하세요.':a.segmentStart==null?'일시정지 중 · 재개하면 이어서 기록됩니다.':'창을 닫거나 새로고침해도 기록됩니다.';$('timer-start').disabled=!!a;$('timer-pause').disabled=!a;$('timer-finish').disabled=!a;$('timer-pause').textContent=a&&a.segmentStart==null?'RESUME':'PAUSE';$('subject-select').disabled=!!a;$('type-select').disabled=!!a;}
  function renderSubjectOptions(){const s=$('subject-select');s.replaceChildren();SUBJECTS.forEach(x=>{const el=document.createElement('option');el.value=x;el.textContent=x;s.append(el);});s.value=state.selectedSubject;$('type-select').value=state.selectedType;}
  function todayStats(){const t=totalsInDay(state.sessions,state.active,dayStart());return {bySubject:t,total:Object.values(t).reduce((a,b)=>a+b,0)};}
  function appendBreakdown(id,totals){const target=$(id);target.replaceChildren();const items=Object.entries(totals).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]);if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent='아직 공부 기록이 없습니다.';target.append(e);return;}const peak=items[0][1];for(const [name,ms] of items){const row=document.createElement('div');row.className='bar-row';const label=document.createElement('span');label.className='bar-label';label.textContent=name;const rail=document.createElement('div');rail.className='bar-rail';const fill=document.createElement('div');fill.className='bar-fill';fill.style.width=`${100*ms/peak}%`;rail.append(fill);const val=document.createElement('strong');val.className='bar-val';val.textContent=durationShort(ms);row.append(label,rail,val);target.append(row);}}
  function buildSessions(id,limit){const target=$(id);target.replaceChildren();const rows=[...state.sessions].sort((a,b)=>b.startedAt-a.startedAt).slice(0,limit);if(!rows.length){const el=document.createElement('div');el.className='empty';el.textContent='아직 저장된 공부 세션이 없습니다.';target.append(el);return;}for(const s of rows){const row=document.createElement('div');row.className='session';const info=document.createElement('div');const title=document.createElement('div');title.className='session-title';title.textContent=`${s.subject} · ${s.type}`;const desc=document.createElement('div');desc.className='session-desc';desc.textContent=`${dayKey(s.startedAt)} ${hhmm(s.startedAt)} – ${hhmm(s.endedAt)}`;info.append(title,desc);const time=document.createElement('div');time.className='session-time';time.textContent=duration(activeElapsed({...s,segmentStart:null}));row.append(info,time);target.append(row);}}
  function renderStudy(){const stats=todayStats();$('home-study').textContent=durationShort(stats.total);appendBreakdown('timer-breakdown',stats.bySubject);appendBreakdown('analytics-breakdown',stats.bySubject);buildSessions('timer-sessions',6);buildSessions('history-list',50);buildSessions('home-recent',3);const date0=dayStart(),now=Date.now();const data=[];for(let d=6;d>=0;d--){const start=date0-d*DAY_MS;const ms=Object.values(totalsInDay(state.sessions,state.active,start,now)).reduce((a,b)=>a+b,0);data.push({label:WEEKDAYS[kst(start+12*3600000).weekday],ms,today:d===0});}const max=Math.max(3600000,...data.map(x=>x.ms));const chart=$('weekly-chart');chart.replaceChildren();chart.setAttribute('aria-label',data.map(x=>`${x.label}요일 ${durationShort(x.ms)}`).join(', '));for(const x of data){const col=document.createElement('div');col.className=`day-column ${x.today?'today':''}`;const val=document.createElement('div');val.className='day-value';val.textContent=x.ms?(x.ms/3600000).toFixed(1)+'h':'0h';const track=document.createElement('div');track.className='day-track';const fill=document.createElement('div');fill.className='day-fill';fill.style.height=`${100*x.ms/max}%`;track.append(fill);const label=document.createElement('div');label.className='day-label';label.textContent=x.label;col.append(val,track,label);chart.append(col);}}
  function renderTasks(){const target=$('task-list');target.replaceChildren();$('home-tasks').textContent=state.tasks.filter(t=>!t.done).length;const rows=[...state.tasks].sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due));if(!rows.length){const e=document.createElement('div');e.className='empty';e.textContent='할 일을 추가하면 여기에 표시됩니다.';target.append(e);return;}for(const t of rows){const row=document.createElement('div');row.className=`task ${t.done?'done':''}`;const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=t.done;checkbox.setAttribute('aria-label',`${t.title} 완료 표시`);checkbox.addEventListener('change',()=>{t.done=checkbox.checked;save();renderTasks();});const info=document.createElement('div');info.className='task-body';const title=document.createElement('div');title.className='task-title';title.textContent=t.title;const due=document.createElement('div');due.className='task-due';due.textContent=`마감 ${t.due}`;info.append(title,due);const del=document.createElement('button');del.className='task-delete';del.type='button';del.textContent='✕';del.setAttribute('aria-label',`${t.title} 삭제`);del.addEventListener('click',()=>{state.tasks=state.tasks.filter(x=>x.id!==t.id);save();renderTasks();});row.append(checkbox,info,del);target.append(row);}}
  function getTodaySlots(){const p=kst();const row=p.weekday>=1&&p.weekday<=5?currentTable()[p.weekday-1]:[];return dailySlots(state.profile.grade,p.weekday,row);}
  function renderSchedule(){if(!state.profile)return;const p=kst(),now=p.hour*60+p.minute,rows=getTodaySlots();const active=rows.find(([start,end,_,type])=>type!=='marker'&&timeMin(start)<=now&&timeMin(end)>now);const next=rows.find(([start,_,__,type])=>timeMin(start)>now&&type!=='marker');const target=$('schedule-list');target.replaceChildren();for(const [start,end,title,type] of rows){const row=document.createElement('div');row.className=`schedule-item ${active&&active[0]===start&&active[2]===title?'current':''} ${timeMin(end)<now?'past':''}`;const time=document.createElement('div');time.className='schedule-time';time.textContent=type==='marker'?start:`${start}–${end}`;const name=document.createElement('div');name.className='schedule-name';name.textContent=title;row.append(time,name);target.append(row);}const label=`${profileText()} · ${p.weekday===0||p.weekday===6?'주말':'평일'}`;$('schedule-label').textContent=label;$('home-schedule-label').textContent=label;$('timetable-label').textContent=profileText();$('home-next').textContent=next?.[2]||'일과 종료';$('home-next-time').textContent=next?`${next[0]} 시작`:'오늘 남은 공식 일정 없음';const box=$('home-now-box');box.replaceChildren();const title=document.createElement('div');title.className='now-title';title.textContent=active?.[2]||'기본 일과 사이 휴식';const meta=document.createElement('div');meta.className='now-meta';meta.textContent=next?`다음: ${next[0]} · ${next[2]}`:'오늘의 주요 일정 종료';box.append(title,meta);}
  function renderTimetable(){if(!state.profile)return;const t=currentTable(),body=$('timetable-body');body.replaceChildren();for(let period=0;period<8;period++){const tr=document.createElement('tr');const th=document.createElement('th');th.scope='row';th.textContent=`${period+1}교시`;tr.append(th);for(let day=0;day<5;day++){const td=document.createElement('td');const input=document.createElement('input');input.maxLength=30;input.value=t[day][period];input.placeholder='—';input.setAttribute('aria-label',`${WEEKDAYS[day+1]}요일 ${period+1}교시 과목`);input.addEventListener('input',()=>{t[day][period]=input.value.slice(0,30);save();if(kst().weekday===day+1)renderSchedule();});td.append(input);tr.append(td);}body.append(tr);}}
  function renderAll(){if(!state.profile){showSetup();return;}clearNotice();renderProfile();renderSubjectOptions();renderClock();renderStudy();renderSchedule();renderTimetable();renderTasks();if(!$('task-date').value)$('task-date').value=dayKey();}
  function timerStart(){if(state.active)return;const now=Date.now();state.active={subject:state.selectedSubject,type:state.selectedType,startedAt:now,intervals:[],segmentStart:now};save();renderClock();renderStudy();}
  function timerTogglePause(){const a=state.active;if(!a)return;const now=Date.now();if(a.segmentStart!=null){a.intervals.push([a.segmentStart,now]);a.segmentStart=null;}else a.segmentStart=now;save();renderClock();renderStudy();}
  function timerFinish(){const a=state.active;if(!a)return;const now=Date.now();const intervals=sessionIntervals(a,now).filter(([start,end])=>end>start);if(intervals.length){state.sessions.push({subject:a.subject,type:a.type,startedAt:a.startedAt,endedAt:now,intervals});state.sessions=state.sessions.slice(-10000);}state.active=null;save();renderClock();renderStudy();}
  document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.tab)));
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>openTab(b.dataset.go)));
  $('quick-profile').addEventListener('click',()=>openTab('settings'));
  $('setup-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);setupProfile(String(f.get('grade')),String(f.get('track')));});
  $('profile-form').addEventListener('submit',e=>{e.preventDefault();setupProfile($('settings-grade').value,$('settings-track').value);notify('프로필을 저장했어요. 기존 시간표와 기록은 그대로 유지됩니다.');});
  $('subject-select').addEventListener('change',e=>{state.selectedSubject=e.target.value;save();renderClock();});
  $('type-select').addEventListener('change',e=>{state.selectedType=e.target.value;save();});
  $('timer-start').addEventListener('click',timerStart);
  $('timer-pause').addEventListener('click',timerTogglePause);
  $('timer-finish').addEventListener('click',timerFinish);
  $('task-form').addEventListener('submit',e=>{e.preventDefault();const title=$('task-title').value.trim(),due=$('task-date').value;if(!title||!/\d{4}-\d{2}-\d{2}/.test(due))return;state.tasks.push({id:safeId(),title:title.slice(0,100),due,done:false});$('task-title').value='';save();renderTasks();});
  $('timetable-reset').addEventListener('click',()=>{if(!confirm('현재 선택한 학년·계열 시간표만 비울까요? 다른 시간표는 유지됩니다.'))return;state.timetables[profileKey(state.profile)]=emptyTable();save();renderTimetable();renderSchedule();});
  $('backup-export').addEventListener('click',()=>{const backup={app:'HAFS Focus',version:2,exportedAt:new Date().toISOString(),data:state};const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`hafs-focus-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);});
  $('backup-import').addEventListener('click',()=>$('backup-file').click());
  $('backup-file').addEventListener('change',async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;if(file.size>5*1024*1024){notify('백업 크기는 최대 5MB입니다.');return;}try{const data=JSON.parse(await file.text());if(data.app!=='HAFS Focus'||![1,2].includes(data.version)||!data.data||typeof data.data!=='object')throw new Error('invalid');if(!confirm('현재 이 브라우저의 기록을 백업 파일로 교체할까요?'))return;state=normalizeState(data.data);save();showSetup();renderAll();notify('백업을 불러왔습니다.');}catch{notify('유효한 HAFS Focus 백업 파일이 아닙니다.');}});
  $('data-erase').addEventListener('click',()=>{if(!confirm('이 기기의 공부 기록·할 일·프로필·시간표를 모두 지울까요? 되돌릴 수 없습니다.'))return;localStorage.removeItem(STORAGE_KEY);localStorage.removeItem(LEGACY_KEY);state=freshState();showSetup();openTab('home');});
  window.addEventListener('storage',e=>{if([STORAGE_KEY,LEGACY_KEY].includes(e.key)){try{state=normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem(LEGACY_KEY)||'null'));}catch{state=freshState();}showSetup();renderAll();}});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('install-app').hidden=false;});
  $('install-app').addEventListener('click',async()=>{if(!installPrompt)return;const p=installPrompt;installPrompt=null;$('install-app').hidden=true;await p.prompt();});
  if('serviceWorker' in navigator&&location.protocol!=='file:')window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));
  showSetup();renderAll();setInterval(()=>{if(!state.profile)return;renderClock();const p=kst();const minute=`${dayKey()}-${p.hour}:${p.minute}`;if(lastMinute!==minute){lastMinute=minute;renderSchedule();renderStudy();renderTasks();}},1000);
}
if(typeof module!=='undefined'&&module.exports)module.exports={dailySlots,normalizeState,cleanTable,emptyTable,totalsInDay,activeElapsed,dayStart,dayKey,timeMin,profileKey,validProfile,duration};