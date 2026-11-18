/* CoachTomAsh Studio v1.4: optional metadata, 10-week curriculum & pitch styles.
   Existing localStorage key, diagram coordinates, sessions and backups remain unchanged. */
(() => {
  'use strict';
  const oldChooseTab = chooseTab;
  const oldRenderInfo = renderInfo;
  const oldRenderSession = renderSession;
  const oldDraw = draw;
  const oldOutline = outlineMarkup;
  let diagramContext = null;
  const weekRange = Array.from({length:10}, (_,i) => i+1);
  const curriculumFieldNames = ['v14Block','v14Week','v14Psych','v14Physical','v14Position','v14Keywords'];
  const pitchPalettes = {
    classic: {runoff:'#13553f', field:'#217a53'},
    deep:    {runoff:'#112f30', field:'#19594a'},
    blue:    {runoff:'#142d4f', field:'#2b6489'}
  };
  const validBlock = v => /^[1-4]$/.test(String(v||'')) ? Number(v) : null;
  const validWeek = v => /^(10|[1-9])$/.test(String(v||'')) ? Number(v) : null;
  const drillBlock = d => validBlock(d.curriculumBlock);
  const drillWeek = d => validWeek(d.curriculumWeek);
  const sessionBlock = s => validBlock(s.blockNumber) || validBlock((String(s.block||'').match(/\bblock\s*([1-4])\b/i)||[])[1]);
  const sessionWeek = s => validWeek(s.weekNumber) || validWeek((String(s.block||'').match(/\bweek\s*(10|[1-9])\b/i)||[])[1]);
  const numTag = (label, extra='') => '<span class="pill '+extra+'">'+esc(label)+'</span>';
  const allPracticeFields = {
    v14Block:'curriculumBlock', v14Week:'curriculumWeek',
    v14Psych:'psychologicalPillar', v14Physical:'physicalPillar',
    v14Position:'positionFocus', v14Keywords:'keywords'
  };
  // SVG pitch themes & reference grids. The drawing remains fully editable.
  outlineMarkup = function(type) {
    const d = diagramContext || current();
    const palette = pitchPalettes[d?.pitchTheme] || pitchPalettes.classic;
    let svg = oldOutline(type);
    svg = svg.replace('fill="#13553f"','fill="'+palette.runoff+'"')
             .replace('fill="#217a53"','fill="'+palette.field+'"');
    const guide = d?.pitchGuides || 'none';
    const lanes = guide === 'lanes' || guide === 'grid';
    const thirds = guide === 'thirds' || guide === 'grid';
    let marks = '';
    if(lanes) for (const y of [65+520/3,65+1040/3])
      marks += '<path d="M70 '+y+' H930" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-dasharray="11 10" opacity=".63"/>';
    if(thirds) for (const x of [70+860/3,70+1720/3])
      marks += '<path d="M'+x+' 65 V585" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-dasharray="11 10" opacity=".63"/>';
    return svg.replace('<text x="85" y="608"',marks+'<text x="85" y="608"');
  };
  draw = function(objects,paths,pitchType,temp,settings) {
    const previous = diagramContext;
    diagramContext = settings || null;
    try { return oldDraw(objects,paths,pitchType,temp); }
    finally { diagramContext = previous; }
  };
  // An optional field is only created when the coach edits it.
  function showPracticeMetadata() {
    const d = current();
    for (const id of curriculumFieldNames) {
      const el = $(id);
      if(!el || document.activeElement===el) continue;
      el.value = d[allPracticeFields[id]] ?? '';
    }
    for (const [id,key] of [['pitchTheme','pitchTheme'],['pitchGuides','pitchGuides']]) {
      const el=$(id);
      if(el && document.activeElement!==el) el.value=d[key]|| (id==='pitchTheme'?'classic':'none');
    }
  }
  renderInfo = function() {
    oldRenderInfo();
    showPracticeMetadata();
  };
  curriculumFieldNames.forEach(id=> {
    const el=$(id);
    if(!el)return;
    const key=allPracticeFields[id];
    const update=()=>{
      const d=current();
      d[key]=el.value.trim();
      d.updated=Date.now();
      persist();
      if(id==='v14Block' && !el.value) { $('v14Week').value=''; d.curriculumWeek=''; persist(); }
    };
    el.addEventListener(id==='v14Keywords'?'change':'change',update);
  });
  for(const [id,key] of [['pitchTheme','pitchTheme'],['pitchGuides','pitchGuides']]) {
    $(id).addEventListener('change',()=>{
      current()[key]=$(id).value;
      commit();
      renderPitch();
    });
  }
  // Library filters: intersect, never alter the underlying drills.
  const libFilters=['searchDrills','filterAge','filterPrinciple','filterType','filterBlock','filterWeek','filterPsych','filterPhysical'];
  function libraryMatches(d) {
    const q=$('searchDrills').value.toLowerCase().trim();
    const block=$('filterBlock').value, week=$('filterWeek').value;
    if($('filterAge').value && d.age!==$('filterAge').value) return false;
    if($('filterPrinciple').value && d.principle!==$('filterPrinciple').value) return false;
    if($('filterType').value && d.practiceType!==$('filterType').value) return false;
    if(block==='unassigned' && drillBlock(d)) return false;
    if(block && block!=='unassigned' && drillBlock(d)!==Number(block))return false;
    if(week && drillWeek(d)!==Number(week))return false;
    if($('filterPsych').value && d.psychologicalPillar!==$('filterPsych').value)return false;
    if($('filterPhysical').value && d.physicalPillar!==$('filterPhysical').value)return false;
    if(q) {
      const text=[d.name,d.age,d.principle,d.practiceType,d.objective,d.organisation,d.coaching,d.constraints,
        d.success,d.area,d.positionFocus,d.psychologicalPillar,d.physicalPillar,d.keywords].join(' ').toLowerCase();
      if(!text.includes(q))return false;
    }
    return true;
  }
  function thumbnail(d) {
    const f=d.frames?.[0];
    if(!f) return '<span style="font-size:35px">⚽</span>';
    return '<svg viewBox="-60 -39 1120 728" aria-label="Diagram preview for '+esc(d.name)+'" role="img">'+draw(f.objects,f.paths,d.pitchType||'quarter',null,d)+'</svg>';
  }
  renderLibrary=function(){
    const matches=state.drills.filter(libraryMatches).sort((a,b)=>Number(b.updated||0)-Number(a.updated||0));
    $('libraryCount').textContent=matches.length+' of '+state.drills.length+' practices';
    $('drillGrid').innerHTML=matches.length?matches.map(d=>{
      const block=drillBlock(d),week=drillWeek(d);
      const labels=[numTag(d.age),numTag(d.principle),numTag(d.practiceType),
        ...(block?[numTag('Block '+block+(week?' · Week '+week:''),'v14-tag-block')]:[]),
        ...(d.psychologicalPillar?[numTag(d.psychologicalPillar,'v14-tag-special')]:[]),
        ...(d.physicalPillar?[numTag(d.physicalPillar)]:[]),
        ...(d.positionFocus?[numTag(d.positionFocus)]:[])];
      return '<article class="drill-card"><div class="v14-mini-field">'+thumbnail(d)+'</div><div class="drill-info"><h3>'+esc(d.name)+'</h3><div class="v14-card-tags">'+labels.join('')+'</div><p class="v14-card-summary">'+esc((d.objective||'Add an objective in the designer.').slice(0,120))+'</p><div class="hint" style="margin-bottom:10px">'+esc(d.duration||0)+' min · '+(d.frames?.length||1)+' animation frame(s)</div><div class="card-footer"><button class="btn small dark" data-open="'+esc(d.id)+'">Edit</button><button class="btn small" data-clone="'+esc(d.id)+'">Duplicate</button><button class="btn small danger" data-delete="'+esc(d.id)+'">Delete</button></div></div></article>';
    }).join(''):'<div class="empty"><b>No matching practices</b>Try clearing a filter or tagging a practice in the Drill designer.</div>';
  };
  libFilters.forEach(id=>{
    $(id).addEventListener(id==='searchDrills'?'input':'change',renderLibrary);
  });
  $('clearLibraryFilters').addEventListener('click',()=>{libFilters.forEach(id=>$(id).value='');renderLibrary();});
  // Separate curriculum fields keep historical free-text block names untouched.
  function showSessionCurriculum() {
    const s=activeSession();
    const b=$('s-blockNumber'),w=$('s-weekNumber');
    if(document.activeElement!==b)b.value=String(effectiveSessionBlock(s)||'');
    if(document.activeElement!==w)w.value=String(effectiveSessionWeek(s)||'');
  }
  renderSession=function(){oldRenderSession();showSessionCurriculum();};
  for (const [id,key,validate] of [['s-blockNumber','blockNumber',validBlock],['s-weekNumber','weekNumber',validWeek]]) {
    $(id).addEventListener('change',()=>{
      const s=activeSession();s[key]=validate($(id).value)||'';
      // A clear numeric assignment has precedence over any legacy free-text label.
      s.curriculumAssigned=true;
      touchSession();renderSession();
    });
  }
  // If a coach explicitly clears either assignment, do not revive legacy text parsing.
  const oldSessionBlock=sessionBlock,oldSessionWeek=sessionWeek;
  // Redefine resolution via local helpers rather than mutating historic s.block.
  function effectiveSessionBlock(s){return s.curriculumAssigned ? validBlock(s.blockNumber) : oldSessionBlock(s);}
  function effectiveSessionWeek(s){return s.curriculumAssigned ? validWeek(s.weekNumber) : oldSessionWeek(s);}
  function renderCurriculum(){
    const block=Number($('currBlock').value)||1, age=$('currAge').value;
    const relevantSessions=state.sessions.filter(s=>(!age||s.age===age)&&effectiveSessionBlock(s)===block);
    const relevantDrills=state.drills.filter(d=>(!age||d.age===age)&&drillBlock(d)===block);
    const scheduledSessions=relevantSessions.filter(s=>effectiveSessionWeek(s));
    const scheduledDrills=relevantDrills.filter(d=>drillWeek(d));
    $('currSummary').innerHTML=numTag('Block '+block,'v14-tag-block')+
      numTag(scheduledSessions.length+' scheduled sessions')+
      numTag(scheduledDrills.length+' tagged practices')+
      numTag((relevantSessions.length-scheduledSessions.length)+' sessions without a week');
    $('curriculumGrid').innerHTML=weekRange.map(week=>{
      const sessions=scheduledSessions.filter(s=>effectiveSessionWeek(s)===week);
      const drills=scheduledDrills.filter(d=>drillWeek(d)===week);
      return '<section class="v14-week-card"><div class="v14-week-head"><h3>Week '+week+'</h3><span class="pill">'+sessions.length+' sessions · '+drills.length+' practices</span></div><div class="v14-week-body">'+
        '<div class="v14-week-section">Sessions</div>'+
        (sessions.length?sessions.map(s=>'<div class="v14-week-entry"><div><strong>'+esc(s.title)+'</strong><small>'+esc(s.age)+' · '+sessionTotal(s)+' min · '+s.entries.length+' activities</small></div><button class="btn small" data-curr-session="'+esc(s.id)+'">Open</button></div>').join(''):'<div class="v14-week-empty">No sessions scheduled</div>')+
        '<div class="v14-week-section" style="margin-top:14px">Tagged practices</div>'+
        (drills.length?drills.map(d=>'<div class="v14-week-entry"><div><strong>'+esc(d.name)+'</strong><small>'+esc(d.age)+' · '+esc(d.principle)+'</small></div><button class="btn small" data-curr-drill="'+esc(d.id)+'">Edit</button></div>').join(''):'<div class="v14-week-empty">No practices tagged</div>')+
        '<button type="button" class="btn small dark v14-week-add" data-place-session="'+week+'">+ Place current session</button></div></section>';
    }).join('');
  }
  chooseTab=function(name){oldChooseTab(name);if(name==='curriculum')renderCurriculum();};
  ['currAge','currBlock'].forEach(id=>$(id).addEventListener('change',renderCurriculum));
  $('currOpenSession').addEventListener('click',()=>chooseTab('session'));
  $('curriculumGrid').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.currSession){activateSession(b.dataset.currSession);chooseTab('session');return;}
    if(b.dataset.currDrill){selectDrill(b.dataset.currDrill);return;}
    if(b.dataset.placeSession){
      const s=activeSession(),age=$('currAge').value;
      if(age && s.age!==age){toast('Current session is '+s.age+'. Choose '+s.age+' or All ages to place it.');return;}
      s.blockNumber=Number($('currBlock').value);s.weekNumber=Number(b.dataset.placeSession);
      s.curriculumAssigned=true;
      touchSession();renderCurriculum();toast('Session assigned to Block '+s.blockNumber+', Week '+s.weekNumber);
    }
  });
  // Keep legacy content and all other features exactly as in v1.3.1.
  showPracticeMetadata();
})();
