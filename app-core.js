
'use strict';
const STORAGE='coachtomash-studio-v1';
const LEGACY_STORAGE='elitecoach-studio-v1';
const $=id=>document.getElementById(id);
const copy=v=>JSON.parse(JSON.stringify(v));
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const fields=['name','age','duration','players','area','principle','practiceType','objective','organisation','constraints','coaching','progressions','success'];
const pitch=$('pitch');
let selectedId=null, selectedPath=null, tool='select', frameIndex=0, activeTab='design', drag=null, playing=false, playerColor='#1a2b5f', undoStack=[], playbackRequest=0, tempPath=null, lastExportUrl=null;
let state;
function newDrill(name='Untitled practice') {return {id:uid(),name,age:'U15',duration:20,players:12,area:'30m x 24m',principle:'Penetrate',practiceType:'Principle-based',objective:'',organisation:'',constraints:'',coaching:'',progressions:'',success:'',pitchType:'quarter',frames:[{objects:[],paths:[]}],updated:Date.now()};}
function makeExample(){const d=newDrill('Penetrate | 4v4 + 3 connectors');d.players=11;d.duration=20;d.area='32m x 25m';d.objective='Recognise when to combine, carry or pass to penetrate an opposition line.';d.organisation='4v4 + 3 neutral players. Two target zones, restart quickly after a turnover. Adjust distances for player needs.';d.constraints='Score by receiving beyond the defensive line. Players may travel forward with the ball. Neutral players support the team in possession.';d.coaching='Scan before receiving; show on different lines; create a free player through movement or a third-player combination.';d.progressions='1) Free play. 2) Award extra points for a third-player combination. Regress with a wider area or extra neutral.';d.success='Record occasions when players recognise and exploit a gap, rather than only counting successful passes.';
const f=d.frames[0];let a=0;function add(type,x,y,label,color){const id='o'+(++a);f.objects.push({id,type,x,y,label:label||'',color:color||'#1a2b5f'});return id}
add('player',17,25,'2','#1a2b5f');add('player',17,70,'3','#1a2b5f');add('player',33,35,'6','#1a2b5f');add('player',33,68,'8','#1a2b5f');add('opponent',59,22,'5','#c8102e');add('opponent',59,47,'4','#c8102e');add('opponent',60,68,'6','#c8102e');add('opponent',83,44,'8','#c8102e');add('neutral',43,12,'N','#ffcf48');add('neutral',42,88,'N','#ffcf48');add('neutral',77,85,'N','#ffcf48');add('ball',17,31,'');
f.objects.push({id:'targetzone1',type:'zone',x:5,y:40,w:9,h:20,label:'',color:'#d2ecff'});f.objects.push({id:'targetzone2',type:'zone',x:87,y:40,w:9,h:20,label:'',color:'#d2ecff'});f.paths.push({id:uid(),type:'pass',x1:17,y1:31,x2:43,y2:12});const f2=copy(f);f2.objects.find(o=>o.label==='6').x=51;f2.objects.find(o=>o.label==='2').x=35;f2.objects.find(o=>o.type==='ball').x=43;f2.objects.find(o=>o.type==='ball').y=17;f2.paths=[{id:uid(),type:'move',x1:33,y1:35,x2:51,y2:35}];d.frames.push(f2);return d;}
function makeInitial(){const e=makeExample();return {drills:[e],currentId:e.id,session:{title:'YDP | Training session',age:'U15',date:new Date().toISOString().slice(0,10),objective:'Penetrate through a defensive line with supporting connections and positive decisions.',practiceIds:[e.id]}};}
function load(){try{const stored=localStorage.getItem(STORAGE);const legacy=stored?null:localStorage.getItem(LEGACY_STORAGE);let s=JSON.parse(stored||legacy);if(s&&Array.isArray(s.drills)&&s.drills.length){state=s;ensureSessionState();if(!state.drills.some(x=>x.id===state.currentId))state.currentId=state.drills[0].id;persist();return;}}catch(e){console.warn('Failed to load local data',e);}state=makeInitial();ensureSessionState();persist();}
function persist(){try{if(state&&Array.isArray(state.sessions))syncSessionIndex();localStorage.setItem(STORAGE,JSON.stringify(state));return true;}catch(e){toast('Browser storage not available or full. Export a backup to keep your work.');return false;}}
function current(){return state.drills.find(x=>x.id===state.currentId)||state.drills[0]}
function currentFrame(){const d=current();return d.frames[clamp(frameIndex,0,d.frames.length-1)];}
function snapshot(){undoStack.push({drill:copy(current()),index:frameIndex});if(undoStack.length>25)undoStack.shift();}
function commit(){current().updated=Date.now();persist();}
let toastTimer;function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2600);}
function chooseTab(name){activeTab=name;document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));document.querySelectorAll('.panel').forEach(x=>x.classList.toggle('active',x.id==='panel-'+name));if(name==='library')renderLibrary();if(name==='session')renderSession();}
function setTool(t){if(playing)stopPlayback();tool=t;document.querySelectorAll('[data-tool]').forEach(el=>el.classList.toggle('selected',el.dataset.tool===t));pitch.classList.toggle('select-mode',t==='select');const h={select:'Drag objects to reposition them. Click an object or arrow to select it. Delete removes your selection.',zone:'Drag on the pitch to draw a shaded coaching zone.',move:'Drag from start to end to draw a running or movement arrow.',pass:'Drag from start to end to draw a pass arrow.',dribble:'Drag from start to end to draw a dribbling arrow.',press:'Drag from start to end to draw a pressing arrow.',text:'Tap the pitch and enter a text label.'};$('editorHelp').textContent=h[t]||'Tap the pitch to place an item. Switch to Select / move to adjust its position.';}
function updateObjectPanel(){let o=currentFrame().objects.find(x=>x.id===selectedId);$('objectLabel').disabled=!o;$('objectLabel').value=o?.label||'';document.querySelectorAll('.swatch').forEach(s=>s.classList.toggle('on',o ? o.color===s.dataset.color : playerColor===s.dataset.color));
const rotating=!!o&&ROTATABLE_TYPES.has(o.type);$('rotationPanel').hidden=!rotating;
$('objectRotation').disabled=!rotating;$('objectRotation').value=String(normalizeRotation(o?.rotation));
$('rotationObjectName').textContent= o?.type==='goal'?'Mini goal':o?.type==='fullgoal'?'Full goal':o?.type||'';
$('goalPositionPanel').hidden=!(o&&(o.type==='goal'||o.type==='fullgoal'));
}
function renderInfo(){const d=current();fields.forEach(k=>{const el=document.querySelector('[data-field="'+k+'"]');if(el&&document.activeElement!==el)el.value=d[k]??'';});$('pitchType').value=d.pitchType||'full';$('canvasTitle').textContent=d.name;$('canvasSub').textContent=d.age+' • '+d.principle+' • '+d.practiceType;renderFrames();updateObjectPanel();}
function renderFrames(){const d=current();$('frameDots').innerHTML=d.frames.map((f,i)=>'<button class="frame-dot '+(i===frameIndex?'on':'')+'" data-frame="'+i+'" title="Edit frame '+(i+1)+'">'+(i+1)+'</button>').join('');const f=currentFrame();const count=f.objects.filter(x=>['player','opponent','neutral'].includes(x.type)).length;$('stats').innerHTML='<span class="stat">Frame '+(frameIndex+1)+' / '+d.frames.length+'</span><span class="stat">'+count+' player icons</span><span class="stat">'+f.paths.length+' action lines</span><span class="stat">'+esc(d.pitchType||'full')+' pitch</span>';}
const XY=o=>({x:70+o.x*8.6,y:65+o.y*5.2});
function outlineMarkup(type){let common='<rect x="70" y="65" width="860" height="520" fill="none" stroke="#f3fff4" stroke-width="4"/>';
let full='<line x1="500" y1="65" x2="500" y2="585" stroke="white" stroke-width="3"/><circle cx="500" cy="325" r="79" fill="none" stroke="white" stroke-width="3"/><circle cx="500" cy="325" r="4" fill="white"/>'+
'<rect x="70" y="178" width="164" height="294" fill="none" stroke="white" stroke-width="3"/><rect x="70" y="247" width="58" height="156" fill="none" stroke="white" stroke-width="3"/><circle cx="184" cy="325" r="4" fill="white"/><path d="M234,273 A65,65 0 0 1 234,377" fill="none" stroke="white" stroke-width="3"/>'+
'<rect x="766" y="178" width="164" height="294" fill="none" stroke="white" stroke-width="3"/><rect x="872" y="247" width="58" height="156" fill="none" stroke="white" stroke-width="3"/><circle cx="815" cy="325" r="4" fill="white"/><path d="M766,273 A65,65 0 0 0 766,377" fill="none" stroke="white" stroke-width="3"/>'+
'<rect x="53" y="278" width="17" height="94" fill="none" stroke="white" stroke-width="3"/><rect x="930" y="278" width="17" height="94" fill="none" stroke="white" stroke-width="3"/>';
let half='<rect x="70" y="156" width="214" height="338" fill="none" stroke="white" stroke-width="3"/><rect x="70" y="236" width="82" height="178" fill="none" stroke="white" stroke-width="3"/><circle cx="214" cy="325" r="4" fill="white"/><path d="M284,260 A84,84 0 0 1 284,390" fill="none" stroke="white" stroke-width="3"/><rect x="53" y="270" width="17" height="110" fill="none" stroke="white" stroke-width="3"/><line x1="930" y1="65" x2="930" y2="585" stroke="white" stroke-width="3"/>';
let quarter='<line x1="500" y1="65" x2="500" y2="585" stroke="white" stroke-width="2" opacity=".28" stroke-dasharray="8 12"/><line x1="70" y1="325" x2="930" y2="325" stroke="white" stroke-width="2" opacity=".28" stroke-dasharray="8 12"/>';
let markings=type==='full'?full:type==='half'?half:type==='quarter'?quarter:'';
return '<rect x="-60" y="-39" width="1120" height="728" fill="#13553f"/><rect x="70" y="65" width="860" height="520" fill="#217a53"/>'+[0,1,2,3,4,5,6,7].map(i=>'<rect x="'+(70+i*107.5)+'" y="65" width="107.5" height="520" fill="'+(i%2?'#ffffff':'#000000')+'" opacity=".035"/>').join('')+common+markings+'<text x="85" y="608" font-size="14" fill="#ffffff99" font-family="Arial">COACHTOMASH STUDIO</text>';
}
const pathColors={move:'#ffbf55',pass:'#ffffff',dribble:'#6ad1ff',press:'#ff647c'};
const ROTATABLE_TYPES=new Set(['goal','fullgoal','cone','mannequin','zone','text']);
const normalizeRotation=v=>((Number(v)||0)%360+360)%360;
// Older drills retain their x/y values (0-100 is the original playing area).
// Only goals may enter the run-off region outside those lines. The new SVG
// viewBox provides genuine space there, including enough room for a full goal.
const PITCH_EDGE={left:70,right:930,top:65,bottom:585};
const CANVAS_EDGE={left:-60,right:1060,top:-39,bottom:689};
function goalHalfExtents(type,angle=0,scale=1){
  const a=normalizeRotation(angle)*Math.PI/180;
  const factor=clamp(Number(scale)||1,.5,2.5);
  const w=(type==='fullgoal'?48:22)*factor, h=(type==='fullgoal'?25:13)*factor;
  return {x:Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*h,
          y:Math.abs(Math.sin(a))*w+Math.abs(Math.cos(a))*h};
}
function limitItemPosition(pos,type,angle=0,scale=1){
  if(type!=='goal'&&type!=='fullgoal')return {x:clamp(pos.x,0,100),y:clamp(pos.y,0,100)};
  const half=goalHalfExtents(type,angle,scale),safe=7;
  return {
    x:clamp(pos.x,(CANVAS_EDGE.left+half.x+safe-70)/8.6,(CANVAS_EDGE.right-half.x-safe-70)/8.6),
    y:clamp(pos.y,(CANVAS_EDGE.top+half.y+safe-65)/5.2,(CANVAS_EDGE.bottom-half.y-safe-65)/5.2)
  };
}
function defs(){return '<defs>'+Object.entries(pathColors).map(([k,v])=>'<marker id="arr-'+k+'" markerWidth="8" markerHeight="8" refX="6.7" refY="3.1" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6.7,3.1 L0,6.2" fill="none" stroke="'+v+'" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></marker>').join('')+'</defs>';}
function objMarkup(o){const p=XY(o),sel=o.id===selectedId,halo=sel?'<circle cx="'+p.x+'" cy="'+p.y+'" r="24" fill="none" stroke="#ffdf69" stroke-width="3" stroke-dasharray="5 3"/>':'';let g='';
if(['player','opponent','neutral'].includes(o.type)){let c=o.color||{player:'#1a2b5f',opponent:'#c8102e',neutral:'#ffcf48'}[o.type];let dark=c==='#ffffff'||c==='#ffcf48';g='<circle cx="'+p.x+'" cy="'+p.y+'" r="17" fill="'+esc(c)+'" stroke="white" stroke-width="2.8"/><text x="'+p.x+'" y="'+(p.y+5)+'" text-anchor="middle" font-family="Arial" font-size="13" font-weight="bold" fill="'+(dark?'#10223d':'white')+'">'+esc(o.label||'')+'</text>';}
else if(o.type==='ball'){g='<circle cx="'+p.x+'" cy="'+p.y+'" r="12" fill="white" stroke="#0d2139" stroke-width="2"/><polygon points="'+p.x+','+(p.y-5)+' '+(p.x+5)+','+(p.y-1)+' '+(p.x+3)+','+(p.y+5)+' '+(p.x-3)+','+(p.y+5)+' '+(p.x-5)+','+(p.y-1)+'" fill="#24374b"/>';}
else if(o.type==='cone'){g='<path d="M'+p.x+','+(p.y-14)+' L'+(p.x+15)+','+(p.y+12)+' L'+(p.x-15)+','+(p.y+12)+' Z" fill="#ffa42b" stroke="white" stroke-width="2"/>';}
else if(o.type==='mannequin'){g='<circle cx="'+p.x+'" cy="'+(p.y-15)+'" r="7" fill="#f8dc55" stroke="white" stroke-width="2"/><rect x="'+(p.x-9)+'" y="'+(p.y-8)+'" width="18" height="29" rx="6" fill="#f8dc55" stroke="white" stroke-width="2"/>';}
else if(o.type==='goal'){
g='<rect x="'+(p.x-22)+'" y="'+(p.y-13)+'" width="44" height="26" rx="1" fill="#ffffff1a" stroke="white" stroke-width="4"/>'+
'<path d="M'+(p.x-22)+','+(p.y-13)+' l44,26 M'+(p.x+22)+','+(p.y-13)+' l-44,26" stroke="white" stroke-opacity=".27" stroke-width="1.4"/>';
}
else if(o.type==='fullgoal'){
// Full-size football goal: wider net and distinct open goalmouth. Rotate around centre.
const x=p.x-48, y=p.y-25;
let net='';for(let i=1;i<6;i++)net+='<line x1="'+(x+i*16)+'" y1="'+(y+3)+'" x2="'+(x+i*16)+'" y2="'+(y+47)+'" stroke="#ffffff" stroke-opacity=".30" stroke-width="1"/>';
for(let j=1;j<3;j++)net+='<line x1="'+(x+3)+'" y1="'+(y+j*15)+'" x2="'+(x+93)+'" y2="'+(y+j*15)+'" stroke="#ffffff" stroke-opacity=".30" stroke-width="1"/>';
g='<rect x="'+x+'" y="'+y+'" width="96" height="50" rx="1" fill="#ffffff18" stroke="#ffffff" stroke-width="4.6"/>' + net +
'<line x1="'+x+'" y1="'+y+'" x2="'+(x+96)+'" y2="'+y+'" stroke="#fdfdfd" stroke-width="6"/>';
}
else if(o.type==='text'){g='<text x="'+p.x+'" y="'+p.y+'" fill="white" stroke="#15273e" stroke-width="3" paint-order="stroke" font-family="Arial" font-weight="bold" font-size="21">'+esc(o.label||'Label')+'</text>';}
else if(o.type==='zone'){let w=(o.w||16)*8.6,h=(o.h||17)*5.2;g='<rect x="'+p.x+'" y="'+p.y+'" width="'+w+'" height="'+h+'" rx="4" fill="#e1f5fe" fill-opacity=".12" stroke="'+(sel?'#ffe176':'#d5f0ff')+'" stroke-width="3" stroke-dasharray="9 6"/>';}
const angle=ROTATABLE_TYPES.has(o.type)?normalizeRotation(o.rotation):0;
const cx=o.type==='zone'?p.x+(o.w||16)*8.6/2:p.x;
const cy=o.type==='zone'?p.y+(o.h||17)*5.2/2:p.y;
const scale=(o.type==='goal'||o.type==='fullgoal')?clamp(Number(o.scale)||1,.5,2.5):1;
return '<g data-oid="'+esc(o.id)+'"><g transform="translate('+cx+' '+cy+') rotate('+angle+') scale('+scale+') translate('+(-cx)+' '+(-cy)+')">'+g+'</g>'+halo+'</g>';}


