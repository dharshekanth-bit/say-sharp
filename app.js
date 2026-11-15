'use strict';
/* Say Sharp — app logic (v3: AI coach, role-play, games, levels) */
const C = CONTENT, DRILLS = C.DRILLS;

/* ---------- storage ---------- */
const LS = {get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}, set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){toast('Phone storage is full')}}};
const settings = Object.assign({lang:'en-IN', buzz:true, liveAudio:true, liveCaptions:false, speakReplies:true, handsFree:true, waitMs:2000, camera:true, name:'', voice:'', aiKey:'', aiModel:'', aiModels:[], aiLastModel:'',
  fillers:TTP.DEFAULT_FILLERS.join(', '), softeners:TTP.DEFAULT_SOFTENERS.join(', ')}, LS.get('ttp.settings',{}));
const saveSettings = () => LS.set('ttp.settings', settings);
let sessions = LS.get('ttp.sessions', []);
function slimSessions(){
  const keep = new Set(sessions.slice().sort((a,b)=>b.ts-a.ts).slice(0,120).map(x=>x.id));
  sessions.forEach(x=>{ if(keep.has(x.id) || x.bench || x.slim) return;
    x.segments=[]; delete x.hist; if(x.m) delete x.m.matched;
    if(x.ai) x.ai={scores:x.ai.scores, headline:x.ai.headline, next_step:x.ai.next_step, presence:x.ai.presence, skill_check:x.ai.skill_check, clarity:x.ai.clarity, pacing:x.ai.pacing, expression:x.ai.expression, tip:x.ai.tip};
    x.note='Older session: details trimmed to save space on your phone.'; x.slim=true; });
}
const saveSessions = () => { try{ if(JSON.stringify(sessions).length > 3000000) slimSessions(); }catch(e){} LS.set('ttp.sessions', sessions); };
const gam = Object.assign({xp:0, badges:{}, rpCount:0, best:{}}, LS.get('ttp.gam',{}));
const saveGam = () => LS.set('ttp.gam', gam);
const wordList = s => s.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
function aiConfig(){ AI.setConfig({key:settings.aiKey, model:settings.aiModel||settings.aiLastModel, models:settings.aiModels, onModel:m=>{ if(settings.aiLastModel!==m){ settings.aiLastModel=m; saveSettings(); } }}); }
aiConfig();

let dbp = null;
function db(){ if(!dbp) dbp = new Promise((res,rej)=>{ const r=indexedDB.open('ttp',1); r.onupgradeneeded=()=>r.result.createObjectStore('audio'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);}); return dbp; }
async function putAudio(id,blob){ const d=await db(); return new Promise((res,rej)=>{const t=d.transaction('audio','readwrite');t.objectStore('audio').put(blob,id);t.oncomplete=res;t.onerror=()=>rej(t.error);}); }
async function getAudio(id){ const d=await db(); return new Promise(res=>{const r=d.transaction('audio').objectStore('audio').get(id);r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);}); }
async function delAudio(id){ const d=await db(); return new Promise(res=>{const t=d.transaction('audio','readwrite');t.objectStore('audio').delete(id);t.oncomplete=res;t.onerror=res;}); }

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = s => { s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };
const vib = p => { if(settings.buzz && navigator.vibrate) try{navigator.vibrate(p)}catch(e){} };
function toast(m,ms=2600){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),ms); }
const pick = a => a[Math.floor(Math.random()*a.length)];
const pickN = (a,n) => a.slice().sort(()=>Math.random()-.5).slice(0,n);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function highlight(text){
  const m = TTP.markText(text, wordList(settings.fillers), wordList(settings.softeners));
  let out=[], i=0;
  while(i<m.toks.length){ const t=m.toks[i];
    if(t.start){ const grp=m.toks.slice(i,i+t.len).map(x=>esc(x.raw)).join(' '); out.push('<mark'+(t.tag==='s'?' class="s"':'')+'>'+grp+'</mark>'); i+=t.len; }
    else { out.push(esc(t.raw)); i++; } }
  return {html: out.join(' '), fillers: Object.values(m.fillers).reduce((a,b)=>a+b,0), words: m.toks.length};
}
const scoreClass = v => v>=8?'#2E8B6A':v>=5?'#3D5A8A':'#C8463D';

/* ---------- navigation ---------- */
function show(v){
  document.querySelectorAll('.view').forEach(x=>x.classList.toggle('on', x.id==='v-'+v));
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on', b.dataset.v===v));
  if(v==='progress') renderProgress();
  if(v==='today') renderToday();
  if(v==='games') renderGames();
  if(v==='roleplay') renderScenarios();
  window.scrollTo(0,0);
}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
$('#gear').onclick=()=>show('settings');
$('#tipsBtn').onclick=()=>show('tips');

/* ---------- levels, XP, badges ---------- */
function levelOf(xp){ let i=0; C.LEVELS.forEach((l,k)=>{ if(xp>=l[0]) i=k; }); return i; }
function streak(){
  const days = new Set(sessions.map(s=>new Date(s.ts).toDateString()));
  let n=0; const d=new Date(); if(!days.has(d.toDateString())) d.setDate(d.getDate()-1);
  while(days.has(d.toDateString())){ n++; d.setDate(d.getDate()-1); }
  return n;
}
const popQ=[]; let popOn=false;
function popup(icon,title,desc){ popQ.push([icon,title,desc]); if(!popOn) nextPop(); }
function nextPop(){
  const p=popQ.shift(); if(!p){ popOn=false; $('#pop').classList.remove('on'); return; }
  popOn=true; $('#popBox').innerHTML=`<div class="bi">${p[0]}</div><h3>${esc(p[1])}</h3><p>${esc(p[2])}</p><button class="btn" id="popOk">Nice</button>`;
  $('#pop').classList.add('on'); vib([40,40,80]); $('#popOk').onclick=nextPop;
}
function addXP(n, why){
  n=Math.max(1,Math.round(n)); const before=levelOf(gam.xp); gam.xp+=n; saveGam();
  toast('+'+n+' XP · '+why);
  const after=levelOf(gam.xp); if(after>before) popup('🏆','Level up!','You are now: '+C.LEVELS[after][1]);
}
function award(id){ if(gam.badges[id]) return; gam.badges[id]=Date.now(); saveGam(); const b=C.BADGES.find(x=>x.id===id); if(b) popup(b.icon,'Badge: '+b.name,b.desc); }
function afterSession(s){
  award('first');
  const sc = s.m && s.m.score;
  if(s.kind!=='game'){
    if(sc>=80) award('s80'); if(sc>=90) award('s90');
    if(s.kind==='talk' && s.m && s.m.fillerCount===0 && s.dur>=30 && s.m.words>=40) award('zero');
  }
  if(s.camera){ award('cam1'); if(s.m && s.m.presence>=8) award('presence8'); }
  const st=streak(); if(st>=3) award('streak3'); if(st>=7) award('streak7'); if(st>=14) award('streak14');
  let xp = 3, why='practice';
  if(s.kind==='talk' && sc!=null){ xp = sc/5+5; why = 'score '+sc; }
  else if(s.kind==='read' && sc!=null){ xp = sc/10+3; why='clear reading'; }
  else if(s.kind==='roleplay'){ xp = (sc||50)/4+10; why='role-play'; }
  else if(s.kind==='game'){ xp = s.xp||5; why=s.gameName||'game'; }
  addXP(xp, why);
}
function renderLevel(){
  const i=levelOf(gam.xp), cur=C.LEVELS[i], nxt=C.LEVELS[i+1];
  const pct = nxt ? Math.round((gam.xp-cur[0])/(nxt[0]-cur[0])*100) : 100;
  $('#levelBox').innerHTML = `<div class="lvl" onclick="show('progress')"><div class="badge">${i+1}</div><div class="mid"><b>${esc(cur[1])}</b><small>${gam.xp} XP${nxt?' · '+(nxt[0]-gam.xp)+' to '+esc(nxt[1]):' · top level'}</small><div class="prog"><i style="width:${pct}%"></i></div></div><div class="fire"><span>🔥</span>${streak()} day${streak()===1?'':'s'}</div></div>`;
}

