/* CoachTomAsh Studio v1.6.3 | Explicit colour selector and formation recolour
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

  // One action creates a ready-to-edit 4-3-3, but never overwrites existing objects.
  const positions = [
    ['1',9,50],['3',28,14],['4',24,38],['5',24,62],['2',28,86],
    ['8',49,27],['6',44,50],['10',49,73],['11',77,15],['9',81,50],['7',77,85]
  ];
  // A visible, independent formation colour prevents ambiguous swatch selection
  // and guarantees that an older cached app-core script cannot force navy.
  const colourSelect = document.getElementById('formationColorSelect');
  const formationColourLabel = document.getElementById('formationColourLabel');
  const formationColourSwatch = document.getElementById('formationColourSwatch');
  const colourNames = new Map([
    ['#1a2b5f','Navy'], ['#c8102e','Crimson'], ['#ffffff','White'],
    ['#ffcf48','Yellow'], ['#229be5','Blue']
  ]);
  const FORMATION_COLOR_KEY = 'coachtomash-formation-colour';
  function validColour(c) {
    const hex=String(c||'').toLowerCase();
    return colourNames.has(hex) ? hex : '#1a2b5f';
  }
  let formationChoice = validColour(playerColor);
  try { const saved=localStorage.getItem(FORMATION_COLOR_KEY); if(saved)formationChoice=validColour(saved); } catch(e) {}
  function showColour(c) {
    formationChoice=validColour(c);
    colourSelect.value=formationChoice;
    formationColourSwatch.style.backgroundColor=formationChoice;
    formationColourLabel.textContent=colourNames.get(formationChoice);
    try {localStorage.setItem(FORMATION_COLOR_KEY,formationChoice);} catch(e) {}
  }
  // Swatch selection updates both individual-player colour and formation colour.
  // Handle this directly: it works even when a previous object was selected.
  document.getElementById('swatches').addEventListener('click', e => {
    const b=e.target.closest('button[data-color]');
    if(b)showColour(b.dataset.color);
  });
  colourSelect.addEventListener('change', () => {
    showColour(colourSelect.value);
    playerColor=formationChoice; // New manually placed players match the formation choice.
    updateObjectPanel();
  });
  showColour(formationChoice);
  document.getElementById('add433').onclick=()=>{
    if(playing)stopPlayback();
    // Read the visible selector at the exact moment the coach presses Add.
    // The playerColor variable is intentionally not the source of truth here.
    const chosenColor=validColour(colourSelect.value);
    showColour(chosenColor);
    snapshot();
    const formationId=uid();
    for(const [label,x,y] of positions) {
      currentFrame().objects.push({id:uid(),type:'player',x,y,label,color:chosenColor,formationId,formationType:'4-3-3'});
    }
    selectedId=null;selectedPath=null;commit();refresh();
    toast('Added eleven '+colourNames.get(chosenColor)+' shirts (1–11)');
  };
  document.getElementById('recolour433').onclick=()=>{
    if(playing)stopPlayback();
    const chosenColor=validColour(colourSelect.value);
    const f=currentFrame();
    // Safely prefer the most recently added tagged formation.
    const lastTagged=[...f.objects].reverse().find(o=>o.type==='player'&&o.formationId&&o.formationType==='4-3-3');
    let targets=lastTagged?f.objects.filter(o=>o.formationId===lastTagged.formationId&&o.type==='player'):[];
    if(!targets.length){
      // Legacy v1.6 formations were untagged. Only recolour if exactly one
      // complete 1–11 set is present. Never recolour unrelated practice players.
      const numbered=f.objects.filter(o=>o.type==='player'&&/^(?:[1-9]|10|11)$/.test(String(o.label)));
      if(numbered.length===11&&new Set(numbered.map(o=>String(o.label))).size===11)targets=numbered;
    }
    if(targets.length!==11){
      toast('No single 4-3-3 detected here. Add a new 4-3-3 or open a frame with eleven numbered shirts.');
      return;
    }
    snapshot();
    for(const o of targets)o.color=chosenColor;
    commit();refresh();
    toast('Recoloured eleven 4-3-3 shirts '+colourNames.get(chosenColor));
  };
  window.CTAProEditor={defaultControl,goalScale,positions,visibleMidpoint,setVisibleMidpoint,getBend,setBend};
  updatePanels();
})();