function pathMarkup(p){
 const a=XY({x:p.x1,y:p.y1}),b=XY({x:p.x2,y:p.y2}),c=pathColors[p.type]||'white';
 const selected=p.id===selectedPath,stroke=p.type==='press'?'10 7':p.type==='dribble'?'4 8':'';
 const curved=!!p.curved&&Number.isFinite(Number(p.cx))&&Number.isFinite(Number(p.cy));
 const q=curved?XY({x:Number(p.cx),y:Number(p.cy)}):null;
 const d=curved?`M ${a.x} ${a.y} Q ${q.x} ${q.y} ${b.x} ${b.y}`:`M ${a.x} ${a.y} L ${b.x} ${b.y}`;
 return '<g data-pid="'+esc(p.id)+'"><path d="'+d+'" fill="none" stroke="#000" opacity=".14" stroke-width="10"/><path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+(selected?7:4.4)+'" stroke-linecap="round" '+(stroke?'stroke-dasharray="'+stroke+'"':'')+' marker-end="url(#arr-'+p.type+')"/><path d="'+d+'" fill="none" stroke="transparent" stroke-width="25"/></g>';
}
function draw(objects,paths,pitchType,temp){return defs()+outlineMarkup(pitchType)+paths.map(pathMarkup).join('')+objects.filter(o=>o.type==='zone').map(objMarkup).join('')+objects.filter(o=>o.type!=='zone').map(objMarkup).join('')+(temp?pathMarkup({...temp,id:'drawing'}):'');}
function renderPitch(preview=null){const d=current(),f=currentFrame();pitch.innerHTML=draw(preview?.objects||f.objects,preview?.paths||f.paths,d.pitchType||'full',tempPath);}
function refresh(){renderInfo();renderPitch();}
function svgPoint(e){const p=pitch.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const m=pitch.getScreenCTM();if(!m)return {x:50,y:50};let transformed=p.matrixTransform(m.inverse());return {x:(transformed.x-70)/8.6,y:(transformed.y-65)/5.2};}
function setSelection(id=null,pid=null){selectedId=id;selectedPath=pid;updateObjectPanel();renderPitch();}
function itemAt(e,attr){const el=e.target.closest('['+attr+']');return el?el.getAttribute(attr):null;}
function addItem(t,pos){snapshot();let objs=currentFrame().objects;let n=objs.filter(o=>o.type===t).length+1;const color=t==='opponent'?'#c8102e':t==='neutral'?'#ffcf48':playerColor;const label=t==='player'||t==='opponent'?String(n):t==='neutral'?'N':'';const allowed=limitItemPosition(pos,t,0);const obj={id:uid(),type:t,x:allowed.x,y:allowed.y,color,label};if(ROTATABLE_TYPES.has(t))obj.rotation=0;if(t==='text'){const labelText=prompt('Label text:','Coach / start');if(labelText===null){undoStack.pop();return;}obj.label=labelText.slice(0,40);}objs.push(obj);selectedId=obj.id;selectedPath=null;commit();refresh();}
pitch.addEventListener('pointerdown',e=>{if(playing)return;const pos=svgPoint(e);const id=itemAt(e,'data-oid'),pid=itemAt(e,'data-pid');if(tool==='select'){if(id){let o=currentFrame().objects.find(x=>x.id===id);if(!o)return;snapshot();selectedId=id;selectedPath=null;drag={kind:'object',id,offsetX:pos.x-o.x,offsetY:pos.y-o.y,moved:false};pitch.setPointerCapture(e.pointerId);updateObjectPanel();renderPitch();}else if(pid){setSelection(null,pid);}else{setSelection();}return;}
if(['move','pass','dribble','press','zone'].includes(tool)){snapshot();const withinPitch=limitItemPosition(pos,tool);drag={kind:tool,start:withinPitch,current:withinPitch,moved:false};pitch.setPointerCapture(e.pointerId);return;}
addItem(tool,pos);
});
pitch.addEventListener('pointermove',e=>{if(!drag||playing)return;const pos=svgPoint(e);if(drag.kind==='object'){const o=currentFrame().objects.find(x=>x.id===drag.id);if(!o)return;const next=limitItemPosition({x:pos.x-drag.offsetX,y:pos.y-drag.offsetY},o.type,o.rotation,o.scale);const x=next.x,y=next.y;if(Math.abs(x-o.x)+Math.abs(y-o.y)>.05)drag.moved=true;o.x=x;o.y=y;renderPitch();}
else{const p=limitItemPosition(pos,drag.kind);drag.current=p;drag.moved= Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>2;if(drag.kind==='zone'){tempPath=null;const existing=$('pitch').querySelector('#preview-zone');if(existing)existing.remove();const start=XY({x:Math.min(drag.start.x,p.x),y:Math.min(drag.start.y,p.y)});pitch.insertAdjacentHTML('beforeend','<rect id="preview-zone" x="'+start.x+'" y="'+start.y+'" width="'+(Math.abs(drag.start.x-p.x)*8.6)+'" height="'+(Math.abs(drag.start.y-p.y)*5.2)+'" stroke="white" stroke-dasharray="9 5" fill="#ffffff22"/>');}else{tempPath={type:drag.kind,x1:drag.start.x,y1:drag.start.y,x2:p.x,y2:p.y};renderPitch();}}
});
function endDrag(){if(!drag)return;const t=drag;if(t.kind==='object'){if(!t.moved)undoStack.pop();else commit();}
else if(t.moved){if(t.kind==='zone'){currentFrame().objects.push({id:uid(),type:'zone',x:Math.min(t.start.x,t.current.x),y:Math.min(t.start.y,t.current.y),w:Math.abs(t.current.x-t.start.x),h:Math.abs(t.current.y-t.start.y),color:'#d5efff',label:''});}else{currentFrame().paths.push({id:uid(),type:t.kind,x1:t.start.x,y1:t.start.y,x2:t.current.x,y2:t.current.y});}commit();}else undoStack.pop();drag=null;tempPath=null;refresh();}
pitch.addEventListener('pointerup',endDrag);pitch.addEventListener('pointercancel',endDrag);
function safeFilename(s){return String(s||'diagram').replace(/[^a-z0-9 _-]/gi,'').trim().replace(/\s+/g,'_').slice(0,65)||'diagram';}
function downloadText(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
function svgSource(){return '<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="728" viewBox="-60 -39 1120 728">'+draw(currentFrame().objects,currentFrame().paths,current().pitchType||'full',null)+'</svg>';}
$('exportSvg').onclick=()=>{downloadText('CoachTomAsh_'+safeFilename(current().name)+'.svg',svgSource(),'image/svg+xml');toast('SVG exported');};
$('exportPng').onclick=()=>{const blob=new Blob([svgSource()],{type:'image/svg+xml;charset=utf-8'});const u=URL.createObjectURL(blob);const img=new Image();img.onload=()=>{let c=document.createElement('canvas');c.width=1800;c.height=1170;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(u);c.toBlob(b=>{if(!b){toast('PNG export unavailable on this browser; use SVG.');return;}let a=document.createElement('a');let link=URL.createObjectURL(b);a.href=link;a.download='CoachTomAsh_'+safeFilename(current().name)+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(link),2000);},'image/png');};img.onerror=()=>{URL.revokeObjectURL(u);toast('PNG export unavailable; try SVG.');};img.src=u;};
function selectDrill(id){if(!state.drills.some(x=>x.id===id))return;stopPlayback();state.currentId=id;frameIndex=0;selectedId=null;selectedPath=null;undoStack=[];setTool('select');persist();refresh();chooseTab('design');}
function createDrill(){stopPlayback();const d=newDrill();state.drills.unshift(d);state.currentId=d.id;frameIndex=0;selectedId=null;selectedPath=null;undoStack=[];persist();refresh();chooseTab('design');$('f-name').focus();$('f-name').select();}
$('newBtn').onclick=createDrill;$('libraryNew').onclick=createDrill;
$('backupBtn').onclick=()=>{downloadText('CoachTomAsh_Studio_Backup_'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({format:'coachtomash-studio-v1',exported:new Date().toISOString(),state},null,2),'application/json');toast('Full library backup downloaded');};
$('importBtn').onclick=()=>$('fileInput').click();
$('fileInput').onchange=async(e)=>{const f=e.target.files[0];if(!f)return;try{const data=JSON.parse(await f.text());const incoming=data.state||data;if(!Array.isArray(incoming.drills)||!incoming.drills.length||!incoming.drills.every(d=>d.id&&Array.isArray(d.frames)&&d.frames.length&&d.frames.every(fr=>Array.isArray(fr.objects)&&Array.isArray(fr.paths))))throw new Error('Not a valid CoachTomAsh Studio or legacy EliteCoach backup');if(!confirm('Import backup? This REPLACES the library in this browser. Export your current backup first if needed.'))return;state=incoming;ensureSessionState();state.currentId=state.drills.some(d=>d.id===state.currentId)?state.currentId:state.drills[0].id;frameIndex=0;selectedId=null;selectedPath=null;undoStack=[];persist();refresh();renderLibrary();renderSession();toast('Backup imported');}catch(err){toast('Cannot import: '+err.message);}finally{e.target.value='';}};
$('saveBtn').onclick=()=>{commit();toast('Practice saved in this browser. Back up to keep a portable copy.');};
$('clearPitchBtn').onclick=()=>{if(!confirm('Clear all players, equipment and action lines from this frame?'))return;snapshot();currentFrame().objects=[];currentFrame().paths=[];selectedId=null;selectedPath=null;commit();refresh();};
$('deleteBtn').onclick=()=>{const f=currentFrame();if(!selectedId&&!selectedPath){toast('Select an object or action line first');return;}snapshot();if(selectedId)f.objects=f.objects.filter(o=>o.id!==selectedId);if(selectedPath)f.paths=f.paths.filter(p=>p.id!==selectedPath);selectedId=null;selectedPath=null;commit();refresh();};
$('duplicateBtn').onclick=()=>{const o=currentFrame().objects.find(x=>x.id===selectedId);if(!o){toast('Select an object first');return;}snapshot();const n=copy(o);n.id=uid();const pos=limitItemPosition({x:n.x+5,y:n.y+5},n.type,n.rotation,n.scale);n.x=pos.x;n.y=pos.y;currentFrame().objects.push(n);selectedId=n.id;commit();refresh();};
$('undoBtn').onclick=()=>{if(!undoStack.length){toast('Nothing to undo');return;}stopPlayback();const prev=undoStack.pop();const idx=state.drills.findIndex(x=>x.id===prev.drill.id);if(idx<0)return;state.drills[idx]=prev.drill;frameIndex=clamp(prev.index,0,prev.drill.frames.length-1);selectedId=null;selectedPath=null;persist();refresh();};
$('objectLabel').oninput=e=>{const o=currentFrame().objects.find(x=>x.id===selectedId);if(!o)return;o.label=e.target.value;commit();renderPitch();};
$('swatches').onclick=e=>{const b=e.target.closest('[data-color]');if(!b)return;playerColor=b.dataset.color;const o=currentFrame().objects.find(x=>x.id===selectedId);if(o){snapshot();o.color=playerColor;commit();}updateObjectPanel();renderPitch();};
$('toolGrid').onclick=e=>{const b=e.target.closest('[data-tool]');if(b)setTool(b.dataset.tool);};
function rotateSelected(newAngle){const o=currentFrame().objects.find(x=>x.id===selectedId);
if(!o||!ROTATABLE_TYPES.has(o.type))return;
const a=normalizeRotation(newAngle);if(normalizeRotation(o.rotation)===a)return;
snapshot();o.rotation=a;const pos=limitItemPosition({x:o.x,y:o.y},o.type,a,o.scale);o.x=pos.x;o.y=pos.y;commit();refresh();}
$('rotationPanel').addEventListener('click',e=>{
const delta=e.target.closest('[data-rotate]'),preset=e.target.closest('[data-rotation-preset]');
const o=currentFrame().objects.find(x=>x.id===selectedId);if(!o)return;
if(delta)rotateSelected(normalizeRotation(o.rotation)+Number(delta.dataset.rotate));
else if(preset)rotateSelected(Number(preset.dataset.rotationPreset));
});
$('objectRotation').addEventListener('change',e=>rotateSelected(e.target.value));
$('goalPositionPanel').addEventListener('click',e=>{
  const b=e.target.closest('[data-goal-side]');if(!b)return;
  const o=currentFrame().objects.find(x=>x.id===selectedId);
  if(!o||!['goal','fullgoal'].includes(o.type))return;
  const side=b.dataset.goalSide;
  const angle={left:90,right:270,top:180,bottom:0}[side];
  const extent=goalHalfExtents(o.type,angle,o.scale),gap=8;
  const next={x:o.x,y:o.y};
  if(side==='left'){next.x=(PITCH_EDGE.left-extent.x-gap-70)/8.6;next.y=clamp(next.y,0,100);}
  if(side==='right'){next.x=(PITCH_EDGE.right+extent.x+gap-70)/8.6;next.y=clamp(next.y,0,100);}
  if(side==='top'){next.y=(PITCH_EDGE.top-extent.y-gap-65)/5.2;next.x=clamp(next.x,0,100);}
  if(side==='bottom'){next.y=(PITCH_EDGE.bottom+extent.y+gap-65)/5.2;next.x=clamp(next.x,0,100);}
  const p=limitItemPosition(next,o.type,angle,o.scale);
  snapshot();o.rotation=angle;o.x=p.x;o.y=p.y;commit();refresh();
  toast('Goal placed outside the '+side+' boundary');
});
$('pitchType').onchange=e=>{snapshot();current().pitchType=e.target.value;commit();refresh();};
fields.forEach(k=>{const el=document.querySelector('[data-field="'+k+'"]');el.addEventListener('input',e=>{current()[k]=e.target.type==='number'?Number(e.target.value):e.target.value;commit();$('canvasTitle').textContent=current().name;$('canvasSub').textContent=current().age+' • '+current().principle+' • '+current().practiceType;});});
$('addFrame').onclick=()=>{stopPlayback();snapshot();current().frames.splice(frameIndex+1,0,copy(currentFrame()));frameIndex++;selectedId=null;selectedPath=null;commit();refresh();toast('Frame copied. Move players to their next positions.');};
$('removeFrame').onclick=()=>{stopPlayback();if(current().frames.length===1){toast('Every practice needs at least one frame');return;}snapshot();current().frames.splice(frameIndex,1);frameIndex=Math.max(0,frameIndex-1);selectedId=null;selectedPath=null;commit();refresh();};
$('prevFrame').onclick=()=>{stopPlayback();frameIndex=Math.max(0,frameIndex-1);selectedId=null;selectedPath=null;refresh();};
$('nextFrame').onclick=()=>{stopPlayback();frameIndex=Math.min(current().frames.length-1,frameIndex+1);selectedId=null;selectedPath=null;refresh();};
$('frameDots').onclick=e=>{const b=e.target.closest('[data-frame]');if(!b)return;stopPlayback();frameIndex=+b.dataset.frame;selectedId=null;selectedPath=null;refresh();};
function tweenFrames(a,b,t){const amap=new Map(a.objects.map(x=>[x.id,x]));const bmap=new Map(b.objects.map(x=>[x.id,x]));const ids=new Set([...amap.keys(),...bmap.keys()]);let objects=[];for(const id of ids){const ao=amap.get(id),bo=bmap.get(id);if(!ao||!bo){if(t<.5&&ao)objects.push(ao);if(t>=.5&&bo)objects.push(bo);continue;}let o=copy(bo);o.x=ao.x+(bo.x-ao.x)*t;o.y=ao.y+(bo.y-ao.y)*t;if(o.w!==undefined&&ao.w!==undefined)o.w=ao.w+(bo.w-ao.w)*t;if(o.h!==undefined&&ao.h!==undefined)o.h=ao.h+(bo.h-ao.h)*t;
if((bo.type==='goal'||bo.type==='fullgoal')&&(bo.scale!==undefined||ao.scale!==undefined))o.scale=(Number(ao.scale)||1)+((Number(bo.scale)||1)-(Number(ao.scale)||1))*t;
// Smoothly tween equipment rotation along the shortest arc between frames.
if(ROTATABLE_TYPES.has(o.type)){
 const start=normalizeRotation(ao.rotation),end=normalizeRotation(bo.rotation);
 const delta=((end-start+540)%360)-180;
 o.rotation=normalizeRotation(start+delta*t);
}
objects.push(o);}return {objects,paths:t<.5?a.paths:b.paths};}
function stopPlayback(){if(playbackRequest)cancelAnimationFrame(playbackRequest);playbackRequest=0;const was=playing;playing=false;$('playBtn').textContent='▶ Play';if(was)renderPitch();}
$('playBtn').onclick=()=>{if(playing){stopPlayback();return;}if(current().frames.length<2){toast('Add a second frame to animate movement');return;}playing=true;$('playBtn').textContent='■ Stop';selectedId=null;selectedPath=null;const d=current(),startFrame=frameIndex>=d.frames.length-1?0:frameIndex;let start=null;const duration=1600;
// Play from the current frame to the end, restarting if the last frame is selected.
const firstFrame=startFrame;const animate=(time)=>{if(!playing)return;if(start===null)start=time;let elapsed=(time-start)/duration;const idx=Math.floor(elapsed);if(idx>=d.frames.length-1-firstFrame){stopPlayback();frameIndex=d.frames.length-1;renderFrames();return;}let f=firstFrame+idx;renderPitch(tweenFrames(d.frames[f],d.frames[f+1],elapsed-idx));playbackRequest=requestAnimationFrame(animate);};playbackRequest=requestAnimationFrame(animate);
};
function renderLibrary(){const q=$('searchDrills').value.toLowerCase().trim(),p=$('filterPrinciple').value;const ds=state.drills.filter(d=>(!p||d.principle===p)&&(!q||[d.name,d.principle,d.practiceType,d.age,d.objective].join(' ').toLowerCase().includes(q)));$('drillGrid').innerHTML=ds.length?ds.map(d=>'<article class="drill-card"><div class="mini-field">⚽</div><div class="drill-info"><h3>'+esc(d.name)+'</h3><span class="pill">'+esc(d.age)+'</span><span class="pill">'+esc(d.principle)+'</span><span class="pill">'+esc(d.duration)+' mins</span><p>'+esc((d.objective||'No objective added yet').slice(0,115))+'</p><div class="card-footer"><button class="btn small dark" data-open="'+esc(d.id)+'">Edit practice</button><button class="btn small" data-clone="'+esc(d.id)+'">Duplicate</button><button class="btn small danger" data-delete="'+esc(d.id)+'">Delete</button></div></div></article>').join(''):'<div class="empty">No practices match your search.</div>';}
$('drillGrid').onclick=e=>{const b=e.target.closest('button');if(!b)return;const id=b.dataset.open||b.dataset.clone||b.dataset.delete;const d=state.drills.find(x=>x.id===id);if(!d)return;if(b.dataset.open){selectDrill(id);}else if(b.dataset.clone){const n=copy(d);n.id=uid();n.name=d.name+' (copy)';n.updated=Date.now();state.drills.unshift(n);persist();renderLibrary();toast('Practice duplicated');}else if(b.dataset.delete){if(state.drills.length===1){toast('Keep at least one practice in your library');return;}if(!confirm('Delete "'+d.name+'" from your practice library? It will also be removed from all saved sessions.'))return;state.drills=state.drills.filter(x=>x.id!==id);state.sessions.forEach(s=>{s.entries=s.entries.filter(x=>x.drillId!==id);s.practiceIds=s.entries.map(x=>x.drillId);});if(state.currentId===id)state.currentId=state.drills[0].id;persist();renderLibrary();toast('Practice deleted');}};
$('searchDrills').oninput=renderLibrary;$('filterPrinciple').onchange=renderLibrary;
// v1.3 session library: preserve original state.session and state.session.practiceIds for v1 backups.
const SESSION_DEFAULTS={title:'Training session',age:'U15',date:'',startTime:'',target:90,venue:'',coach:'',principle:'',block:'',objective:'',notes:'',practiceIds:[],entries:[]};
function normalizedSession(raw){
  const s=Object.assign({},SESSION_DEFAULTS,raw||{});
  s.id=String(s.id||uid());
  s.title=String(s.title||'Untitled session');
  let entries=Array.isArray(s.entries)&&s.entries.length?s.entries:(Array.isArray(s.practiceIds)?s.practiceIds.map(drillId=>({drillId})):[]);
  s.entries=entries.filter(e=>e&&typeof e.drillId==='string').map(e=>({entryId:String(e.entryId||uid()),drillId:e.drillId,duration:e.duration===null||e.duration===undefined||e.duration===''?null:clamp(Number(e.duration)||1,1,600),notes:String(e.notes||'')}));
  s.practiceIds=s.entries.map(e=>e.drillId);
  s.updated=Number(s.updated)||Date.now();
  return s;
}
function ensureSessionState(){
  if(!Array.isArray(state.sessions)||!state.sessions.length)state.sessions=[normalizedSession(state.session)];
  else state.sessions=state.sessions.map(normalizedSession);
  const seen=new Set();state.sessions.forEach(s=>{if(seen.has(s.id))s.id=uid();seen.add(s.id);});
  if(!state.sessions.some(s=>s.id===state.currentSessionId))state.currentSessionId=state.sessions[0].id;
  syncSessionIndex();
}
function syncSessionIndex(){
  if(!Array.isArray(state.sessions)||!state.sessions.length)return;
  const active=state.sessions.find(s=>s.id===state.currentSessionId)||state.sessions[0];
  state.currentSessionId=active.id;
  active.practiceIds=active.entries.map(e=>e.drillId);
  state.session=active;
}
function activeSession(){return state.session;}
function sessionDuration(entry){
  const d=state.drills.find(d=>d.id===entry.drillId);
  const n=entry.duration===null?Number(d?.duration)||0:Number(entry.duration);
  return clamp(Number.isFinite(n)?n:0,0,600);
}
function sessionTotal(s){return s.entries.reduce((n,e)=>n+sessionDuration(e),0);}
function touchSession(){activeSession().updated=Date.now();persist();}
function newSession(){
  const s=normalizedSession({title:'New training session',age:activeSession()?.age||'U15',date:new Date().toISOString().slice(0,10),target:90,entries:[]});
  state.sessions.unshift(s);state.currentSessionId=s.id;syncSessionIndex();persist();renderSession();$('s-title').focus();$('s-title').select();toast('New session created');
}
function activateSession(id){
  if(!state.sessions.some(s=>s.id===id))return;
  state.currentSessionId=id;syncSessionIndex();persist();renderSession();
}
function formatClock(minutes){const n=(minutes%1440+1440)%1440;return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function sessionStartMinutes(s){return /^\d\d:\d\d$/.test(s.startTime||'')?Number(s.startTime.slice(0,2))*60+Number(s.startTime.slice(3,5)):null;}
function clockRange(start,duration){return start===null?'':formatClock(start)+'–'+formatClock(start+duration);}
function renderSessionBank(){
  const q=($('sessionPracticeSearch').value||'').trim().toLowerCase();
  const principle=$('sessionPracticePrinciple').value;
  const type=$('sessionPracticeType').value;
  const allTypes=[...new Set(state.drills.map(d=>d.practiceType).filter(Boolean))].sort();
  if([...$('sessionPracticeType').options].length!==allTypes.length+1){
    const chosen=type;$('sessionPracticeType').innerHTML='<option value="">All types</option>'+allTypes.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
    $('sessionPracticeType').value=chosen;
  }
  const matches=state.drills.filter(d=>(!principle||d.principle===principle)&&(!type||d.practiceType===type)&&(!q||[d.name,d.age,d.practiceType,d.principle,d.objective].join(' ').toLowerCase().includes(q)));
  $('sessionPracticeBank').innerHTML=matches.length?matches.map(d=>'<article class="session-bank-item" draggable="true" data-bank-drill="'+esc(d.id)+'"><div><strong>'+esc(d.name)+'</strong><p>'+esc(d.age)+' · '+esc(d.principle)+' · '+esc(d.practiceType)+' · '+esc(d.duration)+' min</p></div><button class="btn small dark" type="button" data-add-drill="'+esc(d.id)+'">+ Add to session</button></article>').join(''):'<div class="empty">No practices match the filters.</div>';
}
function renderSavedSessions(){
  $('sessionLibraryCount').textContent=state.sessions.length+' saved · stored on this device';
  const sorted=[...state.sessions].sort((a,b)=>Number(b.updated)-Number(a.updated));
  $('sessionSavedLibrary').innerHTML=sorted.map(s=>'<article class="session-saved-card '+(s.id===state.currentSessionId?'active':'')+'"><h4>'+esc(s.title)+'</h4><div class="hint">'+esc(s.age)+' · '+esc(s.date||'No date')+' · '+s.entries.length+' practices · '+sessionTotal(s)+' min</div><div class="hint">'+esc(s.principle||'Mixed focus')+(s.block?' · '+esc(s.block):'')+'</div><div class="bottom-actions"><button class="btn small '+(s.id===state.currentSessionId?'dark':'')+'" type="button" data-open-session="'+esc(s.id)+'">'+(s.id===state.currentSessionId?'Current session':'Open session')+'</button><button class="btn small" type="button" data-copy-session="'+esc(s.id)+'">Duplicate</button></div></article>').join('');
}
function renderSession(){
  syncSessionIndex();const s=activeSession();
  $('sessionSelect').innerHTML=state.sessions.map(item=>'<option value="'+esc(item.id)+'">'+esc(item.title)+' · '+esc(item.age)+'</option>').join('');
  $('sessionSelect').value=s.id;
  for(const [id,key] of [['s-title','title'],['s-age','age'],['s-date','date'],['s-startTime','startTime'],['s-target','target'],['s-venue','venue'],['s-coach','coach'],['s-principle','principle'],['s-block','block'],['s-objective','objective'],['s-notes','notes']]){
    const el=$(id);if(document.activeElement!==el)el.value=s[key]??'';
  }
  const total=sessionTotal(s),target=Number(s.target)||0;
  $('totalDuration').textContent=total+' minutes';
  const difference=total-target;
  $('durationTarget').textContent=target?difference===0?'On target · '+target+' min':Math.abs(difference)+' min '+(difference<0?'under':'over')+' target':'No target';
  const start=sessionStartMinutes(s);
  $('sessionTimeline').textContent=(start!==null?'Starts '+formatClock(start)+' · Ends '+formatClock(start+total)+' · ':'')+s.entries.length+' practices · '+total+' minutes total'+(target?' / '+target+' planned':'');
  let elapsed=0;
  $('sessionRows').innerHTML=s.entries.length?s.entries.map((entry,i)=>{
    const d=state.drills.find(x=>x.id===entry.drillId);
    if(!d)return '';
    const minutes=sessionDuration(entry),window=clockRange(start===null?null:start+elapsed,minutes);elapsed+=minutes;
    return '<article class="session-activity" draggable="true" data-session-entry="'+esc(entry.entryId)+'">'+
      '<div class="session-drag-handle" title="Drag to reorder">⠿</div><div><div class="session-activity-name">'+(i+1)+'. '+esc(d.name)+'</div><div class="session-activity-meta">'+esc(d.principle)+' · '+esc(d.practiceType)+(window?' · '+window:'')+'</div>'+
      '<div class="session-activity-fields"><div><label for="sd-'+esc(entry.entryId)+'">Minutes</label><input id="sd-'+esc(entry.entryId)+'" type="number" min="1" max="600" class="field" data-entry-duration="'+esc(entry.entryId)+'" value="'+minutes+'"></div><div><label for="sn-'+esc(entry.entryId)+'">Activity notes (optional)</label><input id="sn-'+esc(entry.entryId)+'" class="field" data-entry-note="'+esc(entry.entryId)+'" value="'+esc(entry.notes||'')+'" placeholder="Coaching, transition, differentiation..."></div></div></div>'+
      '<div class="session-activity-actions"><button class="btn small" type="button" data-entry-action="up" data-entry-id="'+esc(entry.entryId)+'" title="Move up" '+(i===0?'disabled':'')+'>↑</button><button class="btn small" type="button" data-entry-action="down" data-entry-id="'+esc(entry.entryId)+'" title="Move down" '+(i===s.entries.length-1?'disabled':'')+'>↓</button><button class="btn small" type="button" data-entry-action="edit" data-entry-id="'+esc(entry.entryId)+'" title="Edit this practice">✎</button><button class="btn small danger" type="button" data-entry-action="remove" data-entry-id="'+esc(entry.entryId)+'" title="Remove from session">×</button></div></article>';
  }).join(''):'<div class="empty"><b>No practices in this session</b>Use “Add to session” below, or drag a practice into this area.</div>';
  renderSessionBank();renderSavedSessions();
}
function addDrillToSession(drillId,at=null){
  if(!state.drills.some(d=>d.id===drillId))return;
  const item={entryId:uid(),drillId,duration:null,notes:''};const arr=activeSession().entries;
  arr.splice(at===null?arr.length:clamp(at,0,arr.length),0,item);touchSession();renderSession();toast('Practice added to session');
}
function duplicateSessionById(id){
  const base=state.sessions.find(x=>x.id===id);if(!base)return;
  const duplicate=normalizedSession(copy(base));duplicate.id=uid();duplicate.title=base.title+' (copy)';duplicate.entries.forEach(e=>e.entryId=uid());duplicate.updated=Date.now();
  state.sessions.unshift(duplicate);state.currentSessionId=duplicate.id;syncSessionIndex();persist();renderSession();toast('Session duplicated');
}
$('sessionSelect').addEventListener('change',e=>activateSession(e.target.value));
$('sessionNew').addEventListener('click',newSession);
$('sessionDuplicate').addEventListener('click',()=>duplicateSessionById(state.currentSessionId));
$('sessionDelete').addEventListener('click',()=>{
  if(state.sessions.length<=1){toast('Keep at least one saved session. Create another before deleting this one.');return;}
  const s=activeSession();if(!confirm('Delete session "'+s.title+'"? Practices in your library will not be deleted.'))return;
  state.sessions=state.sessions.filter(x=>x.id!==s.id);state.currentSessionId=state.sessions[0].id;syncSessionIndex();persist();renderSession();toast('Session deleted');
});
$('sessionSavedLibrary').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.openSession)activateSession(b.dataset.openSession);
  else if(b.dataset.copySession)duplicateSessionById(b.dataset.copySession);
});
for(const [id,key] of [['s-title','title'],['s-age','age'],['s-date','date'],['s-startTime','startTime'],['s-target','target'],['s-venue','venue'],['s-coach','coach'],['s-principle','principle'],['s-block','block'],['s-objective','objective'],['s-notes','notes']]){
  $(id).addEventListener('input',e=>{
    activeSession()[key]=key==='target'?clamp(Number(e.target.value)||0,0,600):e.target.value;
    touchSession();
    if(key==='target'||key==='startTime'){
      const s=activeSession(),total=sessionTotal(s),target=Number(s.target)||0;
      $('durationTarget').textContent=target?total===target?'On target · '+target+' min':Math.abs(total-target)+' min '+(total<target?'under':'over')+' target':'No target';
      $('sessionTimeline').textContent=(sessionStartMinutes(s)!==null?'Starts '+formatClock(sessionStartMinutes(s))+' · Ends '+formatClock(sessionStartMinutes(s)+total)+' · ':'')+s.entries.length+' practices · '+total+' minutes total'+(target?' / '+target+' planned':'');
    }
  });
  $(id).addEventListener('change',()=>renderSession());
}
$('sessionPracticeBank').addEventListener('click',e=>{const b=e.target.closest('[data-add-drill]');if(b)addDrillToSession(b.dataset.addDrill);});
$('sessionPracticeSearch').addEventListener('input',renderSessionBank);
$('sessionPracticePrinciple').addEventListener('change',renderSessionBank);
$('sessionPracticeType').addEventListener('change',renderSessionBank);
$('sessionRows').addEventListener('click',e=>{
  const b=e.target.closest('[data-entry-action]');if(!b)return;
  const arr=activeSession().entries,i=arr.findIndex(x=>x.entryId===b.dataset.entryId);if(i<0)return;
  const action=b.dataset.entryAction;
  if(action==='edit'){selectDrill(arr[i].drillId);return;}
  if(action==='remove')arr.splice(i,1);
  if(action==='up'||action==='down'){
    const j=i+(action==='up'?-1:1);if(j<0||j>=arr.length)return;
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  touchSession();renderSession();
});
$('sessionRows').addEventListener('change',e=>{
  const el=e.target,arr=activeSession().entries;
  if(el.dataset.entryDuration){const entry=arr.find(x=>x.entryId===el.dataset.entryDuration);if(!entry)return;entry.duration=clamp(Number(el.value)||1,1,600);}
  else if(el.dataset.entryNote){const entry=arr.find(x=>x.entryId===el.dataset.entryNote);if(!entry)return;entry.notes=el.value;}
  else return;
  touchSession();renderSession();
});
// Desktop HTML drag/drop with reliable touch-friendly ↑/↓ fallback on iPadOS.
let sessionDrag=null;
$('sessionPracticeBank').addEventListener('dragstart',e=>{
  const item=e.target.closest('[data-bank-drill]');if(!item)return;
  sessionDrag={kind:'bank',id:item.dataset.bankDrill};
  e.dataTransfer.effectAllowed='copy';e.dataTransfer.setData('text/plain',item.dataset.bankDrill);
});
$('sessionRows').addEventListener('dragstart',e=>{
  if(e.target.closest('input,button,textarea')){e.preventDefault();return;}
  const item=e.target.closest('[data-session-entry]');if(!item)return;
  sessionDrag={kind:'entry',id:item.dataset.sessionEntry};item.classList.add('is-dragging');
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',item.dataset.sessionEntry);
});
$('sessionRows').addEventListener('dragover',e=>{
  if(!sessionDrag)return;
  e.preventDefault();e.dataTransfer.dropEffect=sessionDrag.kind==='bank'?'copy':'move';$('sessionRows').classList.add('drop-target');
});
$('sessionRows').addEventListener('drop',e=>{
  e.preventDefault();if(!sessionDrag)return;
  const arr=activeSession().entries;const row=e.target.closest('[data-session-entry]');let at=row?arr.findIndex(x=>x.entryId===row.dataset.sessionEntry):arr.length;if(at<0)at=arr.length;
  if(sessionDrag.kind==='bank')addDrillToSession(sessionDrag.id,at);
  else {
    const from=arr.findIndex(x=>x.entryId===sessionDrag.id);
    if(from>=0){const [moving]=arr.splice(from,1);if(from<at)at--;arr.splice(at,0,moving);touchSession();renderSession();}
  }
  sessionDrag=null;$('sessionRows').classList.remove('drop-target');
});
for(const id of ['sessionRows','sessionPracticeBank'])$(id).addEventListener('dragend',()=>{sessionDrag=null;$('sessionRows').classList.remove('drop-target');document.querySelectorAll('.session-activity.is-dragging').forEach(x=>x.classList.remove('is-dragging'));});
function printable(){
  const s=activeSession(),total=sessionTotal(s),start=sessionStartMinutes(s);let elapsed=0;
  const heading='<div class="print-brand"><img src="'+document.querySelector('.brand-logo').src+'" alt="CoachTomAsh logo"><strong>TRAINING SESSION PLAN</strong></div>';
  const info='<h1>'+esc(s.title)+'</h1><div class="meta">'+[s.age,s.date,s.startTime?('Start '+s.startTime):'',s.venue,s.coach].filter(Boolean).map(esc).join(' • ')+'</div>'+
  '<div class="print-summary"><p><b>Duration:</b> '+total+' minutes'+(s.target?' / '+esc(s.target)+' planned':'')+' &nbsp; <b>Focus:</b> '+esc(s.principle||'Mixed')+(s.curriculumAssigned?(s.blockNumber?' &nbsp; <b>Programme:</b> Block '+esc(s.blockNumber)+(s.weekNumber?' · Week '+esc(s.weekNumber):''):''):(s.block?' &nbsp; <b>Block:</b> '+esc(s.block):''))+'</p>'+
  '<p><b>Learning outcomes:</b> '+esc(s.objective||'Not set')+'</p>'+(s.notes?'<p><b>Delivery notes:</b> '+esc(s.notes)+'</p>':'')+'</div>';
  const rows=s.entries.map((entry,i)=>{
    const d=state.drills.find(x=>x.id===entry.drillId);if(!d)return '';
    const duration=sessionDuration(entry),window=clockRange(start===null?null:start+elapsed,duration);elapsed+=duration;
    const f=d.frames&&d.frames[0]?d.frames[0]:{objects:[],paths:[]};
    return '<section class="print-session"><h2>'+(i+1)+'. '+esc(d.name)+'</h2><div class="meta">'+[window, duration+' min',d.age,d.principle,d.practiceType,d.players+' players',d.area].filter(Boolean).map(esc).join(' | ')+'</div>'+
      '<div class="print-cols"><svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -39 1120 728">'+draw(f.objects,f.paths,d.pitchType||'full',null,d)+'</svg><div>'+
      [['Objective',d.objective],['Organisation',d.organisation],['Conditions / constraints',d.constraints],['Coaching points',d.coaching],['Progressions',d.progressions],['Success criteria',d.success],['Session-specific notes',entry.notes]].filter(x=>x[1]).map(([label,value])=>'<p><b>'+label+':</b> '+esc(value)+'</p>').join('')+'</div></div></section>';
  }).join('');
  return heading+info+rows;
}
$('printSession').onclick=()=>{
  if(!activeSession().entries.length){toast('Add at least one practice before printing');return;}
  $('printDoc').innerHTML=printable();window.print();
};
window.addEventListener('keydown',e=>{const el=document.activeElement;if(['INPUT','TEXTAREA','SELECT'].includes(el?.tagName))return;if((e.key==='Delete'||e.key==='Backspace')&&activeTab==='design'){$('deleteBtn').click();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$('undoBtn').click();}});
window.addEventListener('beforeunload',()=>{if(playing)stopPlayback();});
function boot(){load();document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{stopPlayback();chooseTab(b.dataset.tab);});setTool('select');refresh();}
boot();