/* ---------- recorder ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, wakeLock = null;

function record(o){
  return new Promise(async resolve => {
    if(o.live && !SR){ if(!o.audio){ toast('This needs live listening: open the app in Chrome with internet.',4500); return resolve(null); } o.live=false; }
    rec = Object.assign({t0:0, committed:[], cur:{}, interim:'', chunks:[], vchunks:[], frames:[], stream:null, mr:null, vmr:null, sr:null, stopping:false, maxF:0, note:'', audioOff:false, targetBuzzed:false, lastWords:0, lastChange:0, fail:null}, o, {resolve});
    if(o.audio){
      try{
        const aC = {echoCancellation:true, noiseSuppression:true, autoGainControl:true};
        if(o.video){
          try{ rec.stream = await navigator.mediaDevices.getUserMedia({audio:aC, video:{facingMode:'user', width:{ideal:480}, height:{ideal:640}, frameRate:{ideal:15, max:20}}}); }
          catch(ve){ rec.video=false; toast('Camera not available. Recording voice only.',3500); }
        }
        if(!rec.stream) rec.stream = await navigator.mediaDevices.getUserMedia({audio:aC});
        const mime = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(m=>window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
        const aStream = rec.video ? new MediaStream(rec.stream.getAudioTracks()) : rec.stream;
        rec.mr = new MediaRecorder(aStream, mime?{mimeType:mime}:undefined);
        if(rec.video) startCamera(rec);
        rec.mr.ondataavailable = e => { if(e.data && e.data.size) rec.chunks.push(e.data); };
        rec.mr.start(1000);
        startMeter(rec.stream);
      }catch(e){
        if(!o.live){ micHelp(e); rec=null; return resolve(null); }
        rec.audioOff = true;
      }
    }
    if(o.live) startRecognition();
    rec.t0 = Date.now(); rec.lastChange = rec.t0;
    try{ if(navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
    $('#rPrompt').textContent = o.game ? o.game.title : (o.prompt||'');
    $('#nF').textContent='0'; $('#nW').textContent='0';
    $('#counters').style.display = (o.live && !o.game) ? '' : 'none';
    $('#gameTop').style.display = o.game ? '' : 'none';
    $('#bannedBox').innerHTML = o.game && o.game.show ? o.game.show.map(w=>`<span>${esc(w)}</span>`).join('') : '';
    $('#bigT').textContent='0'; $('#bigT').classList.remove('danger');
    $('#timer').style.visibility = o.game ? 'hidden' : 'visible';
    $('#pocketBtn').style.display = o.game ? 'none' : '';
    $('#live').innerHTML = o.readTarget ? renderTarget(o.readTarget, []) :
      o.showText ? '<div class="ramble">'+esc(o.showText)+'</div>' :
      o.game ? '<div class="prompt" style="font-size:19px">'+esc(o.prompt)+'</div><span class="ph">Keep talking…</span>' :
      '<div class="prompt" style="font-size:19px;margin:0 0 8px">'+esc(o.prompt||'')+'</div><span class="ph">'+(o.hidden?'Pause two seconds. Pick a frame. Then answer, point first.': o.live?'Listening… start with your starter line.':'Recording… speak naturally. Your coach reviews it when you tap Stop.')+'</span>';
    $('#rNote').textContent = '';
    $('#camWrap').style.display = rec.video ? '' : 'none';
    $('#camPrompt').textContent = rec.video ? (o.hidden ? o.prompt : (o.prompt||'')) : '';
    $('#live').style.display = rec.video && !o.live ? 'none' : '';
    $('#recorder').classList.toggle('cam', !!rec.video);
    $('#recorder').classList.add('on');
    rec.tick = setInterval(tick, 200);
  });
}
function startCamera(r){
  const v=$('#camView'); v.srcObject=r.stream; v.muted=true; v.play().catch(()=>{});
  const vmime = ['video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus','video/webm','video/mp4'].find(m=>window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
  try{
    r.vmr = new MediaRecorder(r.stream, Object.assign({videoBitsPerSecond:300000, audioBitsPerSecond:32000}, vmime?{mimeType:vmime}:{}));
    r.vmr.ondataavailable = e => { if(e.data && e.data.size) r.vchunks.push(e.data); };
    r.vmr.start(1000);
  }catch(e){ r.vmr=null; }
  // low-resolution still frames for the AI coach (cheap on data)
  const cv=document.createElement('canvas'), ctx=cv.getContext('2d');
  const every = Math.max(2, Math.round((r.targetSec||60)/20));
  r.frameTimer = setInterval(()=>{
    if(!v.videoWidth) return;
    const w=240, h=Math.round(v.videoHeight/v.videoWidth*w); cv.width=w; cv.height=h;
    ctx.drawImage(v,0,0,w,h);
    const data = cv.toDataURL('image/jpeg',0.55).split(',')[1];
    r.frames.push({t:Math.round((Date.now()-r.t0)/1000), data});
    if(r.frames.length>40) r.frames = r.frames.filter((_,i)=>i%2===0);
  }, every*1000);
  const grab=()=>{ if(!v.videoWidth || r.stopping) return; const w=240, h=Math.round(v.videoHeight/v.videoWidth*w); cv.width=w; cv.height=h; ctx.drawImage(v,0,0,w,h); r.frames.push({t:Math.round((Date.now()-r.t0)/1000), data:cv.toDataURL('image/jpeg',0.55).split(',')[1]}); };
  setTimeout(grab, 1200);
}
function micHelp(e){
  const msg = (e && (e.name==='NotAllowedError' || e.name==='SecurityError')) ?
    'Microphone blocked. Tap the lock icon by the address → Permissions → Microphone → Allow. Also check phone Settings → Apps → Chrome → Permissions.' :
    'Could not start the microphone ('+(e&&e.name||'error')+'). Close other apps using the mic and try again.';
  toast(msg, 7000);
}
function startRecognition(){
  const r = new SR();
  r.lang = settings.lang; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
  r.onresult = e => {
    if(!rec) return;
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t = e.results[i][0].transcript.trim();
      if(e.results[i].isFinal) rec.cur[i]=t; else interim += ' '+t;
    }
    rec.interim = interim.trim();
    renderLive();
  };
  r.onerror = e => {
    if(!rec) return;
    if(e.error==='audio-capture' && rec.stream && !rec.audioOff){
      stopAudio(true); rec.note='This phone can’t record voice and live text together. Live text kept.'; $('#rNote').textContent=rec.note;
    } else if(e.error==='not-allowed' || e.error==='service-not-allowed'){ micHelp({name:'NotAllowedError'}); }
    else if(e.error==='network'){ $('#rNote').textContent='Live text needs internet.'; }
  };
  r.onend = () => {
    if(!rec) return;
    rec.committed = currentSegments(); rec.cur = {};
    if(!rec.stopping){ setTimeout(()=>{ if(rec && !rec.stopping){ try{ r.start(); }catch(e){} } }, 120); }
    else if(rec.onSrEnd) rec.onSrEnd();
  };
  rec.sr = r;
  try{ r.start(); }catch(e){}
}
function dedupe(segs){
  const out=[], n=s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
  for(const s of segs){ const ns=n(s); if(!ns) continue; const last=out[out.length-1];
    if(last){ const nl=n(last); if(ns.startsWith(nl)){ out[out.length-1]=s; continue; } if(ns.length>10 && nl.endsWith(ns)) continue; }
    out.push(s); }
  return out;
}
function currentSegments(){ const idx=Object.keys(rec.cur).map(Number).sort((a,b)=>a-b); return dedupe(rec.committed.concat(idx.map(i=>rec.cur[i]))); }

function gameCheck(text){
  // returns the first banned/filler word found, or null
  const g = rec.game, toks = TTP.markText(text, g.fillers, g.softeners);
  const hit = toks.toks.find(t=>t.tag && t.start);
  if(hit) return hit.len>1 ? toks.toks.slice(toks.toks.indexOf(hit), toks.toks.indexOf(hit)+hit.len).map(t=>t.w).join(' ') : hit.w;
  if(g.banned && g.banned.length){
    for(const t of toks.toks){ for(const b of g.banned){ const bb=b.toLowerCase(); if(t.w===bb || (t.w.startsWith(bb) && t.w.length<=bb.length+3)) return b; } }
  }
  return null;
}
function renderLive(){
  if(!rec) return;
  const segs = currentSegments();
  const heard=(segs.join(' ')+' '+rec.interim).trim();
  if(rec.game){
    const hl = highlight(heard);
    $('#live').innerHTML = '<div class="prompt" style="font-size:18px">'+esc(rec.prompt)+'</div><div style="font-size:17px">'+(hl.html||'<span class="ph">Keep talking…</span>')+'</div>';
    $('#live').scrollTop=1e9;
    if(hl.words!==rec.lastWords){ rec.lastWords=hl.words; rec.lastChange=Date.now(); }
    const w = gameCheck(heard);
    if(w && !rec.fail){ rec.fail={word:w, at:(Date.now()-rec.t0)/1000}; vib([300]); $('#recorder').classList.add('flash'); setTimeout(()=>$('#recorder').classList.remove('flash'),600); finish(false); }
    return;
  }
  if(rec.readTarget){
    const rs=TTP.readScore(rec.readTarget, heard);
    $('#live').innerHTML = renderTarget(rec.readTarget, rs.matched, true) + (heard?'<div class="heard">Heard: '+esc(heard.slice(-160))+'</div>':'');
    return;
  }
  const fin = highlight(segs.join(' '));
  const all = highlight(heard);
  $('#live').innerHTML = '<div class="prompt" style="font-size:16px;margin:0 0 8px;color:var(--mut)">'+esc(rec.prompt||'')+'</div>'+((fin.html||'') + (rec.interim ? ' <span class="int">'+highlight(rec.interim).html+'</span>' : '') || '<span class="ph">Listening…</span>');
  $('#live').scrollTop = 1e9;
  $('#nW').textContent = all.words;
  if(all.fillers > rec.maxF){ rec.maxF = all.fillers; vib(90); const c=$('#cF'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
  $('#nF').textContent = Math.max(fin.fillers, Math.min(all.fillers, rec.maxF));
}
function tick(){
  if(!rec || rec.stopping) return;
  const s = (Date.now()-rec.t0)/1000;
  const t = rec.targetSec;
  if(rec.game){
    $('#bigT').textContent = Math.floor(s);
    const quiet = (Date.now()-rec.lastChange)/1000;
    if(s>4 && quiet>6 && !rec.fail){ rec.fail={word:'(silence)', at:s}; vib([300]); finish(false); return; }
    $('#bigT').classList.toggle('danger', quiet>3.5 && s>4);
    if(rec.game.limit && s>=rec.game.limit){ finish(false); }
    return;
  }
  const shown = t ? (s<=t ? fmt(t-s) : '+'+fmt(s-t)) : fmt(s);
  $('#timer').textContent = shown; $('#timer').classList.toggle('over', !!t && s>t);
  $('#pTime').textContent = fmt(s);
  if(t && s>t && !rec.targetBuzzed){ rec.targetBuzzed=true; vib([120,80,120]); }
  if(rec.autoStopSec && s>=rec.autoStopSec) finish(false);
}
let meterCtx=null, meterRAF=0;
function startMeter(stream){
  try{
    meterCtx = new (window.AudioContext||window.webkitAudioContext)();
    const an = meterCtx.createAnalyser(); an.fftSize=512; meterCtx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize), bars=[...Array(24)].map(()=>document.createElement('i'));
    const w=$('#wave'); w.innerHTML=''; bars.forEach(b=>w.appendChild(b));
    let k=0;
    const loop=()=>{ an.getByteTimeDomainData(buf); let m=0; for(const v of buf) m=Math.max(m,Math.abs(v-128)); bars[k%24].style.height=(4+Math.min(32,m*0.7))+'px'; k++; meterRAF=requestAnimationFrame(loop); };
    loop();
  }catch(e){}
}
function stopMeter(){ cancelAnimationFrame(meterRAF); if(meterCtx){ try{meterCtx.close()}catch(e){} meterCtx=null; } $('#wave').innerHTML=''; }
function stopAudio(discard){
  if(!rec) return;
  if(discard){ rec.audioOff=true; rec.chunks=[]; if(rec.mr) rec.mr.ondataavailable=null; }
  try{ if(rec.mr && rec.mr.state!=='inactive') rec.mr.stop(); }catch(e){}
  if(rec.stream) rec.stream.getTracks().forEach(t=>t.stop());
  if(discard){ rec.stream=null; rec.mr=null; stopMeter(); }
}
$('#stopBtn').onclick = ()=>finish(false);
$('#cancelBtn').onclick = ()=>{ if(confirm('Cancel this recording?')) finish(true); };
async function finish(cancel){
  if(!rec || rec.stopping) return;
  rec.stopping = true;
  const r = rec;
  clearInterval(r.tick);
  const dur = (Date.now()-r.t0)/1000;
  $('#stopBtn').textContent='…';
  const srDone = new Promise(res=>{ if(!r.sr) return res(); r.onSrEnd=res; try{ r.sr.stop(); }catch(e){res();} setTimeout(res,1500); });
  const audioDone = new Promise(res=>{ if(!r.mr || r.mr.state==='inactive') return res(); r.mr.onstop=res; try{ r.mr.stop(); }catch(e){res();} setTimeout(res,2500); });
  const videoDone = new Promise(res=>{ if(!r.vmr || r.vmr.state==='inactive') return res(); r.vmr.onstop=res; try{ r.vmr.stop(); }catch(e){res();} setTimeout(res,2500); });
  clearInterval(r.frameTimer);
  await Promise.all([srDone, audioDone, videoDone]);
  const cv=$('#camView'); if(cv){ cv.pause(); cv.srcObject=null; }
  if(r.stream) r.stream.getTracks().forEach(t=>t.stop());
  stopMeter();
  try{ if(wakeLock){ await wakeLock.release(); wakeLock=null; } }catch(e){}
  let segs = r.live ? currentSegments() : [];
  if(r.live && r.interim) segs = dedupe(segs.concat([r.interim]));
  const blob = r.chunks.length ? new Blob(r.chunks, {type: r.chunks[0].type || 'audio/webm'}) : null;
  $('#stopBtn').textContent='Stop';
  $('#recorder').classList.remove('on'); $('#pocket').classList.remove('on');
  rec = null;
  const vblob = r.vchunks.length ? new Blob(r.vchunks, {type: r.vchunks[0].type || 'video/webm'}) : null;
  r.resolve(cancel ? null : {dur, blob, vblob, frames:r.frames, segments:segs, note:r.note||'', fail:r.fail});
}
$('#pocketBtn').onclick=()=>{ $('#pocket').classList.add('on'); toast('Hold the circle for 2 seconds to unlock',2000); };
(()=>{ let t=null; const p=$('#pocket'), ring=$('#pRing');
  const down=e=>{ e.preventDefault(); ring.style.borderColor='#555'; t=setTimeout(()=>{ p.classList.remove('on'); ring.style.borderColor=''; vib(50); },2000); };
  const up=()=>{ clearTimeout(t); ring.style.borderColor=''; };
  p.addEventListener('touchstart',down,{passive:false}); p.addEventListener('touchend',up); p.addEventListener('mousedown',down); p.addEventListener('mouseup',up);
})();
document.addEventListener('visibilitychange', async ()=>{ if(document.visibilityState==='visible' && rec && !wakeLock && navigator.wakeLock){ try{ wakeLock=await navigator.wakeLock.request('screen'); }catch(e){} } });

async function decodeTo16k(blob){
  const buf = await blob.arrayBuffer();
  let ctx;
  try{ ctx = new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000}); }catch(e){ ctx = new (window.AudioContext||window.webkitAudioContext)(); }
  const ab = await ctx.decodeAudioData(buf);
  try{ ctx.close(); }catch(e){}
  let data = ab.getChannelData(0);
  if(ab.sampleRate !== 16000){
    const off = new OfflineAudioContext(1, Math.ceil(ab.duration*16000), 16000);
    const src = off.createBufferSource(); src.buffer = ab; src.connect(off.destination); src.start();
    data = (await off.startRendering()).getChannelData(0);
  }
  return data;
}
async function usablePcm(blob){
  if(!blob || blob.size<1500) return null;
  try{ const pcm = await decodeTo16k(blob); let peak=0; for(let i=0;i<pcm.length;i+=40) peak=Math.max(peak,Math.abs(pcm[i])); return peak>0.003 ? pcm : null; }
  catch(e){ return null; }
}
function countdown(q, n=3){
  return new Promise(async res=>{
    $('#cdQ').textContent=q; $('#countdown').classList.add('on');
    for(let i=n;i>0;i--){ $('#cdN').textContent=i; vib(30); await sleep(1000); }
    $('#countdown').classList.remove('on'); res();
  });
}

/* ---------- loading screen ---------- */
const LOAD_MSGS = ['Listening back to every word…','Counting the “so”s and “uh”s…','Checking if you got to the point…','Writing your coaching notes…','Almost there…'];
function showLoading(title){
  const el=$('#result');
  el.innerHTML=`<div class="rhead"><div><h2>${esc(title)}</h2><p>This usually takes 5–20 seconds</p></div></div><div class="loading"><div class="spinner"></div><div id="loadMsg">${LOAD_MSGS[0]}</div></div>`;
  el.classList.add('on'); let k=0; clearInterval(showLoading._t);
  showLoading._t=setInterval(()=>{ const m=$('#loadMsg'); if(!m){ clearInterval(showLoading._t); return; } k=(k+1)%LOAD_MSGS.length; m.textContent=LOAD_MSGS[k]; },2800);
}
function stopLoading(){ clearInterval(showLoading._t); }

/* ---------- talk & read sessions ---------- */
function newSession(o, raw){
  return {id:'s'+Date.now(), ts:Date.now(), kind:o.kind||'talk', drill:o.drill||'', prompt:o.prompt||'', targetSec:o.targetSec||0, maxWords:o.maxWords||0,
    target:o.target||'', bench:o.bench||'', skillTitle:o.skillTitle||'', day:o.ctx?prog.day:0, stepK:o.stepK||'', ctx:o.ctx||null, structure:o.structure||null, focus:o.focus||'', hidden:!!o.hidden,
    dur:raw?raw.dur:0, segments:raw?raw.segments||[]:[], hes:[], hasAudio:false, note:raw?raw.note||'':'', source:raw&&raw.segments&&raw.segments.length?'live':'none'};
}
async function runTalk(o){
  const ai = AI.ready(), isRead = o.kind==='read';
  const raw = await record({prompt:o.prompt, targetSec:o.targetSec, hidden:o.hidden, readTarget:isRead?o.target:null, video:!!o.camera && !isRead,
    audio: ai ? true : (o.mode==='walk' || settings.liveAudio || !!o.camera), live: ai ? (settings.liveCaptions && o.mode!=='walk') : (o.mode!=='walk' && !(o.camera && !isRead))});
  if(!raw) return;
  const s = newSession(o, raw);
  showLoading(ai ? 'Your coach is listening…' : 'Checking your talk…');
  const pcm = await usablePcm(raw.blob);
  if(pcm){ try{ await putAudio(s.id, raw.blob); s.hasAudio=true; }catch(e){} }
  if(raw.vblob && raw.vblob.size>5000){ try{ await putAudio(s.id+'_v', raw.vblob); s.hasVideo=true; }catch(e){} }
  pruneMedia();
  s.camera = !!(raw.frames && raw.frames.length);
  if(ai && pcm){
    try{
      if(isRead) s.ai = await AI.analyseRead(pcm, s.target);
      else s.ai = await AI.analyseTalk(pcm, {task:o.task||'', prompt:s.prompt, structure:s.structure, targetSec:s.targetSec, maxWords:s.maxWords, focus:s.focus, dur:s.dur}, s.camera ? raw.frames : null);
      s.segments = TTP.splitSegments(s.ai.transcript||''); s.source='ai';
    }catch(e){ s.aiError = e.user || e.message; }
  } else if(ai && !pcm){ s.aiError = 'No sound was recorded, so the coach could not listen. Check the microphone.'; }
  if(!s.ai && pcm && !isRead) s.hes = TTP.detectHesitations(pcm,16000).events;
  computeMetrics(s);
  stopLoading();
  sessions.unshift(s); saveSessions();
  if(s.ctx){ prog.pending=s.id; saveProg(); }
  afterSession(s);
  openResult(s);
}
// keep the phone from filling up: check-in recordings are always kept
async function pruneMedia(){
  const vids = sessions.filter(x=>x.hasVideo && !x.bench).sort((a,b)=>b.ts-a.ts);
  for(const x of vids.slice(14)){ await delAudio(x.id+'_v'); x.hasVideo=false; }
  const auds = sessions.filter(x=>x.hasAudio && !x.bench).sort((a,b)=>b.ts-a.ts);
  for(const x of auds.slice(60)){ await delAudio(x.id); x.hasAudio=false; }
  saveSessions();
}
function presenceAvg(p){ if(!p) return null; const v=[p.eye_contact,p.expression,p.posture,p.energy].map(Number).filter(x=>x>0); return v.length? Math.round(v.reduce((a,b)=>a+b,0)/v.length*10)/10 : null; }
function aiOverall(sc){
  const w={fluency:.18, clarity:.14, conciseness:.18, structure:.13, relevance:.13, confidence:.12, grammar:.12}; let t=0, tw=0;
  for(const k in w){ if(sc[k]==null) continue; t += Math.max(1,Math.min(10, +sc[k]||5))*w[k]; tw+=w[k]; }
  return tw ? Math.round(t/tw*10) : null;
}
function computeMetrics(s){
  const fl=wordList(settings.fillers), so=wordList(settings.softeners);
  if(s.kind==='read'){
    const base = TTP.analyse({segments:s.segments, durationSec:s.dur, fillers:fl, softeners:so});
    if(s.ai){
      const a=s.ai, cl=x=>Math.max(1,Math.min(10,+x||5));
      s.m = Object.assign(base, {score: Math.round((cl(a.clarity)*.6+cl(a.pacing)*.2+cl(a.expression)*.2)*10), clarity: cl(a.clarity)*10, tip:a.tip||''});
      return;
    }
    const rs = TTP.readScore(s.target, s.segments.join(' '));
    const missed = []; rs.matched.forEach((ok,i)=>{ if(!ok && i < Math.round(rs.targetWords*rs.coverage/100)) missed.push(TTP.readWords(s.target)[i]); });
    let tip = rs.clarity<80 ? 'The phone missed some words'+(missed.length?': “'+[...new Set(missed)].slice(0,4).join('”, “')+'”':'')+'. Slow down and finish the last sound of each word.' :
      base.wpm>165 ? 'Clear, but fast ('+base.wpm+' words/min). Slow down and pause at each “/”.' :
      base.wpm<100 && s.segments.length ? 'Clear. A little slow. Keep a steady flow between the pauses.' :
      rs.coverage<90 ? 'Read the whole text next time.' : 'Very clear. Next time, add stress to the key words.';
    s.m = Object.assign(base, {score: s.segments.length? rs.clarity : null, clarity: rs.clarity, coverage: rs.coverage, matched: rs.matched, tip});
    if(!s.segments.length) s.m.tip='No speech was picked up. Check the microphone and try again.';
    return;
  }
  s.m = TTP.analyse({segments:s.segments, durationSec:s.dur, targetSec:s.targetSec, maxWords:s.maxWords, hesitations:s.hes, fillers:fl, softeners:so});
  if(s.ai && s.ai.scores){ s.m.score = aiOverall(s.ai.scores); s.m.dims = s.ai.scores; s.m.tip = s.ai.next_step || s.m.tip;
    const pa = presenceAvg(s.ai.presence); if(pa!=null && s.m.score!=null){ s.m.presence=pa; s.m.score = Math.round(s.m.score*0.85 + pa*10*0.15); }
    if(s.ai.skill_check) s.m.skill = +s.ai.skill_check.score||null; }
  else if(!s.segments.length){ s.m.score = null; s.m.tip = s.hasAudio ? (s.aiError || 'Tap “Turn into text” to get your filler count and score.') : 'No speech was picked up. Check the microphone and try again.'; }
}

