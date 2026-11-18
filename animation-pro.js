/* CoachTomAsh Studio v1.7 Animation Pro.
 * Backward-compatible transition metadata stored in the DESTINATION frame:
 *   frames[i+1].motion = { durationMs:1600, actions:{[objectId]:{bend,delay,duration,ease}} }
 * Existing frames without motion are unchanged. No CDN, paid API or external service.
 */
'use strict';
(() => {
  const $id=id=>document.getElementById(id);
  const durationEl=$id('animDuration');
  if (!durationEl || typeof tweenFrames !== 'function') return;
  const bendEl=$id('animBend'), delayEl=$id('animDelay'), lenEl=$id('animActionLength'), easeEl=$id('animEase');
  const panel=$id('animObjectControls');
  const allowedEase=new Set(['linear','smooth','ease-in','ease-out']);
  const limit=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)||0));
  const same=(id,frame)=>frame?.objects?.find(o=>o.id===id);
  const isMovable=o=>o && ['player','opponent','neutral','ball','mannequin'].includes(o.type);
  const motionFor=(to,create=false)=>{
    if(!to)return null;
    if(create&&!to.motion)to.motion={durationMs:1600,actions:{}};
    if(create&&!to.motion.actions)to.motion.actions={};
    return to.motion||null;
  };
  function segmentMs(frames,index){
    const ms=Number(frames?.[index+1]?.motion?.durationMs);
    return Number.isFinite(ms)&&ms>=400&&ms<=10000?ms:1600;
  }
  function actionDefaults(){return {bend:0,delay:0,duration:100,ease:'linear'};}
  function getAction(target,id){return {...actionDefaults(),...(target?.motion?.actions?.[id]||{})};}
  function quadratic(a,b,c,t){const v=1-t;return v*v*a+2*v*t*b+t*t*c;}
  function progressAt(raw,action){
    const delay=limit(action.delay,0,85)/100;
    const duration=Math.min(limit(action.duration,15,100)/100,1-delay);
    let u=limit((raw-delay)/duration,0,1);
    const ease=allowedEase.has(action.ease)?action.ease:'linear';
    if(ease==='smooth')u=u*u*(3-2*u);
    if(ease==='ease-in')u=u*u;
    if(ease==='ease-out')u=1-(1-u)*(1-u);
    return u;
  }
  function curvePoint(from,to,bend,t){
    const dx=to.x-from.x,dy=to.y-from.y;
    const distance=Math.hypot(dx,dy);
    if(distance<.001 || !Number(bend))return {x:from.x+dx*t,y:from.y+dy*t};
    // The requested bend measures the deviation at the visible midpoint.
    const offset=limit(bend,-100,100)/100*Math.min(24,Math.max(5,distance*.35));
    const cx=(from.x+to.x)/2+(-dy/distance)*offset*2;
    const cy=(from.y+to.y)/2+(dx/distance)*offset*2;
    return {x:quadratic(from.x,cx,to.x,t),y:quadratic(from.y,cy,to.y,t)};
  }
  const legacyTween=tweenFrames;
  function tweenPro(from,to,t){
    const result=legacyTween(from,to,t);
    const actions=to?.motion?.actions;
    if(!actions||!Object.keys(actions).length)return result;
    const starts=new Map(from.objects.map(o=>[o.id,o]));
    const ends=new Map(to.objects.map(o=>[o.id,o]));
    for(const object of result.objects){
      const start=starts.get(object.id),end=ends.get(object.id),action=actions[object.id];
      if(!start||!end||!action||!isMovable(start))continue;
      const u=progressAt(t,action);
      const point=curvePoint(start,end,action.bend,u);
      object.x=point.x;
      object.y=point.y;
    }
    return result;
  }
  tweenFrames=tweenPro;
  window.CTAAnimationPro={segmentMs,tween:tweenPro,curvePoint,progressAt,getAction};

  const toFrame=()=>current().frames[frameIndex+1]||null;
  const fromObject=()=>same(selectedId,currentFrame());
  function selectedForTransition(){
    const object=fromObject(),target=toFrame();
    return target && isMovable(object) && same(object.id,target) ? object : null;
  }
  function renderActionList(){
    const next=toFrame();const container=$id('animActionList');
    if(!next){container.innerHTML='';return;}
    const moving=currentFrame().objects.filter(o=>isMovable(o)&&same(o.id,next))
      .filter(o=>{const end=same(o.id,next);return Math.hypot(end.x-o.x,end.y-o.y)>.2||!!next.motion?.actions?.[o.id];})
      .sort((a,b)=>Number(b.type==='ball')-Number(a.type==='ball'));
    if(!moving.length){container.innerHTML='<span class="hint">Move players or the ball in the next frame to create a sequence.</span>';return;}
    container.innerHTML=moving.slice(0,18).map(o=>{
      const action=getAction(next,o.id),delay=limit(action.delay,0,85),duration=Math.min(100-delay,limit(action.duration,15,100));
      const name=o.type==='ball'?'Ball':(o.label||o.type);
      return `<button type="button" class="animpro-track${o.id===selectedId?' active':''}" data-motion-object="${esc(o.id)}" title="Edit ${esc(name)} movement"><span class="animpro-track-name">${esc(name)}</span><span class="animpro-track-lane"><span class="animpro-track-fill" style="left:${delay}%;width:${duration}%;background:${o.type==='ball'?'#c8102e':'#1a2b5f'}"></span></span><span class="animpro-track-time">${delay}%</span></button>`;
    }).join('')+(moving.length>18?'<span class="hint">Showing first 18 moving markers.</span>':'');
  }
  $id('animActionList').addEventListener('click',e=>{
    const b=e.target.closest('[data-motion-object]');if(!b)return;
    setTool('select');setSelection(b.dataset.motionObject,null);refreshControls();
  });
  function refreshControls(){
    const next=toFrame(),selected=selectedForTransition();
    const can=!!next;
    $id('animStepName').textContent=can?`Frame ${frameIndex+1} → ${frameIndex+2}`:'Last frame';
    $id('animStepInfo').textContent=can?'Settings apply to the transition ahead':'Add another frame to animate movement';
    durationEl.disabled=!can;
    durationEl.value=String(can?segmentMs(current().frames,frameIndex):1600);
    renderActionList();
    panel.hidden=!selected;
    $id('animPickBall').disabled=!can;
    document.querySelectorAll('[data-sequence]').forEach(b=>b.disabled=!can);
    if(!selected){
      $id('animObjectName').textContent=can?'Tap a player or ball to edit its movement':'No next frame yet';
      return;
    }
    const action=getAction(next,selected.id);
    $id('animObjectName').textContent=`${selected.type==='ball'?'⚽ Ball':selected.type==='opponent'?'Opponent':selected.type==='neutral'?'Neutral':'Player'} ${selected.label||''}`.trim();
    bendEl.value=String(limit(action.bend,-100,100));
    delayEl.value=String(limit(action.delay,0,85));
    lenEl.max=String(100-limit(action.delay,0,85));
    lenEl.value=String(Math.min(limit(action.duration,15,100),100-limit(action.delay,0,85)));
    easeEl.value=allowedEase.has(action.ease)?action.ease:'linear';
    refreshValues();
  }
  function refreshValues(){
    $id('animBendValue').textContent=bendEl.value==='0'?'Straight':String(bendEl.value);
    $id('animDelayValue').textContent=delayEl.value+'%';
    $id('animActionLengthValue').textContent=lenEl.value+'%';
  }
  [bendEl,delayEl,lenEl].forEach(el=>el.addEventListener('input',refreshValues));
  durationEl.addEventListener('change',()=>{
    const next=toFrame();if(!next)return;
    snapshot();motionFor(next,true).durationMs=limit(durationEl.value,400,10000);
    commit();refreshControls();toast('Transition timing saved.');
  });
  const settings={animBend:['bend',-100,100],animDelay:['delay',0,85],animActionLength:['duration',15,100],animEase:['ease',0,0]};
  for (const [id,[key,min,max]] of Object.entries(settings)){
    $id(id).addEventListener('change',()=>{
      const chosen=selectedForTransition(),next=toFrame();if(!chosen||!next)return;
      snapshot();
      const motion=motionFor(next,true);
      const existing=motion.actions[chosen.id]||{...actionDefaults()};
      existing[key]=key==='ease'?(allowedEase.has(easeEl.value)?easeEl.value:'linear'):limit($id(id).value,min,max);
      if(key==='delay')existing.duration=Math.min(Number(existing.duration)||100,100-existing.delay);
      motion.actions[chosen.id]=existing;
      commit();refreshControls();renderPitch();
    });
  }
  $id('animResetObject').addEventListener('click',()=>{
    const chosen=selectedForTransition(),next=toFrame();if(!chosen||!next)return;
    snapshot();if(next.motion?.actions)delete next.motion.actions[chosen.id];
    commit();refreshControls();renderPitch();toast('Selected movement restored to straight, simultaneous motion.');
  });
  $id('animPickBall').addEventListener('click',()=>{
    const ball=currentFrame().objects.find(o=>o.type==='ball'&&same(o.id,toFrame()));
    if(!ball){toast('Place a ball in both frames. Duplicate the frame before moving it.');return;}
    setTool('select');setSelection(ball.id,null);refreshControls();
  });
  document.querySelectorAll('[data-sequence]').forEach(b=>b.addEventListener('click',()=>{
    const next=toFrame();if(!next)return;
    const option=b.dataset.sequence;
    const objects=currentFrame().objects.filter(o=>isMovable(o)&&same(o.id,next));
    if(!objects.length){toast('Add players or a ball in both frames first.');return;}
    snapshot();const motion=motionFor(next,true);
    let index=0;const moving=objects.filter(o=>o.type!=='ball');
    for(const o of objects){
      const prev=motion.actions[o.id]||{...actionDefaults()};
      let delay=0,duration=100;
      if(option==='ball-first'){delay=o.type==='ball'?0:40;duration=o.type==='ball'?40:60;}
      if(option==='players-first'){delay=o.type==='ball'?55:0;duration=o.type==='ball'?45:65;}
      if(option==='staggered'){delay=o.type==='ball'?0:Math.min(75,Math.round(index++*75/Math.max(1,moving.length)));duration=o.type==='ball'?35:40;}
      motion.actions[o.id]={...prev,delay,duration};
    }
    commit();refreshControls();renderPitch();toast('Action sequence saved: '+b.textContent.trim());
  }));

  // The motion guide is visible only in the editor, never in print/PNG/SVG/GIF exports.
  const previousRender=renderPitch;
  renderPitch=function(preview=null){
    previousRender(preview);
    if(preview||playing||tool!=='select')return;
    const object=selectedForTransition(),next=toFrame();
    if(!object||!next)return;
    const end=same(object.id,next),opts=getAction(next,object.id);
    const p0=curvePoint(object,end,opts.bend,0),pM=curvePoint(object,end,opts.bend,.5),p1=curvePoint(object,end,opts.bend,1);
    const x=p=>70+Number(p.x)*8.6,y=p=>65+Number(p.y)*5.2;
    const ctrl={x:2*pM.x-.5*(p0.x+p1.x),y:2*pM.y-.5*(p0.y+p1.y)};
    const d=`M ${x(p0)} ${y(p0)} Q ${x(ctrl)} ${y(ctrl)} ${x(p1)} ${y(p1)}`;
    pitch.insertAdjacentHTML('beforeend', `<g class="animpro-guide"><path d="${d}" fill="none" stroke="#f4de67" stroke-width="3.5" stroke-dasharray="9 7" opacity=".94"/><circle cx="${x(p1)}" cy="${y(p1)}" r="10" stroke="#fff" stroke-width="2.5" fill="#1a2b5f"/><circle cx="${x(pM)}" cy="${y(pM)}" r="5" fill="#ffe37a" stroke="#1a2b5f" stroke-width="1"/></g>`);
  };
  const previousPanel=updateObjectPanel;
  updateObjectPanel=function(...args){previousPanel(...args);refreshControls();};
  const previousFrames=renderFrames;
  renderFrames=function(...args){previousFrames(...args);refreshControls();};

  $id('animDemo').addEventListener('click',()=>{
    // Create an additive example, never modifying any existing practice.
    stopPlayback();
    const d=newDrill('Animation Pro | Third-player movement');
    d.pitchType='quarter';d.age='U15';d.principle='Penetrate';d.duration=15;d.players=5;
    d.objective='See how a pass travels first, followed by a curved third-player run and a supporting overlap.';
    d.organisation='Three attacking players, two passive defenders and one ball. Use Animation Pro to compare different sequences.';
    const first={objects:[
      {id:uid(),type:'player',label:'6',color:'#1a2b5f',x:18,y:54},
      {id:uid(),type:'player',label:'8',color:'#1a2b5f',x:38,y:28},
      {id:uid(),type:'player',label:'10',color:'#1a2b5f',x:48,y:72},
      {id:uid(),type:'opponent',label:'4',color:'#c8102e',x:70,y:28},
      {id:uid(),type:'opponent',label:'5',color:'#c8102e',x:72,y:70},
      {id:uid(),type:'ball',label:'',color:'#ffffff',x:18,y:60}
    ],paths:[]};
    const second=copy(first),third=copy(first);
    second.objects[0].x=34;second.objects[0].y=54;
    second.objects[1].x=62;second.objects[1].y=34;
    second.objects[2].x=70;second.objects[2].y=65;
    second.objects[5].x=62;second.objects[5].y=36;
    third.objects[0].x=49;third.objects[0].y=57;
    third.objects[1].x=76;third.objects[1].y=27;
    third.objects[2].x=86;third.objects[2].y=62;
    third.objects[5].x=86;third.objects[5].y=62;
    const ids=first.objects.map(x=>x.id);
    second.motion={durationMs:3000,actions:{
      [ids[1]]:{bend:60,delay:25,duration:75,ease:'smooth'},
      [ids[2]]:{bend:-70,delay:40,duration:60,ease:'ease-in'},
      [ids[5]]:{bend:15,delay:0,duration:35,ease:'ease-out'}
    }};
    third.motion={durationMs:2000,actions:{
      [ids[2]]:{bend:45,delay:15,duration:85,ease:'smooth'},
      [ids[5]]:{bend:-25,delay:5,duration:65,ease:'ease-out'}
    }};
    d.frames=[first,second,third];
    state.drills.unshift(d);state.currentId=d.id;frameIndex=0;selectedId=null;selectedPath=null;undoStack=[];persist();refresh();chooseTab('design');
    toast('A separate example was added to your library. Your other practices are untouched.');
  });
  refreshControls();
})();
