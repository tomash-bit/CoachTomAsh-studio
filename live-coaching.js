/* CoachTomAsh Studio v1.8 | Local-first Live Coaching Mode.
   No network calls, no new dependencies. Delivery records live in the same validated
   state object as v1.7 and are included in existing JSON/IndexedDB backups. */
'use strict';
(() => {
  const root = document.body;
  if (!root || typeof state === 'undefined' || typeof draw !== 'function') return;
  const by = id => document.getElementById(id);
  const text = s => esc(s == null ? '' : s);
  const now = () => Date.now();
  const min = (a,b) => Math.min(a,b);
  const clampMs = ms => Math.max(0,Math.round(Number(ms)||0));
  const format = ms => { const n=Math.ceil(clampMs(ms)/1000); return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); };
  const getDrill = id => state.drills.find(d=>d.id===id);
  const live = () => {
    if (!state.liveDelivery || !Array.isArray(state.liveDelivery.records)) {
      state.liveDelivery={schema:1,records:[],activeRunId:null};
    }
    return state.liveDelivery;
  };
  const activeRecord = () => live().records.find(r=>r.id===live().activeRunId) || null;
  const currentPlan = r => state.sessions.find(s=>s.id===r?.sessionId);
  function entriesFor(session){return (session.entries||[]).filter(e=>getDrill(e.drillId));}
  function snapshotPlan(s){return {
    title:s.title,age:s.age,date:s.date||'',principle:s.principle||'',objective:s.objective||'',
    blockNumber:s.blockNumber||'',weekNumber:s.weekNumber||'',block:s.block||'',venue:s.venue||'',
    entries:entriesFor(s).map(e=>({entryId:e.entryId,drillId:e.drillId,duration:sessionDuration(e),notes:e.notes||''}))
  };}
  function makeRecord(s){
    const plan=snapshotPlan(s);
    return {id:uid(),sessionId:s.id,plan,createdAt:now(),updatedAt:now(),status:'in-progress',
      index:0,restSeconds:90,overallReflection:'',practiceRemaining:{},practices:Object.fromEntries(plan.entries.map(e=>[e.entryId,
      {completed:false,outcome:'unreviewed',reflection:'',actualMs:0,restMs:0}])),
      timer:{kind:'practice',entryId:plan.entries[0]?.entryId||null,remainingMs:(plan.entries[0]?.duration||0)*60000,runningSince:null}};
  }
  const currentEntry = r => r?.plan?.entries?.[r.index] || null;
  const currentDrill = r => getDrill(currentEntry(r)?.drillId);
  const currentObservation = r => {const e=currentEntry(r);if(!e)return null;
    if(!r.practices[e.entryId])r.practices[e.entryId]={completed:false,outcome:'unreviewed',reflection:'',actualMs:0,restMs:0};
    return r.practices[e.entryId];
  };
  function save(r){if(r)r.updatedAt=now();persist();}
  function remaining(timer){
    if(!timer)return 0;
    return clampMs((timer.remainingMs||0)-(timer.runningSince ? now()-timer.runningSince : 0));
  }
  function pause(r,write=true){
    if(!r?.timer?.runningSince)return;
    const timer=r.timer,used=Math.min(clampMs(timer.remainingMs),Math.max(0,now()-timer.runningSince));
    timer.remainingMs=clampMs(timer.remainingMs-used);
    if(timer.kind==='practice'){r.practiceRemaining=r.practiceRemaining||{};r.practiceRemaining[timer.entryId]=timer.remainingMs;}
    const record=r.practices[timer.entryId];
    if(record){if(timer.kind==='rest')record.restMs=(record.restMs||0)+used;
      else record.actualMs=(record.actualMs||0)+used;}
    timer.runningSince=null;
    if(write)save(r);
  }
  function setTimer(r,kind,reset=false){
    pause(r,false);
    const e=currentEntry(r);
    r.practiceRemaining=r.practiceRemaining||{};
    if(reset&&kind==='practice'&&e)delete r.practiceRemaining[e.entryId];
    r.timer={kind,entryId:e?.entryId||null,runningSince:null,
      remainingMs:kind==='rest' ? (Number(r.restSeconds)||90)*1000 :
        (e ? (r.practiceRemaining[e.entryId] ?? e.duration*60000) : 0)};
    save(r);
  }
  function stopAnimation(){
    if(animation.raf)cancelAnimationFrame(animation.raf);
    animation.raf=0;animation.playing=false;animation.lastStamp=null;
    if(by('liveAnimToggle'))by('liveAnimToggle').textContent='▶ Play';
  }
  const animation={raf:0,playing:false,elapsed:0,lastStamp:null,loop:true};
  function animationDuration(d){
    return (d?.frames||[]).slice(0,-1).reduce((sum,_,i)=>sum+
      (window.CTAAnimationPro?.segmentMs?.(d.frames,i)||1600),0);
  }
  function renderPitchAt(d,elapsed=0){
    if(!d || !by('livePitch'))return;
    const frames=d.frames||[];
    if(!frames.length){by('livePitch').innerHTML='';return;}
    let frame=frames[0];
    const total=animationDuration(d);
    if(frames.length>1&&total>0){
      let rem=Math.min(elapsed,total);
      for(let i=0;i<frames.length-1;i++){
        const dur=window.CTAAnimationPro?.segmentMs?.(frames,i)||1600;
        if(rem<=dur||i===frames.length-2){
          frame=tweenFrames(frames[i],frames[i+1],Math.max(0,Math.min(1,rem/dur)));break;
        }
        rem-=dur;
      }
    }
    by('livePitch').innerHTML=draw(frame.objects,frame.paths,d.pitchType||'full',null,d);
    const progress=by('liveAnimProgress');
    if(progress)progress.value=total?Math.round(Math.min(1,elapsed/total)*1000):0;
  }
  function animationTick(stamp){
    if(!animation.playing)return;
    const r=activeRecord(),d=currentDrill(r);
    if(!d){stopAnimation();return;}
    const total=animationDuration(d);
    if(animation.lastStamp!==null)animation.elapsed+=Math.max(0,stamp-animation.lastStamp);
    animation.lastStamp=stamp;
    if(total&&animation.elapsed>=total){
      if(animation.loop)animation.elapsed%=total;
      else {animation.elapsed=total;renderPitchAt(d,animation.elapsed);stopAnimation();return;}
    }
    renderPitchAt(d,animation.elapsed);
    animation.raf=requestAnimationFrame(animationTick);
  }
  function resetAnimation(){stopAnimation();animation.elapsed=0;renderPitchAt(currentDrill(activeRecord()),0);}
  let updateLoop=0,visible=false;
  function updateCountdown(){
    if(!visible)return;
    const r=activeRecord();if(!r)return;
    const timer=r.timer;
    if(timer?.runningSince && remaining(timer)===0){
      pause(r);
      by('liveTimerStatus').textContent='Time complete. Move on when ready.';
      if(navigator.vibrate)try{navigator.vibrate([150,80,150]);}catch(_){}
      by('liveTimerToggle').textContent='▶ Resume';
    }
    by('liveTimer').textContent=format(remaining(timer));
    by('liveTimerMode').textContent=timer?.kind==='rest'?'Rest interval':'Practice time';
    by('liveTimerToggle').textContent=timer?.runningSince?'Ⅱ Pause':'▶ Start';
  }
  function renderObservation(r){
    const entry=currentEntry(r),item=currentObservation(r);
    by('liveResult').value=item?.outcome||'unreviewed';
    by('liveReflection').value=item?.reflection||'';
    by('liveCompleted').checked=!!item?.completed;
    by('liveOverall').value=r?.overallReflection||'';
    by('liveRestSeconds').value=String(r?.restSeconds||90);
    by('liveStatus').textContent=r.status==='delivered'?'DELIVERED':'IN PROGRESS';
    by('liveStatus').dataset.complete=r.status==='delivered'?'true':'false';
    by('liveSessionFinish').disabled=r.status==='delivered';
    by('liveTimerStatus').textContent=r.status==='delivered'?'Delivered record saved locally.':
      entry ? 'Practice and rest timers are independent.' : 'No practices in this session.';
  }
  function renderList(r){
    by('livePracticeList').innerHTML=r.plan.entries.map((e,i)=>{
      const d=getDrill(e.drillId),p=r.practices[e.entryId]||{};
      return '<button type="button" class="lc-list-item'+(r.index===i?' chosen':'')+'" data-live-index="'+i+'">'+
        '<span>'+(i+1)+'. '+text(d?.name||'Unavailable practice')+'</span><small>'+(p.completed?'✓ Delivered':'○ Planned')+
        ' · '+e.duration+' min</small></button>';
    }).join('')||'<p>No planned practices in this session.</p>';
    const n=r.plan.entries.filter(e=>r.practices[e.entryId]?.completed).length;
    by('liveOverallProgress').textContent=n+'/'+r.plan.entries.length+' practices marked complete';
  }
  function renderMain(){
    const r=activeRecord();if(!r)return;
    const e=currentEntry(r),d=currentDrill(r);
    by('liveTitle').textContent=r.plan.title;
    by('liveMeta').textContent=[r.plan.age,r.plan.date,r.plan.principle].filter(Boolean).join(' · ');
    by('liveSessionSelect').innerHTML=state.sessions.map(s=>'<option value="'+text(s.id)+'">'+text(s.title)+' · '+text(s.age)+'</option>').join('');
    by('liveSessionSelect').value=r.sessionId;
    by('liveRunSelect').innerHTML=live().records.filter(x=>x.sessionId===r.sessionId)
      .map(x=>'<option value="'+text(x.id)+'">'+text(new Date(x.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'}))+' · '+(x.status==='delivered'?'Delivered':'In progress')+'</option>').join('');
    by('liveRunSelect').value=r.id;
    by('livePracticeTitle').textContent=d?.name||'No practice available';
    by('livePracticeSubtitle').textContent=e?`${r.index+1} of ${r.plan.entries.length} · ${e.duration} minutes · ${d?.area||''}`:'Add practices in the Session builder';
    by('livePrev').disabled=r.index===0;
    by('liveNext').disabled=r.index>=r.plan.entries.length-1;
    const blocks=[['Learning objective',d?.objective||r.plan.objective],['Organisation',d?.organisation],
      ['Coaching points',d?.coaching],['Conditions',d?.constraints],['Progressions',d?.progressions],
      ['Session notes',e?.notes]].filter(pair=>pair[1]);
    by('liveCoachDetails').innerHTML=blocks.map(([name,value])=>'<details '+(name==='Coaching points'||name==='Learning objective'?'open':'')+'><summary>'+text(name)+'</summary><p>'+text(value)+'</p></details>').join('');
    renderList(r);renderObservation(r);resetAnimation();updateCountdown();
    by('liveAnimToggle').disabled=!d||d.frames.length<2;
    by('liveAnimProgress').disabled=!d||d.frames.length<2;
  }
  function setPracticeIndex(i){
    if(visible && activeRecord())syncReflection();
    const r=activeRecord();if(!r||i<0||i>=r.plan.entries.length)return;
    pause(r,false);r.index=i;
    const e=currentEntry(r);r.practiceRemaining=r.practiceRemaining||{};
    r.timer={kind:'practice',entryId:e.entryId,remainingMs:r.practiceRemaining[e.entryId]??e.duration*60000,runningSince:null};
    save(r);renderMain();
  }
  function openSession(sessionId,newRun=false){
    if(visible && activeRecord())syncReflection();
    const s=state.sessions.find(x=>x.id===sessionId);
    if(!s)return;
    const data=live();
    let r=!newRun&&data.records.find(x=>x.sessionId===sessionId&&x.status==='in-progress');
    if(!r&&!newRun)r=data.records.find(x=>x.sessionId===sessionId&&x.status==='delivered');
    if(!r){r=makeRecord(s);data.records.unshift(r);}
    data.activeRunId=r.id;
    save(r);renderMain();
  }
  function show(sessionId){
    const existing=activeRecord();if(existing)pause(existing,false);
    const s=state.sessions.find(x=>x.id===sessionId)||state.sessions.find(x=>x.id===state.currentSessionId)||state.sessions[0];
    if(!s)return;
    by('liveOverlay').hidden=false;
    root.classList.add('live-coaching-open');
    openSession(s.id);
    visible=true;
    if(updateLoop)clearInterval(updateLoop);
    updateLoop=setInterval(updateCountdown,250);
    updateCountdown();
  }
  function hide(){
    clearTimeout(noteDebounce);if(visible && activeRecord())syncReflection();
    const r=activeRecord();if(r)pause(r);
    stopAnimation();visible=false;
    clearInterval(updateLoop);updateLoop=0;
    by('liveOverlay').hidden=true;root.classList.remove('live-coaching-open');
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    updateCurriculumStatus();updateBuilderStatus();
  }
  const overlay=document.createElement('div');overlay.id='liveOverlay';overlay.className='lc-overlay';overlay.hidden=true;
  overlay.innerHTML=`<header class="lc-head"><div class="lc-brand"><img src="./coach-tomash-logo.png" alt="CoachTomAsh"><div><strong>LIVE COACHING MODE</strong><small id="liveMeta"></small></div></div>
    <div class="lc-head-actions"><span class="lc-status" id="liveStatus">IN PROGRESS</span><button class="lc-button lc-ghost" id="liveFullScreen" type="button">⛶ Full screen</button><button class="lc-button lc-close" id="liveClose" type="button">✕ Exit</button></div></header>
    <div class="lc-control-bar"><label>Session <select id="liveSessionSelect" aria-label="Choose saved session"></select></label><label>Delivery <select id="liveRunSelect" aria-label="Choose past delivery record"></select></label><strong id="liveTitle"></strong>
      <button class="lc-button" id="liveNewDelivery" type="button">+ New delivery</button><span id="liveOverallProgress"></span></div>
    <main class="lc-workspace"><section class="lc-main">
      <div class="lc-section-title"><div><h2 id="livePracticeTitle"></h2><span id="livePracticeSubtitle"></span></div><div class="lc-nav"><button id="livePrev" class="lc-button" type="button">← Previous</button><button id="liveNext" class="lc-button lc-primary" type="button">Next →</button></div></div>
      <div class="lc-field"><svg id="livePitch" viewBox="-60 -39 1120 728" role="img" aria-label="Animated football practice diagram"></svg></div>
      <div class="lc-animation"><strong>Practice animation</strong><button id="liveAnimToggle" class="lc-button lc-primary" type="button">▶ Play</button><button id="liveAnimRestart" class="lc-button" type="button">↺ Restart</button><label class="lc-loop"><input id="liveAnimLoop" type="checkbox" checked> Loop</label><input id="liveAnimProgress" type="range" min="0" max="1000" value="0" aria-label="Scrub practice animation"></div>
      <div class="lc-details"><h3>Delivery guidance</h3><div id="liveCoachDetails"></div></div>
    </section><aside class="lc-sidebar">
      <section class="lc-widget lc-timer-panel"><div class="lc-eyebrow" id="liveTimerMode">Practice time</div><div class="lc-time" id="liveTimer">00:00</div><div id="liveTimerStatus" class="lc-hint">Ready</div>
        <div class="lc-buttons"><button id="liveTimerToggle" class="lc-button lc-primary" type="button">▶ Start</button><button id="liveTimerReset" class="lc-button" type="button">↺ Reset</button></div>
        <div class="lc-rest"><label>Rest interval (seconds) <input id="liveRestSeconds" type="number" min="15" max="600" step="15" value="90"></label><button id="liveRestStart" class="lc-button" type="button">Start rest</button><button id="livePracticeTimer" class="lc-button" type="button">Practice timer</button></div></section>
      <section class="lc-widget"><h3>Session running order</h3><div id="livePracticeList" class="lc-list"></div></section>
      <section class="lc-widget lc-review"><h3>Quick coaching reflection</h3>
        <label>Outcome <select id="liveResult"><option value="unreviewed">Not reviewed</option><option value="achieved">Achieved</option><option value="partial">Partly achieved</option><option value="revisit">Revisit</option></select></label>
        <label>Observations / next steps <textarea id="liveReflection" rows="3" placeholder="What did the players demonstrate? What will you adapt next time?"></textarea></label>
        <label class="lc-check"><input id="liveCompleted" type="checkbox"> Practice completed</label>
        <label>Overall session reflection <textarea id="liveOverall" rows="3" placeholder="Key learning and next session priorities"></textarea></label>
        <button id="liveSessionFinish" class="lc-button lc-finish" type="button">✓ Mark session delivered</button><p class="lc-hint">Reflections are stored only on this device, alongside your existing library backups. Avoid identifiable player details.</p>
      </section>
    </aside></main>`;
  root.appendChild(overlay);
  const openHeader=document.createElement('button');openHeader.type='button';openHeader.id='liveHeaderOpen';openHeader.className='btn primary';openHeader.textContent='▶ Live coaching';
  by('storageOpen')?.parentElement?.insertBefore(openHeader,by('storageOpen'));
  const sessionLaunch=document.createElement('button');sessionLaunch.id='liveSessionOpen';sessionLaunch.type='button';sessionLaunch.className='btn primary';sessionLaunch.textContent='▶ Deliver this session';
  by('printSession')?.parentElement?.insertBefore(sessionLaunch,by('printSession'));
  openHeader.addEventListener('click',()=>show(state.currentSessionId));
  sessionLaunch.addEventListener('click',()=>show(state.currentSessionId));
  by('liveClose').addEventListener('click',hide);
  by('liveFullScreen').addEventListener('click',()=>{
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});
    else overlay.requestFullscreen?.().catch(()=>{by('liveFullScreen').textContent='Full-viewport mode active';});
  });
  by('liveSessionSelect').addEventListener('change',e=>{
    const r=activeRecord();if(r)pause(r);
    openSession(e.target.value);
  });
  by('liveRunSelect').addEventListener('change',e=>{
    if(activeRecord())syncReflection();
    const r=activeRecord();if(r)pause(r,false);
    if(!live().records.some(x=>x.id===e.target.value))return;
    live().activeRunId=e.target.value;save(activeRecord());renderMain();
  });
  by('liveNewDelivery').addEventListener('click',()=>{
    const r=activeRecord();if(!r)return;
    if(!confirm('Start a new delivery record for this session? Previous delivery records remain saved.'))return;
    pause(r);openSession(r.sessionId,true);
  });
  by('livePrev').addEventListener('click',()=>setPracticeIndex(activeRecord().index-1));
  by('liveNext').addEventListener('click',()=>setPracticeIndex(activeRecord().index+1));
  by('livePracticeList').addEventListener('click',e=>{
    const b=e.target.closest('[data-live-index]');if(b)setPracticeIndex(Number(b.dataset.liveIndex));
  });
  by('liveTimerToggle').addEventListener('click',()=>{
    const r=activeRecord();if(!r)return;
    if(r.timer?.runningSince){pause(r);}
    else if(remaining(r.timer)>0){r.timer.runningSince=now();save(r);}
    else {by('liveTimerStatus').textContent='Reset the timer to begin again.';}
    updateCountdown();
  });
  by('liveTimerReset').addEventListener('click',()=>{
    const r=activeRecord();if(!r)return;
    if(!confirm('Reset this timer? Elapsed coaching time already recorded will be retained.'))return;
    setTimer(r,r.timer.kind,true);updateCountdown();
  });
  by('liveRestSeconds').addEventListener('change',e=>{
    const r=activeRecord();if(!r)return;
    r.restSeconds=Math.max(15,Math.min(600,Number(e.target.value)||90));save(r);
    e.target.value=r.restSeconds;
  });
  by('liveRestStart').addEventListener('click',()=>{
    const r=activeRecord();if(!r)return;
    setTimer(r,'rest');r.timer.runningSince=now();save(r);updateCountdown();
  });
  by('livePracticeTimer').addEventListener('click',()=>{
    const r=activeRecord();if(!r)return;setTimer(r,'practice');updateCountdown();
  });
  by('liveAnimToggle').addEventListener('click',()=>{
    if(animation.playing){stopAnimation();return;}
    const d=currentDrill(activeRecord());if(!d||d.frames.length<2)return;
    const total=animationDuration(d);if(animation.elapsed>=total)animation.elapsed=0;
    animation.playing=true;animation.lastStamp=null;by('liveAnimToggle').textContent='Ⅱ Pause';
    animation.raf=requestAnimationFrame(animationTick);
  });
  by('liveAnimRestart').addEventListener('click',resetAnimation);
  by('liveAnimLoop').addEventListener('change',e=>animation.loop=e.target.checked);
  by('liveAnimProgress').addEventListener('input',e=>{
    stopAnimation();const d=currentDrill(activeRecord());
    animation.elapsed=Math.round(animationDuration(d)*Number(e.target.value)/1000);renderPitchAt(d,animation.elapsed);
  });
  function syncReflection(){
    const r=activeRecord();if(!r)return;const item=currentObservation(r);
    if(item){item.outcome=by('liveResult').value;item.reflection=by('liveReflection').value;item.completed=by('liveCompleted').checked;}
    r.overallReflection=by('liveOverall').value;save(r);
    renderList(r);
  }
  for(const id of ['liveResult','liveCompleted'])by(id).addEventListener('change',syncReflection);
  let noteDebounce=0;
  for(const id of ['liveReflection','liveOverall']){
    by(id).addEventListener('input',()=>{
      clearTimeout(noteDebounce);noteDebounce=setTimeout(syncReflection,450);
    });
    by(id).addEventListener('change',()=>{clearTimeout(noteDebounce);syncReflection();});
  }
  by('liveSessionFinish').addEventListener('click',()=>{
    const r=activeRecord();if(!r||r.status==='delivered')return;
    pause(r,false);
    syncReflection();
    const n=r.plan.entries.filter(e=>r.practices[e.entryId]?.completed).length;
    if(!confirm('Mark this session as delivered? '+n+' of '+r.plan.entries.length+' practices are marked complete.'))return;
    r.status='delivered';r.deliveredAt=now();save(r);renderObservation(r);
    updateBuilderStatus();updateCurriculumStatus();
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      // Keep timers accurate using wall-clock time while the iPad is locked.
      if(noteDebounce){clearTimeout(noteDebounce);syncReflection();}
      if(activeRecord())save(activeRecord());
    }
  });
  window.addEventListener('pagehide',()=>{if(noteDebounce){clearTimeout(noteDebounce);syncReflection();}});
  function latestDelivered(id){return live().records.find(r=>r.sessionId===id&&r.status==='delivered')||null;}
  function updateBuilderStatus(){
    const el=by('liveDeliverySummary');if(!el)return;
    const n=state.sessions.filter(s=>latestDelivered(s.id)).length;
    el.textContent=`${n} of ${state.sessions.length} saved sessions delivered at least once`;
  }
  const summary=document.createElement('span');summary.id='liveDeliverySummary';summary.className='hint';
  by('sessionLibraryCount')?.parentElement?.appendChild(summary);
  function updateCurriculumStatus(){
    const grid=by('curriculumGrid'),sum=by('liveCurriculumSummary');if(!grid||!sum)return;
    const age=by('currAge')?.value||'',block=Number(by('currBlock')?.value||1);
    const sessions=state.sessions.filter(s=>(!age||s.age===age)&&(
      (s.curriculumAssigned?Number(s.blockNumber):Number(s.blockNumber||((String(s.block||'').match(/block\s*([1-4])/i)||[])[1])))===block));
    const delivered=sessions.filter(s=>latestDelivered(s.id)).length;
    sum.textContent=`${delivered} of ${sessions.length} sessions recorded as delivered`;
    grid.querySelectorAll('[data-curr-session]').forEach(button=>{
      const row=button.closest('.v14-week-entry');if(!row)return;
      const id=button.dataset.currSession;let chip=row.querySelector('.lc-curr-chip');
      if(!chip){chip=document.createElement('span');chip.className='lc-curr-chip';row.insertBefore(chip,button);}
      const isDone=!!latestDelivered(id);chip.textContent=isDone?'✓ Delivered':'○ Planned';chip.dataset.done=isDone?'true':'false';
    });
  }
  const currSummary=document.createElement('span');currSummary.id='liveCurriculumSummary';currSummary.className='hint';
  by('currSummary')?.parentElement?.appendChild(currSummary);
  const priorChooseTab=chooseTab;
  chooseTab=function(name){priorChooseTab(name);
    if(name==='curriculum')updateCurriculumStatus();
    if(name==='session')updateBuilderStatus();
  };
  ['currBlock','currAge'].forEach(id=>by(id)?.addEventListener('change',updateCurriculumStatus));
  by('curriculumGrid')?.addEventListener('click',()=>queueMicrotask(updateCurriculumStatus));
  window.CTALiveCoaching={open:show,close:hide,model:{makeRecord,remaining,snapshotPlan}};
  updateBuilderStatus();
})();