/* ---------- result screens ---------- */
function ring(score, size=74){
  const r=size/2-6, c=2*Math.PI*r, v = score==null?0:score/100;
  const col = score==null?'#8090A8': score>=80?'#5BC79A': score>=60?'#F6C54E':'#FF8A80';
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="rgba(255,255,255,.15)" stroke-width="7" fill="none"/><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="${col}" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-v)}" transform="rotate(-90 ${size/2} ${size/2})"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="${size*0.3}" font-weight="700" font-family="system-ui">${score==null?'–':score}</text></svg>`;
}
function renderTarget(text, matched, live){
  let k=0; const out=[];
  String(text).split(/\s+/).filter(Boolean).forEach(tok=>{
    if(tok==='/'){ out.push('<span class="pz">│</span>'); return; }
    const n = TTP.readWords(tok).length;
    let ok=n>0, any=false; for(let j=0;j<n;j++){ if(matched[k+j]) any=true; else ok=false; }
    const reached = matched.length && k < matched.lastIndexOf(true)+1;
    k+=n;
    const strong = /\*/.test(tok);
    const clean = esc(tok.replace(/\*/g,''));
    const cls = !matched.length ? '' : ok ? ' ok' : (!live && (reached||any)) ? ' miss' : '';
    out.push('<span class="w'+cls+'">'+(strong?'<b>'+clean+'</b>':clean)+'</span>');
  });
  return '<div class="target">'+out.join(' ')+'</div>';
}
function resultButtons(s){
  if(s.ctx && prog.pending===s.id) return `<button class="btn" id="nextBtn">Next →</button><button class="btn sec" id="redoBtn">Redo this one</button>`;
  return `<button class="btn" id="againBtn">Try again</button><button class="btn sec" id="doneBtn">Done</button>`;
}
function wireResultButtons(s){
  const nb=$('#nextBtn'); if(nb){ nb.onclick=()=>{ commitStep(s); closeResult(); runNext(); }; $('#redoBtn').onclick=()=>{ closeResult(); runStep(s.ctx.step); }; return; }
  const ag=$('#againBtn'); if(ag) ag.onclick=()=>{ closeResult(); again(s); };
  const dn=$('#doneBtn'); if(dn) dn.onclick=closeResult;
}
function again(s){
  if(s.kind==='roleplay') return startRoleplay(s.scn);
  if(s.kind==='game') return startGame(s.game);
  runTalk({kind:s.kind, prompt:s.prompt, target:s.target, targetSec:s.targetSec, maxWords:s.maxWords, structure:s.structure, drill:s.drill, mode:s.drill==='walk'?'walk':'', hidden:false});
}
function closeResult(){ const a=$('#aud'); if(a) a.pause(); stopSpeak(); $('#result').classList.remove('on'); if($('#v-today').classList.contains('on')) renderToday(); if($('#v-progress').classList.contains('on')) renderProgress(); }
let currentAudioURL=null;
async function wireAudio(s){
  if(s.hasVideo){ const vb=await getAudio(s.id+'_v'); const ve=$('#vid'); if(vb && ve){ ve.src=URL.createObjectURL(vb); } }
  if(!s.hasAudio) return;
  const b = await getAudio(s.id); if(!b) return;
  if(currentAudioURL) URL.revokeObjectURL(currentAudioURL);
  currentAudioURL = URL.createObjectURL(b); const a=$('#aud'); if(!a) return; a.src=currentAudioURL;
  document.querySelectorAll('#result [data-t]').forEach(c=>c.onclick=()=>{ a.currentTime=Math.max(0,+c.dataset.t-1); a.play(); });
  const dl=$('#dlAud'); if(dl) dl.onclick=()=>{ const x=document.createElement('a'); x.href=currentAudioURL; x.download='say-sharp-'+new Date(s.ts).toISOString().slice(0,16).replace(/[:T]/g,'-')+(b.type.includes('mp4')?'.m4a':'.webm'); x.click(); };
}
function dimBars(d){
  const names={fluency:'Flow',clarity:'Clarity',conciseness:'To the point',structure:'Structure',relevance:'Answered it',confidence:'Confidence',grammar:'Grammar'};
  return '<div class="dims">'+AI.DIMS.filter(k=>d[k]!=null).map(k=>{ const v=Math.max(1,Math.min(10,+d[k]||0)); return `<div class="dim"><span>${names[k]}</span><div class="bar"><i style="width:${v*10}%;background:${scoreClass(v)}"></i></div><b>${v}</b></div>`; }).join('')+'</div>';
}
function wordChips(m){
  const f = m.fillers.map(([w,n])=>`<span class="chip f">${esc(w)} ×${n}</span>`).join('');
  const so = m.softeners.map(([w,n])=>`<span class="chip">${esc(w)} ×${n}</span>`).join('');
  return f+so || '<span class="chip g">None ✓</span>';
}
async function openResult(s){
  if(s.kind==='read') return openReadResult(s);
  if(s.kind==='game') return openGameResult(s);
  if(s.ai) return openAIResult(s);
  return openLocalResult(s);
}
async function openAIResult(s){
  const m=s.m, a=s.ai, el=$('#result');
  const reps = (a.repetitions||[]).filter(Boolean).map(r=>`<span class="chip r">${esc(r)}</span>`).join('') + (m.restarts||[]).map(([w,n])=>`<span class="chip r">“${esc(w)} ${esc(w)}” ×${n}</span>`).join('');
  const totalWeak = m.fillerCount + m.softenerCount;
  const mins = Math.max(s.dur/60, .25);
  const isRp = s.kind==='roleplay';
  el.innerHTML = `
    <div class="rhead">${ring(m.score)}<div><h2>${esc(a.headline||'Your result')}</h2><p>${esc(s.prompt)}</p></div></div>
    <main>
      <div class="tip"><p class="lbl">Fix this next time</p>${esc(a.next_step||m.tip)}</div>
      ${isRp && a.outcome?`<div class="card"><p class="lbl">How they’d feel</p><p style="margin:0;font-size:15px">${esc(a.outcome)}</p></div>`:''}
      ${a.skill_check&&s.focus?`<div class="card"><p class="lbl">Today’s skill · ${esc(s.skillTitle||'')}</p><div class="dims"><div class="dim"><span>Applied it</span><div class="bar"><i style="width:${(+a.skill_check.score||0)*10}%;background:${scoreClass(+a.skill_check.score||0)}"></i></div><b>${+a.skill_check.score||'–'}</b></div></div><p style="margin:8px 0 0;font-size:15px">${esc(a.skill_check.note||'')}</p></div>`:''}
      ${s.hasVideo?`<div class="card"><p class="lbl">Watch yourself</p><video id="vid" controls playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000"></video></div>`:''}
      ${a.presence?presenceCard(a.presence):''}
      <div class="card"><p class="lbl">Your scores</p>${dimBars(a.scores||{})}</div>
      <div class="card"><p class="lbl">Fillers &amp; weak words · ${totalWeak} total · ${(totalWeak/mins).toFixed(1)} per min</p>
        <div class="chips">${(m.startFiller||m.startHesitation)&&!isRp?`<span class="chip r">Started with “${esc(m.startFiller||'uh')}”</span>`:''}${wordChips(m)}</div>
        ${reps?`<p class="lbl" style="margin-top:14px">Repeated or restarted</p><div class="chips">${reps}</div>`:''}
        <p class="note" style="padding:10px 0 0">${s.dur?fmt(s.dur)+' · ':''}${m.words} words · ${m.wpm} words/min</p></div>
      ${a.delivery?`<div class="card"><p class="lbl">What the coach heard</p><p style="margin:0;font-size:15px">${esc(a.delivery)}</p></div>`:''}
      ${isRp && (a.best_moment||a.missed_moment)?`<div class="card"><p class="lbl">Best moment</p><p style="margin:0 0 10px;font-size:15px">${esc(a.best_moment)}</p><p class="lbl">Missed moment</p><p style="margin:0;font-size:15px">${esc(a.missed_moment)}</p></div>`:''}
      ${grammarCard(a.grammar)}
      ${pronCard(isRp ? (s.hist||[]).filter(h=>h.pron&&h.pron.word).map(h=>({word:h.pron.word, say_it:h.pron.say_it, issue:''})) : a.pronunciation)}
      ${(a.strengths||[]).length?`<div class="card"><p class="lbl">What worked</p><ul class="clean ok">${a.strengths.map(x=>`<li>✓ ${esc(x)}</li>`).join('')}</ul></div>`:''}
      ${(a.fixes||[]).length?`<div class="card"><p class="lbl">Fix these</p>${a.fixes.map(f=>`<div class="fix"><div class="s">✕ “${esc(f.said)}”</div><div class="b">✓ ${esc(f.better)}</div><small>${esc(f.why)}</small></div>`).join('')}</div>`:''}
      ${a.better_version?`<div class="card"><p class="lbl">Say it better</p><div class="better">${esc(a.better_version)}</div>
        <div class="row" style="justify-content:space-between;margin-top:8px"><button class="spk" id="hearBetter">🔊 Hear it</button>${isRp?'':'<button class="spk" id="tryBetter">🎙 Try saying it this way</button>'}</div></div>`:''}
      <div class="card"><p class="lbl">${isRp?'The conversation':'Exactly what you said'}</p>
        ${isRp? (s.hist||[]).map(h=>`<p style="margin:0 0 8px;font-size:15px"><b style="color:${h.who==='you'?'var(--navy)':'var(--mut)'}">${h.who==='you'?'You':esc(s.scnWho||(C.SCENARIOS[s.scn]?C.SCENARIOS[s.scn].who:'Them'))}:</b> ${h.who==='you'?highlight(h.text).html:esc(h.text)}</p>`).join('') : `<div class="trans">${highlight(s.segments.join(' ')).html}</div>`}</div>
      ${s.hasAudio?`<div class="card"><p class="lbl">Listen back</p><audio id="aud" controls preload="metadata"></audio><button class="link" id="dlAud">⬇ Save audio file</button></div>`:''}
      ${s.note?`<p class="note" style="padding:0 4px 12px">${esc(s.note)}</p>`:''}
      ${resultButtons(s)}
      <button class="link" id="delBtn" style="color:var(--red);margin:14px auto 30px;display:block">Delete this session</button>
    </main>`;
  el.classList.add('on'); el.scrollTop=0;
  const hb=$('#hearBetter'); if(hb) hb.onclick=()=>speak(a.better_version);
  wireSayIt();
  const tb=$('#tryBetter'); if(tb) tb.onclick=()=>{ closeResult(); runTalk({kind:'talk', prompt:s.prompt, targetSec:s.targetSec, maxWords:s.maxWords, structure:s.structure, drill:s.drill, task:'Second attempt. The speaker is trying to say it more like this model version: "'+a.better_version+'"'}); };
  wireDelete(s); wireResultButtons(s); wireAudio(s);
}
function presenceCard(p){
  const rows=[['Eye contact',p.eye_contact],['Expression',p.expression],['Posture',p.posture],['Energy',p.energy]];
  return `<div class="card"><p class="lbl">On camera · body language</p><div class="dims">${rows.map(([n,v])=>{v=Math.max(1,Math.min(10,+v||0));return `<div class="dim"><span>${n}</span><div class="bar"><i style="width:${v*10}%;background:${scoreClass(v)}"></i></div><b>${v}</b></div>`}).join('')}</div>
    ${p.notes?`<p style="margin:10px 0 0;font-size:15px">${esc(p.notes)}</p>`:''}
    ${(p.habits||[]).length?`<div class="chips" style="margin-top:10px">${p.habits.map(h=>`<span class="chip r">${esc(h)}</span>`).join('')}</div>`:''}
    ${p.best?`<p style="margin:10px 0 0;font-size:14px;color:var(--green)">✓ ${esc(p.best)}</p>`:''}</div>`;
}
function grammarCard(list){
  list=(list||[]).filter(g=>g&&g.said&&g.correct);
  if(!list.length) return AI.ready()?`<div class="card"><p class="lbl">Grammar</p><span class="chip g">No grammar mistakes found ✓</span></div>`:'';
  return `<div class="card"><p class="lbl">Grammar fixes</p>${list.map(g=>`<div class="fix"><div class="s">✕ “${esc(g.said)}”</div><div class="b">✓ ${esc(g.correct)}</div>${g.rule?`<small>${esc(g.rule)}</small>`:''}</div>`).join('')}</div>`;
}
function pronCard(list){
  const seen=new Set(); list=(list||[]).filter(p=>p&&p.word&&!seen.has(p.word.toLowerCase())&&seen.add(p.word.toLowerCase()));
  if(!list.length) return '';
  return `<div class="card"><p class="lbl">Pronunciation · tap 🔊 to hear it</p>${list.map(p=>`<div class="fix" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b style="color:var(--navy)">${esc(p.word)}</b> → <span style="font-weight:700;color:var(--green)">${esc(p.say_it||'')}</span>${p.issue?`<small>${esc(p.issue)}</small>`:''}</div><button class="spk" data-say="${esc(p.word)}">🔊</button></div>`).join('')}</div>`;
}
function wireSayIt(){ document.querySelectorAll('#result [data-say]').forEach(b=>b.onclick=async()=>{ await speak(b.dataset.say,{rate:.7}); await sleep(300); speak(b.dataset.say,{rate:1}); }); }
function wireDelete(s){ const d=$('#delBtn'); if(d) d.onclick=async()=>{ if(!confirm('Delete this session?')) return; sessions=sessions.filter(x=>x.id!==s.id); saveSessions(); await delAudio(s.id); await delAudio(s.id+'_v'); closeResult(); }; }
async function openLocalResult(s){
  const m=s.m, el=$('#result');
  const verdict = m.score==null ? 'Not scored yet' : m.score>=85?'Sharp and clear': m.score>=70?'Good, a few slips': m.score>=50?'Getting there':'Too many fillers';
  const over = s.targetSec && s.dur > s.targetSec*1.2;
  const pace = m.wpm>175?'fast': m.wpm<95?'slow':'good';
  const has = s.segments.length;
  const rChips = (m.repeats||[]).map(r=>`<span class="chip r">“${esc(r.text)}” ×${r.n}</span>`).join('') + (m.restarts||[]).map(([w,n])=>`<span class="chip r">“${esc(w)} ${esc(w)}” ×${n}</span>`).join('');
  el.innerHTML = `
    <div class="rhead">${ring(m.score)}<div><h2>${verdict}</h2><p>${esc(s.prompt)}</p></div></div>
    <main>
      ${s.aiError?`<div class="card" style="border:1.5px solid var(--red)"><p class="lbl" style="color:var(--red)">AI coach not used</p><p style="margin:0;font-size:14px">${esc(s.aiError)}</p></div>`:''}
      ${s.hasVideo?`<div class="card"><p class="lbl">Watch yourself</p><video id="vid" controls playsinline preload="metadata" style="width:100%;border-radius:12px;background:#000"></video></div>`:''}
      ${!AI.ready()?`<div class="card aicard"><h3>Want a real coach’s score?</h3><p>This basic check only counts words. Turn on the free AI coach for full scoring and feedback.</p><button class="btn" onclick="closeResult();show('settings')">Turn on AI coach</button></div>`:''}
      <div class="tip"><p class="lbl">Fix this next time</p>${esc(m.tip)}</div>
      <div class="tiles">
        <div class="tile ${m.fillerPerMin>4?'bad':m.fillerPerMin<=1.5?'ok':''}"><span>Fillers</span><b>${has?m.fillerCount:'–'}</b><small>${has?m.fillerPerMin+' per minute':'no text yet'}</small></div>
        <div class="tile ${m.hesitationCount>4?'bad':''}"><span>“Uh” sounds</span><b>${s.hasAudio?m.hesitationCount:'–'}</b><small>${s.hasAudio?'estimate · tap times below':'no voice recording'}</small></div>
        <div class="tile ${(m.repeats||[]).length>1?'bad':''}"><span>Repeats</span><b>${has?(m.repeats||[]).length:'–'}</b><small>${(m.restarts||[]).length?(m.restarts.length)+' restart(s)':'no restarts'}</small></div>
        <div class="tile ${over?'bad':''}"><span>Time · pace</span><b>${fmt(s.dur)}</b><small>${has?m.wpm+' words/min · '+pace:''}</small></div>
      </div>
      ${has?`<div class="card"><p class="lbl">Start · fillers · weak words</p><div class="chips">${m.startFiller||m.startHesitation?`<span class="chip r">Started with “${esc(m.startFiller||'uh')}”</span>`:'<span class="chip g">Clean start ✓</span>'}${wordChips(m)}</div>${rChips?`<p class="lbl" style="margin-top:14px">You repeated</p><div class="chips">${rChips}</div>`:''}</div>`:''}
      ${s.hasAudio?`<div class="card"><p class="lbl">Listen back</p><audio id="aud" controls preload="metadata"></audio>
        ${s.hes.length?`<p class="lbl" style="margin-top:12px">Possible “uh / hmm” moments — tap to hear</p><div class="chips">${s.hes.map(h=>`<span class="chip f t" data-t="${h.t}">${fmt(h.t)}</span>`).join('')}</div>`:''}
        <button class="link" id="dlAud">⬇ Save audio file</button>
        ${s.source!=='live' && !AI.ready()?`<button class="btn" id="whisperBtn" style="margin-top:6px">${has?'Redo text from recording':'Turn into text'}</button><div id="wStatus" class="note" style="padding:8px 0 0"></div>`:''}
        ${AI.ready()?`<button class="btn" id="aiRetry" style="margin-top:6px">Get AI coach feedback</button>`:''}
      </div>`:''}
      ${has?`<div class="card"><p class="lbl">What you said</p><div class="trans">${highlight(s.segments.join(' ')).html}</div></div>`:''}
      ${s.note?`<p class="note" style="padding:0 4px 12px">${esc(s.note)}</p>`:''}
      ${resultButtons(s)}
      <button class="link" id="delBtn" style="color:var(--red);margin:14px auto 30px;display:block">Delete this session</button>
    </main>`;
  el.classList.add('on'); el.scrollTop=0;
  wireDelete(s); wireResultButtons(s); await wireAudio(s);
  const wb=$('#whisperBtn'); if(wb) wb.onclick=()=>transcribe(s);
  const ar=$('#aiRetry'); if(ar) ar.onclick=()=>retryAI(s);
}
async function retryAI(s){
  const blob = await getAudio(s.id); const pcm = await usablePcm(blob);
  if(!pcm){ toast('No usable audio in this recording.'); return; }
  showLoading('Your coach is listening…');
  try{
    s.ai = s.kind==='read' ? await AI.analyseRead(pcm, s.target) : await AI.analyseTalk(pcm, {prompt:s.prompt, structure:s.structure, targetSec:s.targetSec, maxWords:s.maxWords, focus:s.focus, dur:s.dur});
    s.segments = TTP.splitSegments(s.ai.transcript||''); s.source='ai'; s.aiError='';
  }catch(e){ s.aiError = e.user||e.message; }
  computeMetrics(s); saveSessions(); stopLoading(); openResult(s);
}
async function openReadResult(s){
  const m=s.m, el=$('#result'), a=s.ai;
  if(a){
    el.innerHTML = `
      <div class="rhead">${ring(m.score)}<div><h2>${esc(a.headline||'Reading checked')}</h2><p>${esc(s.prompt)}</p></div></div>
      <main>
        <div class="tip"><p class="lbl">Next read</p>${esc(a.tip)}</div>
        <div class="card"><p class="lbl">Your reading</p><div class="dims">
          ${[['Clear words',a.clarity],['Pace & pauses',a.pacing],['Expression',a.expression]].map(([n,v])=>{v=Math.max(1,Math.min(10,+v||0));return `<div class="dim"><span>${n}</span><div class="bar"><i style="width:${v*10}%;background:${scoreClass(v)}"></i></div><b>${v}</b></div>`}).join('')}
        </div><p class="note" style="padding:10px 0 0">Pace: ${esc(a.pace_label||'')} · ${m.wpm} words/min</p></div>
        <div class="card"><p class="lbl">Words to work on</p><div class="chips">${(a.unclear_words||[]).map(u=>`<span class="chip r">${esc(u.word)}</span>`).join('')||'<span class="chip g">All clear ✓</span>'}</div>
          ${(a.unclear_words||[]).length?a.unclear_words.map(u=>`<div class="fix" style="display:flex;align-items:center;gap:10px"><div style="flex:1"><b style="color:var(--navy)">${esc(u.word)}</b>${u.say_it?' → <span style="font-weight:700;color:var(--green)">'+esc(u.say_it)+'</span>':''}<small>${esc(u.note)}</small></div><button class="spk" data-say="${esc(u.word)}">🔊</button></div>`).join(''):''}
          ${(a.skipped_words||[]).length?`<p class="lbl" style="margin-top:12px">Skipped or changed</p><div class="chips">${a.skipped_words.map(w=>`<span class="chip">${esc(w)}</span>`).join('')}</div>`:''}</div>
        <div class="card"><p class="lbl">The text</p>${renderTarget(s.target,[])}<button class="spk" id="hearTarget" style="margin-top:8px">🔊 Hear it read</button></div>
        ${s.hasAudio?`<div class="card"><p class="lbl">Listen back</p><audio id="aud" controls preload="metadata"></audio></div>`:''}
        ${resultButtons(s)}<div style="height:30px"></div>
      </main>`;
    el.classList.add('on'); el.scrollTop=0;
    $('#hearTarget').onclick=()=>speak(s.target.replace(/[\/*]/g,' '), {rate:.9});
    wireSayIt();
    wireResultButtons(s); wireAudio(s); return;
  }
  const verdict = m.score==null?'Not scored': m.clarity>=90?'Very clear': m.clarity>=78?'Mostly clear':'Some words unclear';
  const pace = m.wpm>165?'fast': m.wpm<100?'slow':'steady';
  const na = m.score==null;
  el.innerHTML = `
    <div class="rhead">${ring(m.score)}<div><h2>${verdict}</h2><p>${esc(s.prompt)}</p></div></div>
    <main>
      ${s.aiError?`<div class="card" style="border:1.5px solid var(--red)"><p class="lbl" style="color:var(--red)">AI coach not used</p><p style="margin:0;font-size:14px">${esc(s.aiError)}</p></div>`:''}
      <div class="tip"><p class="lbl">Fix this next time</p>${esc(m.tip)}</div>
      <div class="tiles">
        <div class="tile ${m.clarity>=90?'ok':m.clarity<78?'bad':''}"><span>Clarity</span><b>${na?'–':m.clarity+'%'}</b><small>words the phone understood</small></div>
        <div class="tile ${pace!=='steady'?'bad':'ok'}"><span>Pace</span><b>${na?'–':m.wpm}</b><small>words/min · aim 120–150</small></div>
        <div class="tile ${m.fillerCount?'bad':'ok'}"><span>Fillers</span><b>${na?'–':m.fillerCount}</b><small>should be zero when reading</small></div>
        <div class="tile"><span>Read</span><b>${na?'–':m.coverage+'%'}</b><small>of the text</small></div>
      </div>
      <div class="card"><p class="lbl">Red = the phone didn’t catch it</p>${renderTarget(s.target, m.matched||[])}</div>
      ${s.hasAudio?`<div class="card"><p class="lbl">Listen back</p><audio id="aud" controls preload="metadata"></audio>${AI.ready()?'<button class="btn" id="aiRetry" style="margin-top:8px">Get AI coach feedback</button>':''}</div>`:''}
      ${resultButtons(s)}<div style="height:30px"></div>
    </main>`;
  el.classList.add('on'); el.scrollTop=0;
  wireResultButtons(s); wireAudio(s);
  const ar=$('#aiRetry'); if(ar) ar.onclick=()=>retryAI(s);
}

/* ---------- on-phone transcription fallback (Whisper, no key needed) ---------- */
let whisper=null;
async function transcribe(s){
  const st=$('#wStatus'), btn=$('#whisperBtn'); btn.disabled=true; btn.style.opacity=.6;
  try{
    if(!whisper){
      st.innerHTML='Getting the speech model ready (first time only, about 40 MB)…<div class="prog"><i id="wp"></i></div>';
      const T = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3');
      const files={};
      whisper = await T.pipeline('automatic-speech-recognition','Xenova/whisper-tiny.en',{progress_callback:p=>{
        if(p.status==='progress' && p.total){ files[p.file]=[p.loaded,p.total]; let a=0,b=0; for(const k in files){a+=files[k][0];b+=files[k][1];} const w=document.getElementById('wp'); if(w) w.style.width=Math.round(a/b*100)+'%'; }
      }});
    }
    st.textContent='Turning your voice into text… keep this screen open.';
    const pcm = await decodeTo16k(await getAudio(s.id));
    const out = await whisper(pcm, {chunk_length_s:30, stride_length_s:5});
    const text = (Array.isArray(out)?out.map(o=>o.text).join(' '):out.text||'').replace(/\[.*?\]|\(.*?\)/g,' ').replace(/\s+/g,' ').trim();
    if(!text){ st.textContent='No words found in the recording.'; btn.disabled=false; btn.style.opacity=1; return; }
    s.segments = TTP.splitSegments(text); s.source='whisper';
    s.note = 'Text made on your phone. It may miss “um / uh”. The AI coach catches those.';
    computeMetrics(s); saveSessions(); openResult(s);
  }catch(e){ st.textContent='Could not turn this into text ('+(e.message||e)+').'; btn.disabled=false; btn.style.opacity=1; }
}

/* ---------- voice (text to speech) ---------- */
function voices(){ return (window.speechSynthesis ? speechSynthesis.getVoices() : []).filter(v=>/^en/i.test(v.lang)); }
function speak(text, o={}){
  return new Promise(res=>{
    if(!window.speechSynthesis || !text) return res();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const vs = voices(); const v = vs.find(x=>x.name===settings.voice) || vs.find(x=>/en-(GB|AU)/i.test(x.lang)) || vs[0];
    if(v){ u.voice=v; u.lang=v.lang; }
    let done=false; const fin=()=>{ if(!done){ done=true; clearInterval(poll); res(); } };
    u.rate = o.rate || 1; u.onend=fin; u.onerror=fin;
    speechSynthesis.speak(u);
    let started=false; const poll=setInterval(()=>{ if(speechSynthesis.speaking) started=true; else if(started) fin(); }, 250);
    setTimeout(fin, 4000 + text.length*130/(o.rate||1));
  });
}
function stopSpeak(){ try{ speechSynthesis.cancel(); }catch(e){} }
function fillVoices(){
  const sel=$('#voice'), vs=voices();
  sel.innerHTML = '<option value="">Automatic</option>' + vs.map(v=>`<option value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('');
  sel.value = settings.voice;
}
if(window.speechSynthesis){ speechSynthesis.onvoiceschanged = fillVoices; }

