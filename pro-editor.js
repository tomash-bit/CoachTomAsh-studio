/* CoachTomAsh Studio v1.6.4 | Explicit colour selector and formation recolour
 * Additive properties: object.scale (goals), object.groupId, path.curved/cx/cy.
 * Older drills do not need migration. Everything remains in the v1 storage schema.
 */
(() => {
  'use strict';
  const goalPanel = document.getElementById('goalSizePanel');
  const goalSlider = document.getElementById('goalScale');
  const goalValue = document.getElementById('goalScaleValue');
  const curvePanel = document.getElementById('curvePanel');
  const bendSlider = document.getElementById('curveBend');
  const bendValue = document.getElementById('curveBendValue');
  let gesture = null;
  const getObject = () => currentFrame().objects.find(o => o.id === selectedId);
  const getPath = () => currentFrame().paths.find(p => p.id === selectedPath);
  const isGoal = o => o && ['goal', 'fullgoal'].includes(o.type);
  const goalScale = o => clamp(Number(o?.scale) || 1, .5, 2.5);
  const bound = point => ({x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100)});

  // SVG uses a quadratic Bezier. Its actual midpoint at t=.5 is
  // 25% start + 50% quadratic control + 25% end, NOT the control point.
  // The iPad bend handle must sit ON the rendered curve, so inverse that
  // relation to put the curve through the position where the coach drags.
  function visibleMidpoint(path) {
    const c = (Number.isFinite(Number(path.cx)) && Number.isFinite(Number(path.cy)))
      ? {x:Number(path.cx),y:Number(path.cy)}
      : {x:(path.x1+path.x2)/2,y:(path.y1+path.y2)/2};
    return {x:.25*path.x1+.5*c.x+.25*path.x2,
            y:.25*path.y1+.5*c.y+.25*path.y2};
  }
  function setVisibleMidpoint(path, point) {
    path.curved = true;
    path.cx = 2*point.x-.5*(path.x1+path.x2);
    path.cy = 2*point.y-.5*(path.y1+path.y2);
  }
  function curveNormal(path) {
    const a=XY({x:path.x1,y:path.y1}), b=XY({x:path.x2,y:path.y2});
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    return {nx:-dy/len,ny:dx/len,len,center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  }
  function setBend(path, pixels) {
    const n=curveNormal(path);
    const target={x:n.center.x+n.nx*pixels,y:n.center.y+n.ny*pixels};
    setVisibleMidpoint(path,{x:(target.x-70)/8.6,y:(target.y-65)/5.2});
  }
  function getBend(path) {
    if(!path?.curved)return 0;
    const n=curveNormal(path),m=XY(visibleMidpoint(path));
    return (m.x-n.center.x)*n.nx+(m.y-n.center.y)*n.ny;
  }
  function defaultControl(path) {
    // Clearly visible by default: the arc crosses a point 60-105 SVG pixels
    // away from the chord, rather than placing an off-curve dot at its control.
    const n=curveNormal(path), pixels=Math.min(105,Math.max(60,n.len*.22));
    const adjusted={...path};setBend(adjusted,pixels);
    return {x:adjusted.cx,y:adjusted.cy};
  }
  function updatePanels() {
    const o = getObject(), p = getPath();
    goalPanel.hidden = !isGoal(o);
    if (isGoal(o)) {
      goalSlider.value = String(Math.round(goalScale(o) * 100));
      goalValue.textContent = `${Math.round(goalScale(o) * 100)}%`;
    }
    curvePanel.hidden = !p;
    document.getElementById('curveConvert').disabled = !p || !!p.curved;
    document.getElementById('curveStraight').disabled = !p || !p.curved;
    bendSlider.disabled = !p || !p.curved;
    bendSlider.value = String(Math.round(clamp(getBend(p), -160, 160) / 5) * 5);
    bendValue.textContent = p?.curved ? `${Math.round(getBend(p))} px` : 'Straight';
  }
  const basePanel = updateObjectPanel;
  updateObjectPanel = function (...args) {basePanel(...args);updatePanels();};

  // Selection handles are only rendered in the interactive editor, never in exported SVG/GIF.
  const baseRender = renderPitch;
  renderPitch = function(preview=null) {
    baseRender(preview);
    if (preview || playing || tool !== 'select') return;
    const p = getPath();
    if (!p || !p.curved) return;
    const points = {start: XY({x:p.x1,y:p.y1}), control: XY(visibleMidpoint(p)), end: XY({x:p.x2,y:p.y2})};
    const m = points.control;
    const a = points.start, b = points.end;
    pitch.insertAdjacentHTML('beforeend',
      `<g pointer-events="none"><path d="M ${a.x} ${a.y} L ${m.x} ${m.y} L ${b.x} ${b.y}" stroke="#ffe37d" stroke-dasharray="5 7" stroke-width="2" fill="none" opacity=".8"/></g>` +
      Object.entries(points).map(([name,v]) =>
        `<circle data-curve-handle="${name}" cx="${v.x}" cy="${v.y}" r="${name==='control'?13:10}" fill="${name==='control'?'#ffe16a':'#ffffff'}" stroke="#102951" stroke-width="3" class="curve-handle"/>`
      ).join(''));
  };

  function applyGoalScale(value) {
    const o = getObject();if (!isGoal(o))return;
    o.scale = clamp(Number(value) / 100, .5, 2.5);
    const p = limitItemPosition({x:o.x,y:o.y},o.type,o.rotation,o.scale);
    o.x = p.x;o.y = p.y;
    goalValue.textContent=`${Math.round(o.scale*100)}%`;
    commit();renderPitch();
  }
  goalSlider.addEventListener('pointerdown', () => {if(isGoal(getObject()))snapshot();});
  goalSlider.addEventListener('keydown', () => {if(isGoal(getObject()))snapshot();});
  goalSlider.addEventListener('input',e => applyGoalScale(e.target.value));
  goalPanel.addEventListener('click', e => {
    const b = e.target.closest('[data-goal-size]');if(!b || !isGoal(getObject()))return;
    const change=Number(b.dataset.goalSize);
    snapshot();
    applyGoalScale(change===100?100:Math.round(goalScale(getObject())*100)+change);
    goalSlider.value=Math.round(goalScale(getObject())*100);
  });

  function curveSelected(enable) {
    const p=getPath();if(!p || !!p.curved===enable)return;
    snapshot();
    if (enable) {const c=defaultControl(p);p.curved=true;p.cx=c.x;p.cy=c.y;}
    else {delete p.curved;delete p.cx;delete p.cy;}
    commit();updatePanels();renderPitch();
  }
  document.getElementById('curveConvert').onclick=()=>curveSelected(true);
  document.getElementById('curveStraight').onclick=()=>curveSelected(false);
  function applyBend(value) {
    const p=getPath();if(!p || !p.curved)return;
    setBend(p,clamp(Number(value),-160,160));
    bendValue.textContent=`${Math.round(getBend(p))} px`;
    commit();renderPitch();
  }
  bendSlider.addEventListener('pointerdown',()=>{if(getPath()?.curved)snapshot();});
  bendSlider.addEventListener('keydown',()=>{if(getPath()?.curved)snapshot();});
  bendSlider.addEventListener('input',e=>applyBend(e.target.value));
  document.getElementById('curveReverse').addEventListener('click',()=>{
    const p=getPath();if(!p?.curved)return;snapshot();applyBend(Math.abs(getBend(p))<5?-80:-getBend(p));updatePanels();
  });
  document.getElementById('curveMore').addEventListener('click',()=>{
    const p=getPath();if(!p?.curved)return;snapshot();
    const bend=getBend(p);applyBend(clamp(bend+(bend<0?-40:40),-160,160));updatePanels();
  });

  function curvedPreview(start,end,type) {
    const shape={x1:start.x,y1:start.y,x2:end.x,y2:end.y,type,curved:true};
    const bend=defaultControl(shape);shape.cx=bend.x;shape.cy=bend.y;
    return shape;
  }
  function showDrawingPreview() {
    if (!gesture || gesture.kind !== 'draw')return;
    const line=curvedPreview(gesture.start,gesture.end,gesture.type);
    renderPitch();
    pitch.insertAdjacentHTML('beforeend',pathMarkup({...line,id:'pro-preview'}));
  }

  // Capture before the v1 handler, preventing an accidental object from being
  // created when a new curve tool is active. Works with pointer + touch input.
  pitch.addEventListener('pointerdown', e => {
    if (playing || gesture || e.button>0)return;
    if (tool==='curve-pass'||tool==='curve-move') {
      const pt=bound(svgPoint(e));
      gesture={kind:'draw',id:e.pointerId,start:pt,end:pt,type:tool==='curve-pass'?'pass':'move'};
    } else if (tool==='select' && e.target.closest('[data-curve-handle]') && getPath()?.curved) {
      const handle=e.target.closest('[data-curve-handle]').dataset.curveHandle;
      const path=getPath();
      snapshot();
      gesture={kind:'edit',id:e.pointerId,handle,pathId:path.id,changed:false};
    } else return;
    try {pitch.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();e.stopImmediatePropagation();
  },true);
  pitch.addEventListener('pointermove', e => {
    if(!gesture||e.pointerId!==gesture.id)return;
    const p=bound(svgPoint(e));
    if(gesture.kind==='draw') {gesture.end=p;showDrawingPreview();}
    else {
      const line=currentFrame().paths.find(x=>x.id===gesture.pathId);
      if(line) {
        if(gesture.handle==='control'){setVisibleMidpoint(line,p);bendSlider.value=String(Math.round(clamp(getBend(line),-160,160)/5)*5);bendValue.textContent=`${Math.round(getBend(line))} px`;}
        if(gesture.handle==='start'){line.x1=p.x;line.y1=p.y;}
        if(gesture.handle==='end'){line.x2=p.x;line.y2=p.y;}
        gesture.changed=true;renderPitch();
      }
    }
    e.preventDefault();e.stopImmediatePropagation();
  },true);
  function endGesture(e) {
    if(!gesture||e.pointerId!==gesture.id)return;
    const g=gesture;gesture=null;
    if(g.kind==='draw') {
      if(Math.hypot((g.end.x-g.start.x)*8.6,(g.end.y-g.start.y)*5.2)>20) {
        snapshot();
        const line={id:uid(),...curvedPreview(g.start,g.end,g.type)};
        currentFrame().paths.push(line);
        selectedPath=line.id;selectedId=null;
        commit();setTool('select');updateObjectPanel();renderPitch();
      } else {renderPitch();toast('Drag across the pitch to draw a curved arrow.');}
    } else {
      if(g.changed)commit();else undoStack.pop();
      renderPitch();
    }
    e.preventDefault();e.stopImmediatePropagation();
  }
  pitch.addEventListener('pointerup',endGesture,true);
  pitch.addEventListener('pointercancel',endGesture,true);

  // CoachTomAsh v1.6.4: independent formation-v-formation templates.
  // A template is a set of horizontal pitch lines, each with named shirt numbers.
  // Every template contains eleven distinct numbers. Team 2 mirrors X positions,
  // placing its goalkeeper on the right and its forwards facing Team 1.
  const FORMATIONS = Object.freeze({
    '4-3-3': [['1'],['3','4','5','2'],['8','6','10'],['11','9','7']],
    '4-4-2': [['1'],['3','4','5','2'],['11','8','6','7'],['10','9']],
    '4-2-3-1': [['1'],['3','4','5','2'],['8','6'],['11','10','7'],['9']],
    '4-1-4-1': [['1'],['3','4','5','2'],['6'],['11','8','10','7'],['9']],
    '3-5-2': [['1'],['3','4','5'],['11','8','6','10','2'],['9','7']],
    '3-4-3': [['1'],['3','4','5'],['11','8','6','2'],['10','9','7']],
    '5-3-2': [['1'],['3','4','5','2','7'],['11','6','8'],['10','9']],
    '4-5-1': [['1'],['3','4','5','2'],['11','8','6','10','7'],['9']],
    '4-3-1-2': [['1'],['3','4','5','2'],['11','6','8'],['10'],['9','7']],
    '3-4-2-1': [['1'],['3','4','5'],['11','8','6','2'],['10','7'],['9']],
    '4-4-1-1': [['1'],['3','4','5','2'],['11','8','6','7'],['10'],['9']]
  });
  const COLOURS = [
    ['Navy','#1a2b5f'],['Crimson','#c8102e'],['White','#ffffff'],
    ['Yellow','#ffcf48'],['Blue','#229be5'],['Black','#141923'],
    ['Orange','#f97316'],['Green','#16a34a'],['Purple','#7c3aed'],
    ['Sky','#38bdf8'],['Pink','#ec4899'],['Maroon','#7f1d1d'],
    ['Turquoise','#0d9488'],['Lime','#a3e635'],['Grey','#64748b'],['Gold','#eab308']
  ];
  const colourNames = new Map(COLOURS.map(([name,code])=>[code,name]));
  const FORMATION_COLOR_KEY='coachtomash-formation-colour';
  const FORMATION_2_COLOR_KEY='coachtomash-formation-2-colour';
  const FORMATION_1_PRESET_KEY='coachtomash-formation-1-preset';
  const FORMATION_2_PRESET_KEY='coachtomash-formation-2-preset';
  const color1=document.getElementById('formationColorSelect');
  const color2=document.getElementById('formation2ColorSelect');
  const preset1=document.getElementById('formationPresetSelect');
  const preset2=document.getElementById('formation2PresetSelect');
  const colourLabels=[document.getElementById('formationColourLabel'),document.getElementById('formation2ColourLabel')];
  const colourSwatches=[document.getElementById('formationColourSwatch'),document.getElementById('formation2ColourSwatch')];
  const presetLabels=[document.getElementById('formation1Label'),document.getElementById('formation2Label')];
  const colourInputs=[color1,color2],presetInputs=[preset1,preset2];
  const validColour=c=>colourNames.has(String(c||'').toLowerCase())?String(c).toLowerCase():'#1a2b5f';
  const validPreset=p=>Object.hasOwn(FORMATIONS,p)?p:'4-3-3';
  const getPref=(key,fallback)=>{try{return localStorage.getItem(key)||fallback}catch(_){return fallback}};
  const setPref=(key,value)=>{try{localStorage.setItem(key,value)}catch(_){}};
  const colorKeys=[FORMATION_COLOR_KEY,FORMATION_2_COLOR_KEY];
  const presetKeys=[FORMATION_1_PRESET_KEY,FORMATION_2_PRESET_KEY];
  for(const el of colourInputs)el.innerHTML=COLOURS.map(([n,c])=>'<option value="'+c+'">'+n+'</option>').join('');
  for(const el of presetInputs)el.innerHTML=Object.keys(FORMATIONS).map(n=>'<option value="'+n+'">'+n+'</option>').join('');
  color1.value=validColour(getPref(colorKeys[0],playerColor));
  color2.value=validColour(getPref(colorKeys[1],'#c8102e'));
  preset1.value=validPreset(getPref(presetKeys[0],'4-3-3'));
  preset2.value=validPreset(getPref(presetKeys[1],'4-4-2'));

  function showFormationChoice(team) {
    const i=team-1;
    const c=validColour(colourInputs[i].value);
    const p=validPreset(presetInputs[i].value);
    colourInputs[i].value=c;presetInputs[i].value=p;
    colourLabels[i].textContent=colourNames.get(c);
    colourSwatches[i].style.backgroundColor=c;
    presetLabels[i].textContent=p;
    setPref(colorKeys[i],c);setPref(presetKeys[i],p);
  }
  color1.addEventListener('change',()=>{showFormationChoice(1);playerColor=color1.value;updateObjectPanel();});
  color2.addEventListener('change',()=>showFormationChoice(2));
  preset1.addEventListener('change',()=>showFormationChoice(1));
  preset2.addEventListener('change',()=>showFormationChoice(2));
  document.getElementById('swatches').addEventListener('click',e=>{
    const b=e.target.closest('button[data-color]');
    if(b){color1.value=validColour(b.dataset.color);showFormationChoice(1);}
  });
  showFormationChoice(1);showFormationChoice(2);
  playerColor=color1.value;updateObjectPanel();

  function templatePositions(preset,team){
    const rows=FORMATIONS[validPreset(preset)];
    // Position lines in approximately realistic thirds, preserving a usable
    // balance in the compact pitch editor. Attacking lines are mirrored for T2.
    const xLines=rows.length===4?[9,27,43,78]:[9,25,41,62,83];
    return rows.flatMap((labels,index)=>labels.map((label,j)=>({
      label,
      x:team===2?100-xLines[index]:xLines[index],
      y:labels.length===1?50:11+j*78/(labels.length-1)
    })));
  }
  function addFormationToFrame(team){
    const i=team-1;
    const preset=validPreset(presetInputs[i].value),colour=validColour(colourInputs[i].value);
    const newId=uid();
    const objects=templatePositions(preset,team).map(pt=>({
      id:uid(),type:team===2?'opponent':'player',x:pt.x,y:pt.y,label:pt.label,
      color:colour,formationId:newId,formationType:preset,formationTeam:team
    }));
    currentFrame().objects.push(...objects);
    return {preset,colour,objects};
  }
  function addFormation(team){
    if(playing)stopPlayback();
    snapshot();const result=addFormationToFrame(team);
    selectedId=null;selectedPath=null;commit();refresh();
    toast(`Added Team ${team}: ${result.preset} · ${colourNames.get(result.colour)} (11 players)`);
  }
  function recolourFormation(team){
    if(playing)stopPlayback();
    const colour=validColour(colourInputs[team-1].value), objects=currentFrame().objects;
    const role=team===2?'opponent':'player';
    // Prefer last tagged formation belonging to this team. Older v1.6.3
    // formations have no formationTeam field, but always have type=player.
    const last=[...objects].reverse().find(o=>o.formationId&&
      (o.formationTeam===team||(team===1&&o.formationTeam==null&&o.type==='player')));
    let targets=last?objects.filter(o=>o.formationId===last.formationId&&o.type===role):[];
    if(!targets.length && team===1){
      // Explicit safe legacy fallback: only exactly one untagged 1–11 set.
      const untagged=objects.filter(o=>o.type==='player'&&!o.formationId&&/^(?:[1-9]|10|11)$/.test(String(o.label)));
      if(untagged.length===11&&new Set(untagged.map(o=>String(o.label))).size===11)targets=untagged;
    }
    if(targets.length!==11){toast('No unambiguous Team '+team+' formation found on this frame. Add one first.');return;}
    snapshot();for(const o of targets)o.color=colour;
    commit();refresh();toast('Recoloured Team '+team+' '+colourNames.get(colour));
  }
  document.getElementById('add433').onclick=()=>addFormation(1);
  document.getElementById('addTeam2').onclick=()=>addFormation(2);
  document.getElementById('recolour433').onclick=()=>recolourFormation(1);
  document.getElementById('recolourTeam2').onclick=()=>recolourFormation(2);
  document.getElementById('addBothFormations').onclick=()=>{
    if(playing)stopPlayback();
    snapshot();const a=addFormationToFrame(1),b=addFormationToFrame(2);
    selectedId=null;selectedPath=null;commit();refresh();
    toast('Added Team 1 '+a.preset+' v Team 2 '+b.preset+' (22 players)');
  };
  window.CTAProEditor={defaultControl,goalScale,positions:templatePositions('4-3-3',1).map(({label,x,y})=>[label,x,y]),
    visibleMidpoint,setVisibleMidpoint,getBend,setBend,FORMATION_PRESETS:FORMATIONS,templatePositions,
    addFormationToFrame};
  updatePanels();
})();
