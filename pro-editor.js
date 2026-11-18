/* CoachTomAsh Studio v1.6 | Pro Diagram Designer
 * Additive properties: object.scale (goals), object.groupId, path.curved/cx/cy.
 * Older drills do not need migration. Everything remains in the v1 storage schema.
 */
(() => {
  'use strict';
  const goalPanel = document.getElementById('goalSizePanel');
  const goalSlider = document.getElementById('goalScale');
  const goalValue = document.getElementById('goalScaleValue');
  const curvePanel = document.getElementById('curvePanel');
  let gesture = null;
  const getObject = () => currentFrame().objects.find(o => o.id === selectedId);
  const getPath = () => currentFrame().paths.find(p => p.id === selectedPath);
  const isGoal = o => o && ['goal', 'fullgoal'].includes(o.type);
  const goalScale = o => clamp(Number(o?.scale) || 1, .5, 2.5);
  const bound = point => ({x: clamp(point.x, 0, 100), y: clamp(point.y, 0, 100)});

  function defaultControl(path) {
    const vx = path.x2 - path.x1, vy = path.y2 - path.y1;
    const length = Math.hypot(vx * 8.6, vy * 5.2) || 1;
    const bend = Math.min(18, Math.max(7, length / 20));
    return bound({x: (path.x1 + path.x2) / 2 - vy * 5.2 / length * bend,
                  y: (path.y1 + path.y2) / 2 + vx * 8.6 / length * bend});
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
    const points = {start: XY({x:p.x1,y:p.y1}), control: XY({x:p.cx,y:p.cy}), end: XY({x:p.x2,y:p.y2})};
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
        if(gesture.handle==='control'){line.cx=p.x;line.cy=p.y;}
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
    ['GK',9,50],['LB',28,14],['LCB',24,38],['RCB',24,62],['RB',28,86],
    ['8',49,27],['6',44,50],['10',49,73],['LW',77,15],['9',81,50],['RW',77,85]
  ];
  document.getElementById('add433').onclick=()=>{
    if(playing)stopPlayback();
    snapshot();
    for(const [label,x,y] of positions) {
      currentFrame().objects.push({id:uid(),type:'player',x,y,label,color:'#1a2b5f'});
    }
    selectedId=null;selectedPath=null;commit();refresh();
    toast('4-3-3 created with 11 editable players');
  };
  window.CTAProEditor={defaultControl,goalScale,positions};
  updatePanels();
})();