/* ---------- role-play & coach chat (hands-free) ---------- */
let rp=null;
function renderScenarios(){
  const best = gam.best.rp || {}, cc=C.COACH_CHAT;
  $('#scnList').innerHTML = `<div class="scn" data-k="coach" style="border:2px solid var(--green)"><div class="av" style="background:${cc.color};font-size:22px">${cc.av}</div><div><b>${esc(cc.title)}</b><small>Open conversation on any topic. Your coach talks back and gently corrects your grammar and pronunciation.</small></div></div>
    <p class="lbl" style="margin:16px 4px 8px">Work situations</p>`
    + Object.entries(C.SCENARIOS).map(([k,s])=>`<div class="scn" data-k="${k}"><div class="av" style="background:${s.color}">${s.av}</div><div><b>${esc(s.title)}</b><small>${esc(s.setup)}</small></div><div class="best">${best[k]!=null?`<span class="pill ${best[k]>=80?'hi':best[k]<60?'lo':''}">${best[k]}</span>`:''}</div></div>`).join('')
    + `<div class="scn" data-k="custom"><div class="av" style="background:#6A778C">✎</div><div><b>My own scenario</b><small>Describe who you’re speaking to and the situation.</small></div></div>
    <p class="note" style="padding:6px 4px">${settings.handsFree?'Hands-free is on: it listens after it speaks and replies when you stop talking.':'Hands-free is off: tap to answer each time.'} Change it in Settings.</p>`;
  document.querySelectorAll('.scn').forEach(e=>e.onclick=()=>startRoleplay(e.dataset.k));
}
function scenarioFor(key){
  if(key==='coach') return C.COACH_CHAT;
  if(key==='custom'){
    const who = window.prompt('Who are you speaking to? (e.g. "a demanding CFO", "my team")'); if(!who) return null;
    const sit = window.prompt('What is the situation? (e.g. "they want the budget cut by 10%")'); if(!sit) return null;
    return Object.assign({}, C.CUSTOM_SCENARIO, {title:'Custom: '+who, who, setup:sit, opening:'',
      persona:'You are '+who+'. Situation: '+sit+'. Behave realistically: ask questions, push back once if it makes sense, react to how clearly and confidently they speak.'});
  }
  return C.SCENARIOS[key];
}
function startRoleplay(key, ctx){
  if(!AI.ready()){ toast('Conversations need the AI coach. Add your free key in Settings.',4000); show('settings'); return; }
  const scn = scenarioFor(key); if(!scn) return;
  rp = {key, scn, hist:[], turn:0, ctx:ctx||null, state:'idle', done:false, listener:null, alive:true};
  $('#rpAv').textContent=scn.av; $('#rpAv').style.background=scn.color; $('#rpWho').textContent=scn.who; $('#rpSetup').textContent=scn.setup;
  $('#rp').classList.add('on');
  const first = scn.opening || '(Start whenever you are ready.)';
  rp.hist.push({who:'them', text:first});
  if(scn.opening) themSpeaks(first); else { rp.state='idle'; rpRender(); }
}
async function themSpeaks(text){
  const me=rp; if(!me) return;
  me.state='speaking'; rpRender();
  if(settings.speakReplies) await speak(text);
  if(rp!==me || !me.alive) return;
  if(me.done){ me.state='idle'; rpRender(); return; }
  if(settings.handsFree) listenTurn(true); else { me.state='idle'; rpRender(); }
}
function rpRender(){
  if(!rp) return;
  const chat=$('#chat');
  chat.innerHTML = `<div class="bub sys">${esc(rp.scn.setup)}${rp.scn.open?'':' · about '+rp.scn.turns+' replies'}</div>` + rp.hist.map(h=> h.who==='them'
    ? `<div class="bub them">${esc(h.text)}</div>`
    : `<div class="bub you">${h.score?`<span class="tsc">${h.score}/10</span>`:''}${highlight(h.text).html}`
      + (h.gfix&&h.gfix.said?`<span class="note">✏️ “${esc(h.gfix.said)}” → <b style="color:#fff">${esc(h.gfix.correct)}</b></span>`:'')
      + (h.pron&&h.pron.word?`<span class="note">🗣 ${esc(h.pron.word)} → <b style="color:#fff">${esc(h.pron.say_it)}</b> <button class="spk" style="color:#9FC3FF" data-say="${esc(h.pron.word)}">🔊</button></span>`:'')
      + (h.note?`<span class="note">💡 ${esc(h.note)}</span>`:'')+`</div>`).join('')
    + (rp.state==='thinking'?'<div class="bub them"><span class="typing"><i></i><i></i><i></i></span></div>':'');
  chat.scrollTop=1e9;
  chat.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>speak(b.dataset.say,{rate:.7}));
  const bot=$('#rpBot'), canEnd = rp.turn>=2;
  if(rp.state==='listening') bot.innerHTML=`<button class="btn sec" id="rpPause" style="flex:0 0 60px" aria-label="Pause">⏸</button><div style="flex:1;text-align:center"><div class="wave" id="rpWave" style="height:30px"></div><small style="color:var(--mut)" id="rpHint">Listening… talk now</small></div><button class="btn" id="rpDone" style="flex:0 0 96px">Done ✓</button>`;
  else if(rp.state==='thinking') bot.innerHTML='<button class="btn sec" disabled>Thinking…</button>';
  else if(rp.state==='speaking') bot.innerHTML=`<button class="btn sec" id="rpSkip">${settings.handsFree?'⏭ Skip – let me talk':'⏭ Skip voice'}</button>`;
  else if(rp.done) bot.innerHTML='<button class="btn" id="rpScore">See my scorecard</button>';
  else bot.innerHTML=`<button class="btn sec" id="rpReplay" style="flex:0 0 60px">🔊</button><button class="btn" id="rpAnswer">🎙 ${rp.turn?'Answer':'Start talking'}</button>${canEnd?'<button class="btn sec" id="rpEnd" style="flex:0 0 70px">End</button>':''}`;
  const on=(id,f)=>{ const e=$(id); if(e) e.onclick=f; };
  on('#rpAnswer', ()=>listenTurn(settings.handsFree));
  on('#rpReplay', ()=>{ const t=rp.hist.filter(h=>h.who==='them').pop(); if(t) speak(t.text); });
  on('#rpEnd', ()=>{ rp.done=true; rpRender(); });
  on('#rpScore', rpFinish);
  on('#rpSkip', ()=>{ stopSpeak(); });
  on('#rpDone', ()=>{ if(rp.listener) rp.listener.stop(); });
  on('#rpPause', ()=>{ if(rp.listener) rp.listener.cancel(); rp.state='idle'; rpRender(); toast('Paused. Tap Answer when ready.'); });
  if(rp.state==='listening'){ const w=$('#rpWave'); w.innerHTML=''; for(let i=0;i<20;i++) w.appendChild(document.createElement('i')); }
}
// Inline listener with end-of-speech detection
function listen(auto){
  return new Promise(async resolve=>{
    let stream, mr, actx, an, chunks=[], t0=Date.now(), ended=false, spoke=false, voiced=0, lastVoice=0, noise=[], peak=0, timer;
    const finish=(ok)=>{ if(ended) return; ended=true; clearInterval(timer); try{ if(mr && mr.state!=='inactive') mr.stop(); }catch(e){ done(); } if(!ok) cancelled=true; };
    let cancelled=false;
    const done=()=>{ if(stream) stream.getTracks().forEach(t=>t.stop()); try{ actx && actx.close(); }catch(e){}
      try{ if(wakeLock){ wakeLock.release(); wakeLock=null; } }catch(e){}
      if(cancelled) return resolve(null);
      resolve({blob: chunks.length?new Blob(chunks,{type:chunks[0].type||'audio/webm'}):null, dur:(Date.now()-t0)/1000, spoke}); };
    try{
      stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true, autoGainControl:true}});
    }catch(e){ micHelp(e); return resolve(null); }
    try{ if(navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
    const mime = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg'].find(m=>window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
    mr = new MediaRecorder(stream, mime?{mimeType:mime}:undefined);
    mr.ondataavailable=e=>{ if(e.data && e.data.size) chunks.push(e.data); };
    mr.onstop=done;
    mr.start(250);
    try{ actx=new (window.AudioContext||window.webkitAudioContext)(); an=actx.createAnalyser(); an.fftSize=1024; actx.createMediaStreamSource(stream).connect(an); }catch(e){}
    const buf=new Float32Array(1024); let k=0;
    vib(30);
    timer=setInterval(()=>{
      const now=Date.now(), el=now-t0;
      let rms=0;
      if(an){ an.getFloatTimeDomainData(buf); let sum=0; for(let i=0;i<buf.length;i++) sum+=buf[i]*buf[i]; rms=Math.sqrt(sum/buf.length); }
      const bars=document.querySelectorAll('#rpWave i'); if(bars.length){ bars[k%bars.length].style.height=(4+Math.min(26,rms*400))+'px'; k++; }
      noise.push(rms); if(noise.length>600) noise.shift(); if(rms>peak) peak=rms;
      if(el<300) return;
      const sorted = noise.slice().sort((a,b)=>a-b);
      const nf = sorted[Math.floor(sorted.length*0.15)] || 0.004;   // quietest moments = background noise
      const thr = Math.min(Math.max(nf*3.2, 0.012), 0.08);
      if(rms>thr){ voiced+=60; lastVoice=now; if(voiced>350) spoke=true; }
      const hint=$('#rpHint');
      if(auto && spoke){
        const quiet=now-lastVoice;
        if(hint) hint.textContent = quiet>700 ? 'Pause… replying in a moment' : 'Listening…';
        if(quiet>=settings.waitMs) finish(true);
      }
      if(auto && !spoke && el>15000){ if(peak>0.03){ spoke=true; lastVoice=now; } else { finish(false); toast('I didn’t hear anything. Tap Answer when ready.',3000); } }
      if(el>150000) finish(true);
    },60);
    rp.listener={stop:()=>finish(true), cancel:()=>finish(false)};
  });
}
async function listenTurn(auto){
  if(!rp) return;
  stopSpeak();
  const me=rp; me.state='listening'; rpRender();
  const raw = await listen(auto);
  if(rp!==me || !me.alive) return;
  me.listener=null;
  if(!raw){ me.state='idle'; rpRender(); return; }
  const pcm = await usablePcm(raw.blob);
  if(!pcm || !raw.spoke && raw.dur<2){ me.state='idle'; rpRender(); toast('No speech heard. Try again.',3000); return; }
  me.state='thinking'; rpRender();
  try{
    const t = await AI.roleplayTurn(pcm, me.scn, me.hist, me.turn+1);
    if(rp!==me) return;
    me.turn++;
    me.hist.push({who:'you', text:t.heard||'(unclear)', note:t.coach_note, score:t.turn_score, clarity:t.clarity, gfix:t.grammar_fix, pron:t.pron_fix, dur:raw.dur});
    if(t.reply) me.hist.push({who:'them', text:t.reply});
    if(t.end || me.turn>=me.scn.turns+1) me.done=true;
    if(t.reply) themSpeaks(t.reply); else { me.state='idle'; rpRender(); }
  }catch(e){ me.state='idle'; rpRender(); toast(e.user||e.message,5000); }
}
async function rpFinish(){
  stopSpeak();
  const r=rp;
  if(!r.hist.some(h=>h.who==='you')){ closeRp(); return; }
  showLoading('Scoring your conversation…');
  try{
    const f = await AI.roleplayScore(r.scn, r.hist);
    const you = r.hist.filter(h=>h.who==='you');
    const s = {id:'s'+Date.now(), ts:Date.now(), kind:'roleplay', scn:r.key, scnWho:r.scn.who, prompt:(r.key==='coach'?'':'Role-play: ')+r.scn.title, dur:you.reduce((a,h)=>a+(h.dur||0),0),
      segments:you.map(h=>h.text), hist:r.hist, ai:f, hes:[], hasAudio:false, ctx:r.ctx, day:r.ctx?prog.day:0, stepK:r.ctx?'roleplay':'', source:'ai', note:''};
    computeMetrics(s); stopLoading();
    sessions.unshift(s); saveSessions();
    if(s.ctx){ prog.pending=s.id; saveProg(); }
    gam.rpCount=(gam.rpCount||0)+1; gam.best.rp=gam.best.rp||{}; if(r.key!=='custom'&&r.key!=='coach') gam.best.rp[r.key]=Math.max(gam.best.rp[r.key]||0, s.m.score||0); saveGam();
    award('rp1'); if(gam.rpCount>=5) award('rp5'); if(r.key==='ceo' && s.m.score>=80) award('ceo');
    afterSession(s);
    closeRp();
    openResult(s);
  }catch(e){ stopLoading(); $('#result').classList.remove('on'); toast(e.user||e.message,5000); }
}
function closeRp(){ if(rp){ rp.alive=false; if(rp.listener) rp.listener.cancel(); } stopSpeak(); $('#rp').classList.remove('on'); rp=null; }
$('#rpClose').onclick=()=>{ if(rp && rp.hist.some(h=>h.who==='you')){ if(confirm('Get your scorecard before leaving?')){ rp.done=true; if(rp.listener) rp.listener.cancel(); rpFinish(); return; } } closeRp(); };

