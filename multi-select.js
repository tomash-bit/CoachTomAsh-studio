/* CoachTomAsh Studio v1.5: additive touch-friendly multi-selection.
   No change to drill schema or SVG export format. */
(() => {
  'use strict';
  const toggle=document.getElementById('multiSelectMode');
  const controls=document.getElementById('multiSelectPanel');
  const counter=document.getElementById('multiSelectCount');
  if(!toggle || !controls)return;
  const selected=new Set();
  let enabled=false, pointer=null;
  const objectList=()=>currentFrame().objects;
  const getObject=id=>objectList().find(o=>o.id===id);
  function selectedObjects(){return objectList().filter(o=>selected.has(o.id));}
  function reset(){selected.clear();pointer=null;selectedId=null;selectedPath=null;renderPitch();updateControls();}
  function updateControls(){
    for (const id of [...selected])if(!getObject(id))selected.delete(id);
    counter.textContent=`${selected.size} selected`;
    controls.hidden=!enabled;
    toggle.classList.toggle('primary',enabled);
    toggle.setAttribute('aria-pressed',String(enabled));
    const active=selected.size>=2;
    controls.querySelectorAll('[data-group-action]').forEach(b=>b.disabled=!active);
    document.getElementById('multiSelectHint').textContent=enabled ?
      (selected.size>=2?'Drag any selected object to move them together.':'Tap objects or drag across the pitch to select several.') :
      'Enable multi-select to choose more than one object.';
  }
  function showRings(){
    for(const o of selectedObjects()){
      const point=XY(o);
      pitch.insertAdjacentHTML('beforeend',`<circle class="multi-selection-ring" cx="${point.x}" cy="${point.y}" r="27" fill="none" stroke="#ffe066" stroke-width="3.5" stroke-dasharray="7 4" pointer-events="none"/>`);
    }
  }
  const normalRender=renderPitch;
  renderPitch=function(...args){normalRender(...args);if(enabled&&!playing)showRings();};
  function syncSelection(){
    selectedId=selected.size===1?[...selected][0]:null;
    selectedPath=null;
    updateObjectPanel();updateControls();renderPitch();
  }
  function setEnabled(on){enabled=!!on;selected.clear();pointer=null;if(enabled&&tool!=='select')setTool('select');if(enabled&&selectedId)selected.add(selectedId);syncSelection();}
  toggle.addEventListener('click',()=>setEnabled(!enabled));
  document.getElementById('multiSelectClear').addEventListener('click',()=>{selected.clear();syncSelection();});
  const oldSetTool=setTool;
  setTool=function(value){oldSetTool(value);if(value!=='select'&&enabled)setEnabled(false);};
  const oldSelectDrill=selectDrill;
  selectDrill=function(id){selected.clear();setEnabled(false);oldSelectDrill(id);};

  function pointerCoordinates(event){return svgPoint(event);}
  function isMulti(event){return !playing&&tool==='select'&&(enabled||event.shiftKey);}
  // Capture prevents the original single-item drag handler from moving just one item.
  pitch.addEventListener('pointerdown',event=>{
    if(!isMulti(event)||event.button>0)return;
    if(!enabled)setEnabled(true);
    const id=itemAt(event,'data-oid');
    const p=pointerCoordinates(event);
    if(id){
      const wasSelected=selected.has(id);
      if(!wasSelected) selected.add(id);
      // Persistent equipment groups are selected as one unit on touch devices.
      const clicked=getObject(id);
      if(clicked?.groupId)for(const o of objectList())if(o.groupId===clicked.groupId)selected.add(o.id);
      pointer={id:event.pointerId,mode:'items',start:p,positions:selectedObjects().map(o=>({id:o.id,x:o.x,y:o.y})),
        tappedId:id,moved:false,wasSelected};
    } else {
      if(!event.shiftKey)selected.clear();
      pointer={id:event.pointerId,mode:'marquee',start:p,last:p,moved:false};
    }
    syncSelection();
    try{pitch.setPointerCapture(event.pointerId);}catch(_){}
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  function groupDelta(desiredX,desiredY){
    let dx=desiredX,dy=desiredY;
    for(const start of pointer.positions){
      const o=getObject(start.id);if(!o)continue;
      const limited=limitItemPosition({x:start.x+desiredX,y:start.y+desiredY},o.type,o.rotation,o.scale);
      const allowedX=limited.x-start.x,allowedY=limited.y-start.y;
      dx=desiredX>=0?Math.min(dx,allowedX):Math.max(dx,allowedX);
      dy=desiredY>=0?Math.min(dy,allowedY):Math.max(dy,allowedY);
    }
    return {dx,dy};
  }
  pitch.addEventListener('pointermove',event=>{
    if(!pointer||event.pointerId!==pointer.id)return;
    const p=pointerCoordinates(event);
    if(pointer.mode==='items'){
      const diffX=p.x-pointer.start.x,diffY=p.y-pointer.start.y;
      if(!pointer.moved && Math.hypot(diffX,diffY)>0.8) {snapshot();pointer.moved=true;}
      if(pointer.moved){
        const {dx,dy}=groupDelta(diffX,diffY);
        for(const base of pointer.positions){const o=getObject(base.id);if(o){o.x=base.x+dx;o.y=base.y+dy;}}
        renderPitch();
      }
    } else {
      pointer.last=p;
      if(Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>1)pointer.moved=true;
      renderPitch();
      if(pointer.moved){
        const a=XY(pointer.start),b=XY(p);
        pitch.insertAdjacentHTML('beforeend',`<rect class="multi-marquee" x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(b.x-a.x)}" height="${Math.abs(b.y-a.y)}" rx="3" fill="#ffe066" fill-opacity=".12" stroke="#ffe066" stroke-width="2" stroke-dasharray="8 5" pointer-events="none"/>`);
      }
    }
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  function endPointer(event){
    if(!pointer||event.pointerId!==pointer.id)return;
    const p=pointer;pointer=null;
    if(p.mode==='items'){
      if(p.moved){commit();}
      else if(selected.size>1 && selected.has(p.tappedId) && p.positions.some(x=>x.id===p.tappedId)){
        // A second tap on an already selected object removes it from the group.
        // Single selection remains selected for convenient initial taps.
        if(p.wasSelected)selected.delete(p.tappedId);
      }
    } else if(p.moved){
      const x1=Math.min(p.start.x,p.last.x),x2=Math.max(p.start.x,p.last.x);
      const y1=Math.min(p.start.y,p.last.y),y2=Math.max(p.start.y,p.last.y);
      for(const o of objectList())if(o.x>=x1&&o.x<=x2&&o.y>=y1&&o.y<=y2)selected.add(o.id);
    }
    syncSelection();
    event.preventDefault();event.stopImmediatePropagation();
  }
  pitch.addEventListener('pointerup',endPointer,true);
  pitch.addEventListener('pointercancel',endPointer,true);
  function groupMutation(transform){
    const entries=selectedObjects();if(entries.length<2)return;
    stopPlayback();snapshot();transform(entries);commit();syncSelection();
  }
  function align(action){
    groupMutation(objects=>{
      const xs=objects.map(o=>o.x),ys=objects.map(o=>o.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const averageX=xs.reduce((a,b)=>a+b,0)/xs.length,averageY=ys.reduce((a,b)=>a+b,0)/ys.length;
      if(action==='distribute-x'||action==='distribute-y'){
        const axis=action==='distribute-x'?'x':'y';const sorted=[...objects].sort((a,b)=>a[axis]-b[axis]);
        const low=sorted[0][axis],high=sorted[sorted.length-1][axis];
        sorted.forEach((o,i)=>{const desired={x:o.x,y:o.y};desired[axis]=low+(high-low)*i/(sorted.length-1);const bounded=limitItemPosition(desired,o.type,o.rotation,o.scale);o.x=bounded.x;o.y=bounded.y;});
      }else {
        for(const o of objects){const wanted={x:o.x,y:o.y};
          if(action==='left')wanted.x=minX;
          if(action==='center-x')wanted.x=averageX;
          if(action==='right')wanted.x=maxX;
          if(action==='top')wanted.y=minY;
          if(action==='center-y')wanted.y=averageY;
          if(action==='bottom')wanted.y=maxY;
          const limited=limitItemPosition(wanted,o.type,o.rotation,o.scale);o.x=limited.x;o.y=limited.y;
        }
      }
    });
  }
  function duplicateGroup(){groupMutation(objects=>{
    const newGroupIds=new Map();
    const clones=objects.map(o=>{
      const newO=copy(o);newO.id=uid();if(newO.groupId){if(!newGroupIds.has(newO.groupId))newGroupIds.set(newO.groupId,uid());newO.groupId=newGroupIds.get(newO.groupId);}const p=limitItemPosition({x:o.x+5,y:o.y+5},o.type,o.rotation,o.scale);newO.x=p.x;newO.y=p.y;return newO;
    });
    objectList().push(...clones);
    selected.clear();clones.forEach(o=>selected.add(o.id));
  });}
  function persistGroup(){groupMutation(objects=>{const groupId=uid();objects.forEach(o=>o.groupId=groupId);});}
  function removeGroup(){groupMutation(objects=>{objects.forEach(o=>delete o.groupId);});}
  function rotateGroup(degrees){groupMutation(objects=>{
    const cx=objects.reduce((sum,o)=>sum+o.x,0)/objects.length;
    const cy=objects.reduce((sum,o)=>sum+o.y,0)/objects.length;
    const rad=degrees*Math.PI/180,cos=Math.cos(rad),sin=Math.sin(rad);
    objects.forEach(o=>{
      const dx=(o.x-cx)*8.6,dy=(o.y-cy)*5.2;
      const wanted={x:cx+(dx*cos-dy*sin)/8.6,y:cy+(dx*sin+dy*cos)/5.2};
      const rotation=normalizeRotation(o.rotation||0)+degrees;
      const limited=limitItemPosition(wanted,o.type,rotation,o.scale);
      o.x=limited.x;o.y=limited.y;
      if(ROTATABLE_TYPES.has(o.type))o.rotation=normalizeRotation(rotation);
    });
  });}
  function deleteGroup(){groupMutation(objects=>{
    const ids=new Set(objects.map(o=>o.id));currentFrame().objects=currentFrame().objects.filter(o=>!ids.has(o.id));selected.clear();
  });}
  controls.addEventListener('click',event=>{
    const button=event.target.closest('[data-group-action]');if(!button || button.disabled)return;
    const action=button.dataset.groupAction;
    if(action==='duplicate')duplicateGroup();else if(action==='delete')deleteGroup();else if(action==='group')persistGroup();else if(action==='ungroup')removeGroup();else if(action==='rotate-ccw')rotateGroup(-15);else if(action==='rotate-cw')rotateGroup(15);else align(action);
  });
  // The original delete/duplicate buttons also work with groups.
  for(const [id,action] of [['deleteBtn',deleteGroup],['duplicateBtn',duplicateGroup]]){
    document.getElementById(id).addEventListener('click',event=>{
      if(enabled&&selected.size>=2){event.preventDefault();event.stopImmediatePropagation();action();}
    },true);
  }
  window.addEventListener('keydown',event=>{
    const tag=document.activeElement?.tagName;
    if(['INPUT','TEXTAREA','SELECT'].includes(tag) || activeTab!=='design')return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){
      event.preventDefault();event.stopImmediatePropagation();enabled=true;selected.clear();objectList().forEach(o=>selected.add(o.id));syncSelection();
    }
    if(enabled&&selected.size>=2&&['Backspace','Delete'].includes(event.key)){
      event.preventDefault();event.stopImmediatePropagation();deleteGroup();
    }
  },true);
  updateControls();
  window.CTAMultiSelect={selectedIds:()=>[...selected],isEnabled:()=>enabled,enable:setEnabled,align,group:persistGroup,ungroup:removeGroup,rotate:rotateGroup};
})();