/* ---------- games ---------- */
const GAMES = {
  fighter:{icon:'🥊', name:'Filler Fighter', desc:'Talk on a topic. One filler or weak word and you’re out. Last 60 seconds to win.'},
  taboo:{icon:'🚫', name:'Taboo Talk', desc:'Explain something without the obvious words, or any fillers. Last 60 seconds.'},
  rapid:{icon:'⚡', name:'Rapid Fire', desc:'5 surprise questions, 20 seconds each. No time to prepare.'},
  squeeze:{icon:'🍋', name:'Squeeze It', desc:'Turn a rambling message into 20 words or fewer. Keep the key facts.'}
};
function renderGames(){
  const b=gam.best;
  const best={fighter:b.fighter!=null?'Best: '+b.fighter+' sec':'', taboo:b.taboo!=null?'Best: '+b.taboo+' sec':'', rapid:b.rapid!=null?'Best: '+b.rapid+'/50':'', squeeze:b.squeeze!=null?'Best: '+b.squeeze+'/10':''};
  $('#gameGrid').innerHTML = Object.entries(GAMES).map(([k,g])=>`<div class="game" data-g="${k}"><div class="gi">${g.icon}</div><b>${g.name}</b><span>${g.desc}</span><div class="pb">${best[k]||'Play'}</div></div>`).join('');
  document.querySelectorAll('.game').forEach(e=>e.onclick=()=>startGame(e.dataset.g));
}
function gameIntro(k, body, onStart, ctx){
  const g=GAMES[k], el=$('#result');
  el.innerHTML = `<div class="rhead"><div class="av" style="background:#fff;color:var(--navy);font-size:26px">${g.icon}</div><div><h2>${g.name}</h2><p>${esc(g.desc)}</p></div></div><main>${body}
    <button class="btn" id="gGo">Start</button><button class="btn sec" id="gBack">${ctx?'Back to Today':'Back'}</button>${ctx?'<button class="skip" id="gSkip">Skip this step</button>':''}<div style="height:30px"></div></main>`;
  el.classList.add('on'); el.scrollTop=0;
  $('#gGo').onclick=()=>{ el.classList.remove('on'); onStart(); };
  $('#gBack').onclick=()=>{ el.classList.remove('on'); if(ctx) show('today'); };
  const sk=$('#gSkip'); if(sk) sk.onclick=()=>{ prog.done[ctx.step]=true; saveProg(); el.classList.remove('on'); runNext(); };
}
function startGame(k, ctx){
  if(k==='fighter') return playSurvival('fighter', ctx);
  if(k==='taboo') return playSurvival('taboo', ctx);
  if(k==='rapid') return playRapid(ctx);
  if(k==='squeeze') return playSqueeze(ctx);
}
function saveGame(s, ctx){
  s.ctx=ctx||null; s.day=ctx?prog.day:0; s.stepK=ctx?'game':'';
  sessions.unshift(s); saveSessions();
  if(ctx){ prog.pending=s.id; saveProg(); }
  afterSession(s);
}
function playSurvival(k, ctx){
  if(!SR){ toast('This game needs Chrome with internet for live listening.',4000); return; }
  const isTaboo = k==='taboo';
  const card = isTaboo ? pick(C.TABOO) : null;
  const topic = isTaboo ? card.topic : pick(C.FIGHTER_TOPICS);
  const fl = wordList(settings.fillers), so = wordList(settings.softeners);
  const body = `<div class="card"><p class="lbl">${isTaboo?'Explain this':'Your topic'}</p><div class="prompt">${esc(topic)}</div>
    ${isTaboo?`<p class="lbl" style="margin-top:12px">Don’t say</p><div class="banned" style="justify-content:flex-start">${card.banned.map(w=>`<span>${esc(w)}</span>`).join('')}</div>`:''}
    <p class="lbl" style="margin-top:12px">Also out: any filler or weak word</p><div class="chips">${fl.slice(0,10).concat(so.slice(0,4)).map(w=>`<span class="chip f">${esc(w)}</span>`).join('')}</div></div>
    <div class="tip"><p class="lbl">Rules</p>Keep talking. Going quiet for 6 seconds also ends the round. ${isTaboo?'Reach 60 seconds to win.':'Last 60 seconds to win. Keep going for a record.'}</div>`;
  gameIntro(k, body, async ()=>{
    await countdown(topic, 3);
    const raw = await record({prompt:topic, live:true, audio:false, game:{title:GAMES[k].name, fillers:fl, softeners:so, banned:isTaboo?card.banned:[], show:isTaboo?card.banned:null, limit:isTaboo?60:120}});
    if(!raw) return;
    const secs = Math.floor(raw.fail ? raw.fail.at : raw.dur);
    const win = !raw.fail;
    gam.best[k] = Math.max(gam.best[k]||0, secs); saveGam();
    if(k==='fighter' && secs>=60) award('fighter60');
    if(isTaboo && win) award('taboo');
    const s = {id:'s'+Date.now(), ts:Date.now(), kind:'game', game:k, gameName:GAMES[k].name, prompt:GAMES[k].name+': '+topic, dur:raw.dur, segments:raw.segments, hes:[], hasAudio:false,
      gs:{secs, win, fail:raw.fail, banned:isTaboo?card.banned:null}, m:{score:null}, xp:Math.min(30, 5+secs/3), source:'live'};
    saveGame(s, ctx);
    openResult(s);
  }, ctx);
}
async function playRapid(ctx){
  const qs = pickN(C.RAPID, 5), ai=AI.ready();
  if(!ai && !SR){ toast('Rapid Fire needs the AI coach or Chrome live listening.',4000); return; }
  const body = `<div class="card"><p class="lbl">How it works</p><ol class="steps2"><li>A question appears with a 3-second countdown.</li><li>Answer for up to 20 seconds. It stops by itself.</li><li>5 questions in a row. Then your coach scores all of them.</li></ol></div>
    <div class="tip"><p class="lbl">Frames that help</p>“Two things…” · “Short answer: …” · “Past, present, future.”</div>`;
  gameIntro('rapid', body, async ()=>{
    const items=[];
    for(let i=0;i<qs.length;i++){
      await countdown('Question '+(i+1)+' of 5\n\n'+qs[i], 3);
      const raw = await record({prompt:qs[i], targetSec:20, autoStopSec:20, audio:true, live:!ai || settings.liveCaptions});
      if(!raw){ toast('Rapid Fire stopped.'); return; }
      items.push({q:qs[i], raw});
    }
    showLoading('Scoring your 5 answers…');
    let answers=[], headline='', tip='';
    if(ai){
      try{
        const withPcm=[]; for(const it of items){ const pcm=await usablePcm(it.raw.blob); if(pcm) withPcm.push({q:it.q, pcm}); }
        if(withPcm.length<items.length) throw Object.assign(new Error('silent'),{user:'Some answers had no sound.'});
        const r = await AI.rapidScore(withPcm); answers=r.answers||[]; headline=r.headline; tip=r.tip;
      }catch(e){ toast(e.user||e.message,5000); }
    }
    if(!answers.length){
      answers = items.map(it=>{ const m=TTP.analyse({segments:it.raw.segments, durationSec:it.raw.dur, fillers:wordList(settings.fillers), softeners:wordList(settings.softeners)});
        return {transcript:it.raw.segments.join(' '), score: m.score==null?1:Math.max(1,Math.round(m.score/10)), note:m.tip}; });
      headline='Basic scoring (no AI)'; tip=answers.slice().sort((a,b)=>a.score-b.score)[0].note;
    }
    stopLoading();
    const total = answers.reduce((a,x)=>a+Math.max(0,Math.min(10,+x.score||0)),0);
    gam.best.rapid=Math.max(gam.best.rapid||0,total); saveGam(); if(total>=40) award('rapid40');
    const s = {id:'s'+Date.now(), ts:Date.now(), kind:'game', game:'rapid', gameName:'Rapid Fire', prompt:'Rapid Fire', dur:items.reduce((a,i)=>a+i.raw.dur,0),
      segments:answers.map(a=>a.transcript||''), hes:[], hasAudio:false, gs:{total, qs:items.map(i=>i.q), answers, headline, tip}, m:{score:null}, xp:5+total/2};
    saveGame(s, ctx); openResult(s);
  }, ctx);
}
async function playSqueeze(ctx){
  const item = pick(C.SQUEEZE), ai=AI.ready();
  if(!ai && !SR){ toast('Squeeze It needs the AI coach or Chrome live listening.',4000); return; }
  const body = `<div class="card"><p class="lbl">Someone said this</p><div class="ramble">${esc(item.ramble)}</div></div>
    <div class="tip"><p class="lbl">Your job</p>Say the same message in <b>20 words or fewer</b>. Point first. No fillers. You can see the text while you speak.</div>`;
  gameIntro('squeeze', body, async ()=>{
    const raw = await record({prompt:'Squeeze it: 20 words max', showText:item.ramble, targetSec:15, audio:true, live:!ai || settings.liveCaptions});
    if(!raw) return;
    showLoading('Checking your squeeze…');
    let r=null;
    if(ai){ const pcm=await usablePcm(raw.blob); if(pcm){ try{ r = await AI.squeezeScore(pcm, item, raw.dur); }catch(e){ toast(e.user||e.message,5000); } } else toast('No sound recorded.'); }
    if(!r){
      const m=TTP.analyse({segments:raw.segments, durationSec:raw.dur, fillers:wordList(settings.fillers), softeners:wordList(settings.softeners)});
      const sc = m.words===0?1: Math.max(1, Math.min(10, 10 - Math.max(0,m.words-20)/3 - m.fillerCount*2));
      r = {transcript:raw.segments.join(' '), kept:[], missed:[], score:Math.round(sc), note:'Basic scoring: word count and fillers only. Turn on the AI coach to check the facts.', model_answer:''};
    }
    stopLoading();
    const words = TTP.markText(r.transcript||'').toks.length;
    gam.best.squeeze=Math.max(gam.best.squeeze||0, +r.score||0); saveGam(); if(r.score>=9) award('squeeze');
    const s = {id:'s'+Date.now(), ts:Date.now(), kind:'game', game:'squeeze', gameName:'Squeeze It', prompt:'Squeeze It', dur:raw.dur, segments:[r.transcript||''], hes:[], hasAudio:false,
      gs:{r, item, words}, m:{score:null}, xp:5+(+r.score||0)*2};
    saveGame(s, ctx); openResult(s);
  }, ctx);
}
function openGameResult(s){
  const el=$('#result'), g=s.gs, G=GAMES[s.game];
  let head='', body='';
  if(s.game==='fighter'||s.game==='taboo'){
    const best=gam.best[s.game];
    head = g.win ? (s.game==='taboo'?'You won! 60 seconds clean':'Unbeatable! 2 minutes clean') : (g.fail.word==='(silence)'?'Went quiet at '+g.secs+' sec':'Out at '+g.secs+' sec: “'+g.fail.word+'”');
    body = `<div class="tiles"><div class="tile ${g.win||g.secs>=60?'ok':''}"><span>Survived</span><b>${g.secs} sec</b><small>${g.secs>=best?'new personal best!':'best: '+best+' sec'}</small></div>
      <div class="tile"><span>Words</span><b>${TTP.markText(s.segments.join(' ')).toks.length}</b><small>before the end</small></div></div>
      <div class="tip"><p class="lbl">Tip</p>${g.fail&&g.fail.word==='(silence)'?'Silence is fine in real talks, but keep going here. Use a frame: “Two things…”':'When you feel “'+esc(g.fail?g.fail.word:'so')+'” coming, close your mouth and pause instead.'}</div>
      <div class="card"><p class="lbl">What you said</p><div class="trans">${highlight(s.segments.join(' ')).html||'<span class="ph">Nothing heard</span>'}</div></div>`;
  } else if(s.game==='rapid'){
    head = g.headline || (g.total+' / 50');
    body = `<div class="tiles"><div class="tile ${g.total>=40?'ok':g.total<25?'bad':''}"><span>Total</span><b>${g.total}/50</b><small>best: ${gam.best.rapid}/50</small></div><div class="tile"><span>Best answer</span><b>${Math.max(...g.answers.map(a=>+a.score||0))}/10</b><small>of 5 questions</small></div></div>
      ${g.tip?`<div class="tip"><p class="lbl">Tip</p>${esc(g.tip)}</div>`:''}
      ${g.answers.map((a,i)=>`<div class="card"><div class="row" style="justify-content:space-between"><p class="lbl" style="margin:0">Q${i+1}. ${esc(g.qs[i])}</p><span class="pill ${a.score>=8?'hi':a.score<5?'lo':''}">${a.score}</span></div><div class="trans" style="margin-top:8px;font-size:15px">${highlight(a.transcript||'').html}</div><p class="note" style="padding:6px 0 0">${esc(a.note||'')}</p></div>`).join('')}`;
  } else {
    const r=g.r;
    head = (r.score>=9?'Perfect squeeze!':r.score>=7?'Nice and tight':'Too much juice left')+' · '+r.score+'/10';
    body = `<div class="tiles"><div class="tile ${g.words<=20?'ok':'bad'}"><span>Words</span><b>${g.words}</b><small>target: 20 or fewer</small></div><div class="tile"><span>Score</span><b>${r.score}/10</b><small>best: ${gam.best.squeeze}/10</small></div></div>
      <div class="tip"><p class="lbl">Coach</p>${esc(r.note)}</div>
      <div class="card"><p class="lbl">You said</p><div class="trans">${highlight(r.transcript||'').html}</div>
        ${(r.kept||[]).length?`<p class="lbl" style="margin-top:12px">Kept</p><ul class="clean">${r.kept.map(x=>`<li>✓ ${esc(x)}</li>`).join('')}</ul>`:''}
        ${(r.missed||[]).length?`<p class="lbl" style="margin-top:12px">Missed</p><ul class="clean">${r.missed.map(x=>`<li style="color:var(--red)">✕ ${esc(x)}</li>`).join('')}</ul>`:''}</div>
      ${r.model_answer?`<div class="card"><p class="lbl">Model answer</p><div class="better">${esc(r.model_answer)}</div><button class="spk" id="hearModel" style="margin-top:8px">🔊 Hear it</button></div>`:''}`;
  }
  el.innerHTML = `<div class="rhead"><div class="av" style="background:#fff;color:var(--navy);font-size:26px">${G.icon}</div><div><h2>${esc(head)}</h2><p>${esc(G.name)}</p></div></div><main>${body}${resultButtons(s)}<div style="height:30px"></div></main>`;
  el.classList.add('on'); el.scrollTop=0;
  const hm=$('#hearModel'); if(hm) hm.onclick=()=>speak(g.r.model_answer);
  wireResultButtons(s);
}

/* ---------- practise tab ---------- */
let drill = 'update', prompt = '', starter = '';
function renderDrills(){
  $('#drills').innerHTML = Object.entries(DRILLS).map(([k,d])=>`<button data-d="${k}" class="${k===drill?'on':''}">${d.name}<small>${d.sub}</small></button>`).join('');
  $('#drills').querySelectorAll('button').forEach(b=>b.onclick=()=>{drill=b.dataset.d; newPrompt(); renderDrills();});
}
function newPrompt(own){
  const d = DRILLS[drill];
  prompt = own || pick(d.prompts.filter(x=>x!==prompt)) || d.prompts[0]; starter = pick(d.starters);
  $('#drillLbl').textContent = d.lbl + (d.sec ? ' · '+d.sec+' seconds' : '');
  $('#promptTxt').textContent = prompt;
  $('#structure').innerHTML = d.structure.map(s=>`<span class="chip">${esc(s)}</span>`).join('');
  $('#starter').innerHTML = 'Start with: <b>“'+esc(starter)+'”</b>';
}
$('#newPrompt').onclick=()=>newPrompt();
$('#ownPrompt').onclick=()=>{ const t = window.prompt('What do you want to talk about?'); if(t && t.trim()) newPrompt(t.trim()); };
$('#startPractise').onclick=()=>{ const d=DRILLS[drill]; runTalk({kind:'talk', drill, prompt, targetSec:d.sec, maxWords:d.maxWords||0, structure:d.structure, camera:$('#pCam').dataset.on==='1'}); };
(()=>{ const t=$('#pCam'); const d0=settings.camera && AI.ready(); t.dataset.on=d0?1:0; t.querySelector('b').textContent=d0?'On':'Off'; t.onclick=()=>{ const on=t.dataset.on!=='1'; t.dataset.on=on?1:0; t.querySelector('b').textContent=on?'On':'Off'; }; })();
let walkTopic='';
$('#walkTopics').innerHTML = C.WALK_TOPICS.map(t=>`<span class="chip t">${esc(t)}</span>`).join('');
$('#walkTopics').querySelectorAll('.chip').forEach(c=>c.onclick=()=>{ walkTopic = walkTopic===c.textContent?'':c.textContent; $('#walkTopics').querySelectorAll('.chip').forEach(x=>x.classList.toggle('g', x.textContent===walkTopic)); });
$('#startWalk').onclick=()=>runTalk({kind:'talk', mode:'walk', drill:'walk', prompt: walkTopic || 'Walk & talk', targetSec:0, task:'Free talk recorded while walking. Judge it as natural spoken speech.'});

/* ---------- Phase 1: 28-day programme ---------- */
let prog = Object.assign({day:1, done:{}, reps:{}, results:[], pending:null, completed:{}}, LS.get('ttp.p1',{}));
const saveProg = () => LS.set('ttp.p1', prog);
const STEP_INFO = {bites:['Lesson','Swipe through 3 quick cards','💡'], warm:['Warm-up','Read 2 lines clearly','🗣'], drill:['Practice','Short timed answers','⏱'], read:['Read aloud','Passage with pauses','📖'],
  bench:['Check-in','Recorded to compare later','★'], wrap:['Wrap-up','Your score for today','✓'], game:['Game','','🎮'], roleplay:['Role-play','','🎭'], camera:['Camera round','See yourself, get body-language feedback','📷'], talk:['Talk','','🚶']};
function plan(){ return PROGRAMME.day(Math.min(prog.day, PROGRAMME.days)); }
function nextStepIndex(p){ return p.steps.findIndex((st,i)=>!prog.done[i]); }
function renderToday(){
  renderLevel();
  $('#aiNudge').innerHTML = AI.ready() ? '' : `<div class="card aicard"><h3>Turn on your AI coach (free)</h3><p>Exact transcript with every “uh”, “so” and “maybe”, a real score, camera feedback on your face and body language, and role-plays. Takes 2 minutes.</p><button class="btn" onclick="show('settings')">Set it up</button></div>`;
  const box=$('#todayBox');
  const doneDays = Object.keys(prog.completed).length;
  if(prog.day > PROGRAMME.days){
    box.innerHTML = `<div class="hero"><p class="lbl">Phase 1 complete 🎓</p><h2>${esc(PROGRAMME.phaseName)}: done</h2><p>28 days finished. Your certificate is ready.</p></div>
      <button class="btn" id="certBtn">View my certificate</button>
      <div class="card" style="margin-top:14px;opacity:.85"><p class="lbl">Phase 2 · coming next</p><p style="margin:0;font-size:15px">Deeper practice: presentations, difficult conversations and leadership voice. Keep your streak with role-plays and games meanwhile.</p></div>
      <button class="btn sec" id="restartProg">Repeat Phase 1</button>`;
    $('#certBtn').onclick=showCertificate;
    $('#restartProg').onclick=()=>{ if(confirm('Repeat Phase 1 from Day 1? Your old sessions stay saved.')){ prog={day:1,done:{},reps:{},results:[],pending:null,completed:{}}; saveProg(); renderToday(); } };
    return;
  }
  const p=plan(), w=p.week, ni=nextStepIndex(p);
  const mins = p.steps.reduce((a,s)=>a+s.min,0);
  const weekDays = [...Array(7)].map((_,i)=>{ const d=(w.n-1)*7+i+1; const c=prog.completed[d]; return `<div class="wd ${c?'done':d===p.day?'now':''}"><b>${d}</b><span>${c&&c.score!=null?c.score:PROGRAMME.all[d-1].icon}</span></div>`; }).join('');
  box.innerHTML = `
    <div class="hero"><p class="lbl">Phase 1 · Week ${w.n}: ${esc(w.title)}</p>
      <h2><span style="font-size:26px">${p.info.icon}</span> Day ${p.day}: ${esc(p.title)}</h2><p>${esc(p.info.bites[1])}</p>
      <div class="prog"><i style="width:${Math.round(doneDays/28*100)}%"></i></div><small>${doneDays} of 28 days · about ${mins} min today${p.checkin?' · ★ check-in day':''}</small></div>
    <div class="weekstrip">${weekDays}</div>
    <div class="card steps">${p.steps.map((st,i)=>{
      const inf=STEP_INFO[st.k]; const dn=!!prog.done[i];
      let title=inf[0], sub=inf[1];
      if(st.k==='drill') sub=(prog.reps[i]||0)+' of '+st.reps+' done';
      if(st.k==='bench') sub=st.prompt;
      if(st.k==='game'){ title=GAMES[st.game].name; sub=GAMES[st.game].desc; }
      if(st.k==='roleplay'){ const sc=st.scn==='coach'?C.COACH_CHAT:C.SCENARIOS[st.scn]; title='Role-play: '+sc.title; sub=AI.ready()?sc.setup:'Needs the AI coach · otherwise a camera round'; }
      if(st.k==='camera') sub=st.prompt;
      return `<div class="st ${dn?'done':i===ni?'next':''}"><div class="ic">${dn?'✓':inf[2]}</div><div><b>${esc(title)}</b><small>${esc(sub)}</small></div><span class="min">${st.min} min</span></div>`; }).join('')}</div>
    <button class="btn" id="goBtn">${ni<=0 && !Object.keys(prog.done).length ? 'Start Day '+p.day : 'Continue'}</button>
    <div class="card" style="margin-top:14px;opacity:.8"><p class="lbl">🔒 Phase 2</p><p style="margin:0;font-size:14px">Unlocks after Day 28.</p></div>`;
  $('#goBtn').onclick=runNext;
}
function runNext(){ const p=plan(); const i=nextStepIndex(p); if(i<0){ show('today'); return; } runStep(i); }
function prepScreen(title, body, startLabel, onStart, onSkip){
  const el=$('#result');
  el.innerHTML = `<div class="rhead"><div><h2>${esc(title)}</h2><p>Day ${plan().day} · ${esc(plan().title)}</p></div></div><main>${body}
    <button class="btn" id="prepGo">${startLabel}</button><button class="btn sec" id="prepBack">Back to Today</button>${onSkip?'<button class="skip" id="prepSkip">Skip this step</button>':''}<div style="height:30px"></div></main>`;
  el.classList.add('on'); el.scrollTop=0;
  $('#prepGo').onclick=()=>{ el.classList.remove('on'); onStart(); };
  $('#prepBack').onclick=()=>{ el.classList.remove('on'); show('today'); };
  if(onSkip) $('#prepSkip').onclick=()=>{ onSkip(); el.classList.remove('on'); runNext(); };
}
function camToggle(def){ return `<div class="camtog" id="camTog" data-on="${def?1:0}"><span>📷 Camera</span><b>${def?'On':'Off'}</b></div>`; }
function wireCamToggle(){ const t=$('#camTog'); if(!t) return; t.onclick=()=>{ const on=t.dataset.on!=='1'; t.dataset.on=on?1:0; t.querySelector('b').textContent=on?'On':'Off'; }; }
const camOn = () => { const t=$('#camTog'); return t ? t.dataset.on==='1' : false; };
/* story-style lesson cards */
function showBites(i){
  const p=plan(), x=p.info;
  const cards=[
    {h:'Day '+p.day, big:x.icon+' '+x.t, txt:x.bites[0]},
    {h:'The move', big:'', txt:x.bites[1]},
    {h:'Remember', big:'', txt:x.bites[2]},
    {h:'Hear the difference', ex:true},
    {h:'Say it out loud', say:x.say}
  ];
  let k=0; const el=$('#bites');
  const draw=()=>{
    const c=cards[k];
    el.innerHTML = `<div class="bars">${cards.map((_,j)=>`<i class="${j<k?'f':j===k?'a':''}"></i>`).join('')}</div>
      <button class="bx" id="biteX">✕</button>
      <div class="bcard"><p class="bh">${esc(c.h)}</p>
      ${c.big?`<div class="bbig">${esc(c.big)}</div>`:''}
      ${c.txt?`<div class="btxt">${esc(c.txt)}</div>`:''}
      ${c.ex?`<div class="bex no">✕ ${esc(x.no)}</div><div class="bex yes">✓ ${esc(x.yes)}</div><button class="bspk" id="biteHear">🔊 Hear the good version</button>`:''}
      ${c.say?`<div class="bsay">“${esc(c.say)}”</div><button class="bspk" id="biteHear2">🔊 Hear it</button><p class="btxt" style="font-size:16px;opacity:.75">Say it out loud 3 times: slow, clear, with a small smile.</p>`:''}
      </div>
      <div class="bnav"><button class="bprev" id="bPrev">‹</button><button class="bnext" id="bNext">${k===cards.length-1?'Start practice →':'Next ›'}</button></div>`;
    $('#biteX').onclick=()=>{ stopSpeak(); el.classList.remove('on'); show('today'); };
    $('#bPrev').onclick=()=>{ if(k>0){k--;draw();} };
    $('#bNext').onclick=()=>{ if(k<cards.length-1){k++;draw();} else { stopSpeak(); el.classList.remove('on'); prog.done[i]=true; saveProg(); runNext(); } };
    const h=$('#biteHear'); if(h) h.onclick=()=>speak(x.yes.replace(/[()]/g,' '));
    const h2=$('#biteHear2'); if(h2) h2.onclick=()=>speak(x.say);
  };
  el.classList.add('on'); draw();
}
function runStep(i){
  const p=plan(), st=p.steps[i], x=p.info;
  const skip=()=>{ prog.done[i]=true; saveProg(); };
  const ctx={step:i};
  const focus = p.title+': '+x.bites[1];
  if(st.k==='bites') return showBites(i);
  if(st.k==='wrap') return showWrap(i);
  if(st.k==='game'){ let g=st.game; if(!SR && (g==='fighter'||g==='taboo')) g='squeeze'; if(SR || AI.ready()) return startGame(g, ctx); }
  if(st.k==='roleplay' && AI.ready()){
    const sc = st.scn==='coach' ? C.COACH_CHAT : C.SCENARIOS[st.scn];
    return prepScreen('Role-play: '+sc.title, `<div class="card"><div class="row"><div class="av" style="background:${sc.color}">${sc.av}</div><div><b style="color:var(--navy)">${esc(sc.who)}</b><div style="font-size:14px;color:var(--mut)">${esc(sc.setup)}</div></div></div></div>
      <div class="tip"><p class="lbl">Use today’s skill</p>${esc(x.bites[1])}</div><p class="note" style="padding:0 4px 12px">They speak first. Hands-free: answer out loud, it replies when you stop. Scorecard at the end.</p>`,
      'Start conversation', ()=>startRoleplay(st.scn, ctx), skip);
  }
  if(st.k==='warm' || st.k==='read'){
    const isWarm=st.k==='warm', text = isWarm ? st.lines.join(' / ') : st.text;
    prepScreen(isWarm?'Warm-up · read aloud':'Read the passage · check-in',
      `<div class="card"><p class="lbl">${isWarm?'Read these lines clearly':'Read slowly. Pause at each │.'}</p>${renderTarget(text,[])}<button class="spk" id="hearIt" style="margin-top:8px">🔊 Hear it first</button></div>
       <div class="tip"><p class="lbl">How</p>Open your mouth a little more than usual. Finish the last sound of every word.</div>`,
      'Start reading', ()=>runTalk({kind:'read', target:text, prompt:isWarm?'Warm-up lines':'Read-aloud passage', targetSec:0, bench:st.bench||'', ctx, stepK:st.k}), skip);
    $('#hearIt').onclick=()=>speak(text.replace(/[\/*]/g,' '),{rate:.9});
    return;
  }
  let q;
  if(st.k==='drill'){ const r=prog.reps[i]||0; const pr=st.prompts[r % st.prompts.length]; ctx.rep=r;
    q={label:'Practice '+(r+1)+' of '+st.reps, prompt:pr.p, sec:pr.sec, maxWords:pr.maxWords||0, structure:pr.s||[], hidden:!!pr.hidden, cam: pr.cam!=null ? (pr.cam && settings.camera) : settings.camera, task:'Practice drill'}; }
  else if(st.k==='bench'){ q={label:'Check-in · '+(st.bench==='intro'?'introduction':'update'), prompt:st.prompt, sec:st.sec, structure:st.structure, cam:true, task:'Benchmark recording for progress tracking'}; }
  else if(st.k==='camera' || st.k==='roleplay' || st.k==='game'){ q={label:'Camera round', prompt:st.prompt || ('On camera: '+x.say+' Then talk for 45 seconds about how you would use today’s skill at work.'), sec:st.sec||45, structure:['Look at the lens','Point first','Smile'], cam:true, task:'Camera round: judge both words and visible presence'}; }
  if(!AI.ready() && (st.k==='drill' || st.k==='bench')) q.cam=false;   // basic mode counts words live, which can't share the mic with the camera
  const body = `<div class="card"><p class="lbl">${q.sec?q.sec+' seconds':''}${q.maxWords?' · '+q.maxWords+' words max':''}</p>
    <div class="prompt">${q.hidden?'The question is hidden. It appears when you tap Start.':esc(q.prompt)}</div>
    <div class="chips">${q.structure.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div>
    <div class="starter">Today’s line: <b>“${esc(x.say)}”</b></div></div>
    ${camToggle(q.cam)}
    <div class="tip"><p class="lbl">Today’s skill</p>${esc(x.bites[1])}</div>
    ${st.k==='bench'?'<p class="note" style="padding:0 4px 12px">Speak naturally. This is saved so you can compare Day 1, Day 14 and Day 28.</p>':''}`;
  prepScreen(q.label, body, 'Start', async ()=>{ const cam=camOn(); if(q.hidden) await countdown(q.prompt,3);
    runTalk({kind:'talk', drill:'prog', prompt:q.prompt, targetSec:q.sec, maxWords:q.maxWords, hidden:q.hidden, structure:q.structure, focus, skillTitle:p.title, task:q.task, bench:st.bench||'', camera:cam, ctx, stepK:st.k}); }, st.k==='bench'?null:skip);
  wireCamToggle();
}
function commitStep(s){
  const p=plan(), i=s.ctx.step, st=p.steps[i];
  if(!prog.results.includes(s.id)) prog.results.push(s.id);
  if(st && st.k==='drill'){ prog.reps[i]=(prog.reps[i]||0)+1; if(prog.reps[i]>=st.reps) prog.done[i]=true; }
  else prog.done[i]=true;
  prog.pending=null; saveProg();
}
function daySummary(ids){
  const ss = ids.map(id=>sessions.find(x=>x.id===id)).filter(Boolean);
  const talks = ss.filter(s=>(s.kind==='talk'||s.kind==='roleplay') && s.m && s.m.score!=null), reads = ss.filter(s=>s.kind==='read' && s.m && s.m.score!=null);
  const avg = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : null;
  const avg1 = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length*10)/10 : null;
  const totF = talks.reduce((a,s)=>a+s.m.fillerCount+s.m.softenerCount,0), totMin = talks.reduce((a,s)=>a+s.dur,0)/60;
  const tf={}; talks.forEach(s=>s.m.fillers.concat(s.m.softeners).forEach(([w,n])=>tf[w]=(tf[w]||0)+n));
  const top = Object.entries(tf).sort((a,b)=>b[1]-a[1])[0];
  const tips = talks.map(s=>s.ai&&s.ai.next_step).filter(Boolean);
  return {score:avg(talks.map(s=>s.m.score)), clarity:avg(reads.map(s=>s.m.score)), fpm: totMin? +(totF/Math.max(totMin,.25)).toFixed(1) : null,
    skill:avg1(talks.map(s=>s.m.skill).filter(x=>x)), presence:avg1(talks.map(s=>s.m.presence).filter(x=>x)), top: top?top[0]:null, n:ss.length, tip: tips[tips.length-1]||''};
}
function showWrap(i){
  const p=plan(), sum=daySummary(prog.results), el=$('#result');
  const prev = prog.completed[p.day-1];
  const line = sum.tip || (sum.top ? 'Your main filler today was “'+sum.top+'”. Tomorrow, pause instead of saying it.' : 'Keep sentences short and land your endings.');
  el.innerHTML = `<div class="rhead">${ring(sum.score)}<div><h2>Day ${p.day} complete ${p.info.icon}</h2><p>${esc(p.title)}</p></div></div><main>
    <div class="tiles">
      <div class="tile"><span>Talk score</span><b>${sum.score??'–'}</b><small>${prev&&prev.score!=null&&sum.score!=null?(sum.score>=prev.score?'▲ ':'▼ ')+Math.abs(sum.score-prev.score)+' vs last day':'average of today'}</small></div>
      <div class="tile ${sum.skill>=8?'ok':''}"><span>Today’s skill</span><b>${sum.skill??'–'}</b><small>applied, out of 10</small></div>
      <div class="tile ${sum.fpm>4?'bad':sum.fpm!=null&&sum.fpm<=2?'ok':''}"><span>Fillers / min</span><b>${sum.fpm??'–'}</b><small>incl. weak words · target ≤ 2</small></div>
      <div class="tile ${sum.presence>=8?'ok':''}"><span>On camera</span><b>${sum.presence??'–'}</b><small>presence, out of 10</small></div>
    </div>
    <div class="tip"><p class="lbl">Tomorrow</p>${esc(line)}</div>
    <button class="btn" id="finishDay">Finish Day ${p.day} <span class="xpchip">+30 XP</span></button><div style="height:30px"></div></main>`;
  el.classList.add('on'); el.scrollTop=0;
  $('#finishDay').onclick=()=>{
    prog.completed[p.day]={ts:Date.now(), score:sum.score, fpm:sum.fpm, clarity:sum.clarity, skill:sum.skill, presence:sum.presence, ids:prog.results.slice()};
    const d=p.day; prog.day++; prog.done={}; prog.reps={}; prog.results=[]; prog.pending=null; saveProg();
    el.classList.remove('on'); addXP(30,'Day '+d+' complete');
    if(d===7) award('week1'); if(d===14) award('half');
    if(d===28){ award('grad'); setTimeout(showCertificate, 600); }
    show('today');
  };
}
/* ---------- certificate ---------- */
async function showCertificate(){
  if(!settings.name){ const n=window.prompt('Your name for the certificate:'); if(!n) return; settings.name=n.trim(); saveSettings(); const ni=$('#nameIn'); if(ni) ni.value=settings.name; }
  const c=prog.completed, first=c[1]||{}, last=c[28]||c[Math.max(...Object.keys(c).map(Number).concat([1]))]||{};
  const cv=document.createElement('canvas'); cv.width=1600; cv.height=1130; const g=cv.getContext('2d');
  g.fillStyle='#F7F5EF'; g.fillRect(0,0,1600,1130);
  g.strokeStyle='#13203A'; g.lineWidth=18; g.strokeRect(40,40,1520,1050);
  g.strokeStyle='#C9A54E'; g.lineWidth=3; g.strokeRect(72,72,1456,986);
  try{ const im=new Image(); im.src='icon-512.png'; await im.decode(); g.save(); g.beginPath(); g.arc(800,190,70,0,Math.PI*2); g.clip(); g.drawImage(im,730,120,140,140); g.restore(); }catch(e){}
  g.textAlign='center'; g.fillStyle='#13203A';
  g.font='600 30px Georgia, serif'; g.fillText('S A Y   S H A R P', 800, 310);
  g.font='700 72px Georgia, serif'; g.fillText('Certificate of Completion', 800, 410);
  g.fillStyle='#6A778C'; g.font='italic 32px Georgia, serif'; g.fillText('This certifies that', 800, 490);
  g.fillStyle='#13203A'; g.font='700 84px Georgia, serif'; g.fillText(settings.name||'Speaker', 800, 600);
  g.strokeStyle='#C9A54E'; g.lineWidth=2; g.beginPath(); g.moveTo(450,630); g.lineTo(1150,630); g.stroke();
  g.fillStyle='#3A475C'; g.font='34px Georgia, serif'; g.fillText('has completed Phase 1: Speak Sharp in 28 Days', 800, 700);
  g.font='28px Georgia, serif';
  const stats=[]; if(first.score!=null&&last.score!=null) stats.push('Talk score '+first.score+' → '+last.score);
  if(first.fpm!=null&&last.fpm!=null) stats.push('Fillers per minute '+first.fpm+' → '+last.fpm);
  stats.push(Object.keys(c).length+' practice days');
  g.fillText(stats.join('   ·   '), 800, 770);
  g.font='26px Georgia, serif'; g.fillStyle='#6A778C';
  g.fillText(new Date().toLocaleDateString(undefined,{day:'numeric',month:'long',year:'numeric'}), 800, 900);
  g.fillText('Openers · Weak words · Fillers · Pressure · Conversation · Executive presence', 800, 960);
  const url=cv.toDataURL('image/png');
  const el=$('#result');
  el.innerHTML=`<div class="rhead"><div class="av" style="background:#fff;font-size:26px">🎓</div><div><h2>Your certificate</h2><p>${esc(PROGRAMME.phaseName)}</p></div></div><main>
    <img src="${url}" style="width:100%;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.15)">
    <button class="btn" id="certDl" style="margin-top:14px">⬇ Save image</button>${navigator.share?'<button class="btn sec" id="certShare">Share</button>':''}<button class="btn sec" id="certClose">Close</button><div style="height:30px"></div></main>`;
  el.classList.add('on'); el.scrollTop=0;
  $('#certDl').onclick=()=>{ const a=document.createElement('a'); a.href=url; a.download='say-sharp-certificate.png'; a.click(); };
  const sh=$('#certShare'); if(sh) sh.onclick=async()=>{ try{ const b=await (await fetch(url)).blob(); await navigator.share({files:[new File([b],'say-sharp-certificate.png',{type:'image/png'})], title:'Say Sharp certificate'}); }catch(e){} };
  $('#certClose').onclick=closeResult;
}

/* ---------- progress ---------- */
function renderProgress(){
  const scored = sessions.filter(s=>s.kind==='talk' && s.m && s.m.score!=null);
  $('#stats').innerHTML = `<div><b>${sessions.length}</b><span>Sessions</span></div><div><b>${streak()}</b><span>Day streak</span></div><div><b>${gam.xp}</b><span>XP</span></div>`;
  const aiS = sessions.filter(s=>s.ai && s.ai.scores).slice(0,10);
  if(aiS.length){
    const avg={}; AI.DIMS.forEach(k=>{ const v=aiS.map(s=>s.ai.scores[k]).filter(x=>x!=null); if(v.length) avg[k]=Math.round(v.reduce((a,b)=>a+(+b||0),0)/v.length*10)/10; });
    $('#profile').innerHTML = dimBars(avg).replace(/<b>(\d+)<\/b>/g,(m,v)=>m) + `<p class="note" style="padding:8px 0 0">Weakest area: <b>${({fluency:'Flow',clarity:'Clarity',conciseness:'Getting to the point',structure:'Structure',relevance:'Answering the question',confidence:'Confidence',grammar:'Grammar'})[Object.entries(avg).sort((a,b)=>a[1]-b[1])[0][0]]}</b></p>`;
  } else $('#profile').innerHTML = '<div class="empty">'+(AI.ready()?'Do a session to build your profile.':'Turn on the AI coach to see this.')+'</div>';
  const done=Object.keys(prog.completed).length;
  $('#gridLbl').textContent='Phase 1 · '+done+' of 28 days';
  $('#grid60').innerHTML=[...Array(28)].map((_,k)=>{const d=k+1; return `<i class="${prog.completed[d]?'d':d===prog.day?'t':''} ${PROGRAMME.checkinDays.includes(d)?'c':''}"></i>`;}).join('');
  const rows = PROGRAMME.checkinDays.map(d=>{
    const ss=sessions.filter(s=>s.day===d && s.bench); if(!ss.length) return '';
    const up=ss.find(s=>s.bench==='update'), an=ss.find(s=>s.bench==='intro'||s.bench==='answer'), rd=ss.find(s=>s.bench==='passage');
    return `<tr class="click" data-id="${(up||an||rd).id}"><td><b>Day ${d}</b></td><td>${up&&up.m.score!=null?up.m.score:'–'}</td><td>${up?up.m.fillerPerMin:'–'}</td><td>${an&&an.m.score!=null?an.m.score:'–'}</td><td>${rd&&rd.m.score!=null?rd.m.score:'–'}</td></tr>`;
  }).join('');
  $('#checkins').innerHTML = rows ? `<table class="ck"><tr><th></th><th>Update</th><th>Fillers/min</th><th>Intro</th><th>Reading</th></tr>${rows}</table><p class="note" style="padding:8px 0 0">Tap a row to open that day’s recording.</p>` : '<div class="empty">Your Day 1 check-in will show here.</div>';
  if(prog.day>PROGRAMME.days) $('#checkins').insertAdjacentHTML('beforeend','<button class="btn" style="margin-top:12px" onclick="showCertificate()">🎓 View my certificate</button>');
  $('#checkins').querySelectorAll('tr.click').forEach(r=>r.onclick=()=>{ const s=sessions.find(x=>x.id===r.dataset.id); if(s) openResult(s); });
  const pts = scored.slice(0,20).reverse().map(s=>+(((s.m.fillerCount||0)+(s.m.softenerCount||0))/Math.max(s.dur/60,.25)).toFixed(1));
  if(pts.length<2) $('#chart').innerHTML='<div class="empty">Do 2 scored sessions to see your trend.</div>';
  else{
    const W=320,H=130,P=22, mx=Math.max(4,...pts);
    const x=i=>P+i*(W-2*P)/(pts.length-1), y=v=>H-P-(v/mx)*(H-2*P);
    const line=pts.map((v,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
    $('#chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%"><line x1="${P}" x2="${W-P}" y1="${y(2)}" y2="${y(2)}" stroke="#2E8B6A" stroke-dasharray="4 4" stroke-width="1"/><text x="${W-P}" y="${y(2)-5}" text-anchor="end" font-size="10" fill="#2E8B6A">target: 2 or less</text><path d="${line}" fill="none" stroke="#13203A" stroke-width="2.5" stroke-linejoin="round"/>${pts.map((v,i)=>`<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="#13203A"/>`).join('')}<text x="${P}" y="${H-4}" font-size="10" fill="#6A778C">older</text><text x="${W-P}" y="${H-4}" text-anchor="end" font-size="10" fill="#6A778C">latest: ${pts[pts.length-1]}</text></svg>`;
  }
  const tot={}; sessions.forEach(s=>s.m&&(s.m.fillers||[]).concat(s.m.softeners||[]).forEach(([w,n])=>tot[w]=(tot[w]||0)+n));
  const top=Object.entries(tot).sort((a,b)=>b[1]-a[1]).slice(0,10);
  $('#topF').innerHTML = top.length? top.map(([w,n])=>`<span class="chip f">${esc(w)} ×${n}</span>`).join('') : '<div class="empty">None yet</div>';
  $('#badgeGrid').innerHTML = C.BADGES.map(b=>`<div class="${gam.badges[b.id]?'got':''}" title="${esc(b.desc)}"><span class="bi">${b.icon}</span>${esc(b.name)}</div>`).join('');
  $('#sessions').innerHTML = sessions.length ? sessions.slice(0,60).map(s=>{
    const sc = s.kind==='game' ? (s.game==='rapid'?s.gs.total:s.game==='squeeze'?s.gs.r.score:s.gs.secs+'s') : s.m&&s.m.score;
    const cls = s.kind==='game'||sc==null?'':sc>=80?'hi':sc<60?'lo':'';
    const dt=new Date(s.ts); const when=dt.toLocaleDateString(undefined,{day:'numeric',month:'short'})+' · '+dt.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
    const kind = s.kind==='game' ? s.gameName : s.kind==='roleplay' ? 'Role-play' : s.day ? 'Day '+s.day : s.kind==='read' ? 'Read aloud' : s.drill==='walk' ? 'Walk' : (DRILLS[s.drill]?DRILLS[s.drill].name:'Practice');
    return `<div class="item" data-id="${s.id}"><div><b>${esc(s.prompt)}</b><small>${esc(kind)} · ${when}${s.ai?' · AI':''}</small></div><div class="pill ${cls}">${sc==null?'–':sc}</div></div>`;
  }).join('') : '<div class="empty">Your sessions will show here.</div>';
  $('#sessions').querySelectorAll('.item').forEach(it=>it.onclick=()=>{ const s=sessions.find(x=>x.id===it.dataset.id); if(s) openResult(s); });
}

/* ---------- toolkit ---------- */
$('#v-tips').innerHTML = C.TIPS.map(t=>`<div class="card tipcard"><h3>${esc(t.h)}</h3><p>${esc(t.p)}</p><div class="ex"><div class="no">✕ ${esc(t.no)}</div><div class="yes">✓ ${esc(t.yes)}</div></div></div>`).join('');

/* ---------- settings ---------- */
function fillModels(){
  const sel=$('#aiModel');
  sel.innerHTML = '<option value="">Automatic (recommended)</option>' + (settings.aiModels||[]).map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join('');
  sel.value = settings.aiModel||'';
}
function aiStatus(){
  const st=$('#aiStatus');
  if(settings.aiKey){ st.className='status ok'; st.textContent='✓ Connected'+(settings.aiLastModel?' · using '+settings.aiLastModel:''); $('#aiKey').placeholder='•••••••• saved'; }
  else { st.className='status'; st.textContent=''; }
}
$('#aiTest').onclick=async()=>{
  const k=$('#aiKey').value.trim() || settings.aiKey;
  if(!k){ toast('Paste your key first'); return; }
  const st=$('#aiStatus'); st.className='status'; st.textContent='Connecting…';
  const btn=$('#aiTest'); btn.disabled=true; btn.style.opacity=.6;
  settings.aiKey=k; settings.aiModel=''; settings.aiLastModel=''; aiConfig();
  try{
    const r = await AI.test(m=>{ st.textContent=m; });
    settings.aiModels=r.models; settings.aiLastModel=r.model; saveSettings(); aiConfig(); fillModels();
    $('#aiKey').value=''; aiStatus(); toast('AI coach is ready ✓');
  }catch(e){ settings.aiKey=''; aiConfig(); st.className='status bad'; st.textContent='✕ '+(e.user||e.message)+(e.message&&e.user&&e.user.indexOf(e.message)<0?' ('+String(e.message).slice(0,120)+')':''); saveSettings(); }
  btn.disabled=false; btn.style.opacity=1;
};
$('#aiModel').onchange=e=>{ settings.aiModel=e.target.value; saveSettings(); aiConfig(); };
$('#lang').value=settings.lang; $('#buzz').checked=settings.buzz; $('#liveCaptions').checked=settings.liveCaptions; $('#speakReplies').checked=settings.speakReplies;
$('#fillers').value=settings.fillers; $('#softeners').value=settings.softeners;
$('#lang').onchange=e=>{settings.lang=e.target.value;saveSettings();};
$('#buzz').onchange=e=>{settings.buzz=e.target.checked;saveSettings(); if(settings.buzz) vib(80);};
$('#liveCaptions').onchange=e=>{settings.liveCaptions=e.target.checked;saveSettings();};
$('#speakReplies').onchange=e=>{settings.speakReplies=e.target.checked;saveSettings();};
$('#camDefault').checked=settings.camera; $('#nameIn').value=settings.name||'';
$('#camDefault').onchange=e=>{settings.camera=e.target.checked;saveSettings();};
$('#nameIn').onchange=e=>{settings.name=e.target.value.trim();saveSettings();toast('Saved');};
$('#handsFree').checked=settings.handsFree; $('#waitMs').value=String(settings.waitMs);
$('#handsFree').onchange=e=>{settings.handsFree=e.target.checked;saveSettings();};
$('#waitMs').onchange=e=>{settings.waitMs=+e.target.value;saveSettings();};
$('#voice').onchange=e=>{settings.voice=e.target.value;saveSettings(); speak('Hello. This is how I will sound in your role-plays.');};
$('#fillers').onchange=e=>{settings.fillers=e.target.value;saveSettings();toast('Saved');};
$('#softeners').onchange=e=>{settings.softeners=e.target.value;saveSettings();toast('Saved');};
$('#resetWords').onclick=()=>{settings.fillers=TTP.DEFAULT_FILLERS.join(', ');settings.softeners=TTP.DEFAULT_SOFTENERS.join(', ');$('#fillers').value=settings.fillers;$('#softeners').value=settings.softeners;saveSettings();toast('Word lists reset');};
$('#exportBtn').onclick=()=>{ const b=new Blob([JSON.stringify({sessions, progress:prog, xp:gam},null,1)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='say-sharp-sessions.json'; a.click(); };
$('#wipeBtn').onclick=async()=>{ if(!confirm('Delete all sessions and recordings? Your level and programme stay.')) return; for(const s of sessions) await delAudio(s.id); sessions=[]; saveSessions(); toast('All sessions deleted'); };
let installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); installEvt=e; $('#installBtn').style.display='block'; });
$('#installBtn').onclick=async()=>{ if(installEvt){ installEvt.prompt(); installEvt=null; $('#installBtn').style.display='none'; } };

/* ---------- boot ---------- */
renderDrills(); newPrompt(); fillModels(); aiStatus(); fillVoices(); renderToday();
if(!window.isSecureContext) setTimeout(()=>toast('Open this from its https web link, or the mic will not work.',6000),800);
if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('sw.js').catch(()=>{});
