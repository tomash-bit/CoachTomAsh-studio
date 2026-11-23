/* v1.11 presentation-only enhancement: no schema, storage, or app-core changes. */
(()=>{ 'use strict';
 const $=id=>document.getElementById(id);
 const palette=document.querySelector('.palette-col'), notes=document.querySelector('.notes-col');
 const tools=$('compactToolsToggle'), details=$('compactDetailsToggle'), animation=$('compactAnimationToggle');
 if(!palette||!notes||!tools||!details||!animation)return;
 const catMap={players:['select','player','opponent','neutral'],equipment:['ball','cone','goal','fullgoal','mannequin','zone','text'],actions:['move','pass','dribble','press','curve-pass','curve-move']};
 function setCategory(cat){
  document.querySelectorAll('.compact-category').forEach(b=>{b.classList.toggle('active',b.dataset.category===cat);b.setAttribute('aria-pressed',String(b.dataset.category===cat));});
  document.querySelectorAll('#toolGrid [data-tool]').forEach(b=>{
   b.hidden=cat!=='all' && !(catMap[cat]||[]).includes(b.dataset.tool);
  });
 }
 $('compactCategories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b)setCategory(b.dataset.category)});
 setCategory('players');
 function setTools(open){palette.classList.toggle('compact-tools-closed',!open);tools.setAttribute('aria-expanded',String(open));tools.textContent=open?'☰ Hide tools':'☰ Tools';}
 tools.addEventListener('click',()=>setTools(palette.classList.contains('compact-tools-closed')));
 function setDetails(open){notes.classList.toggle('compact-details-open',open);details.setAttribute('aria-expanded',String(open));details.textContent=open?'✕ Close details':'✎ Practice details';}
 details.addEventListener('click',()=>setDetails(!notes.classList.contains('compact-details-open')));
 const close=document.createElement('button');close.className='btn small compact-close-details';close.type='button';close.textContent='✕ Close';close.addEventListener('click',()=>setDetails(false));notes.insertBefore(close,notes.firstChild);
 const advanced=$('animationProPanel');
 function setAnimation(open){advanced.classList.toggle('compact-animation-open',open);animation.setAttribute('aria-expanded',String(open));animation.textContent=open?'✕ Hide animation options':'▶ Animation options';}
 animation.addEventListener('click',()=>setAnimation(!advanced.classList.contains('compact-animation-open')));
 // The current animation selection remains usable via the always-visible frame and scrubber controls.
 // Session fields are reorganised in place; existing listeners and element IDs remain untouched.
 const session=document.querySelector('.session-workspace > .card:first-child');
 if(session){
  const rows=[...session.children];
  const firstNotes=rows.find(el=>el.querySelector?.('#s-venue'));
  if(firstNotes){
   const extra=document.createElement('details');extra.className='compact-session-extra';
   const summary=document.createElement('summary');summary.textContent='More session details • venue, curriculum, objectives and notes';extra.append(summary);
   let node=firstNotes;
   while(node){const next=node.nextElementSibling;extra.append(node);node=next;}
   session.append(extra);
  }
 }
 const bank=$('sessionPracticeBank');
 if(bank){const holder=document.createElement('details');holder.className='compact-bank';holder.open=true;
 const heading=document.createElement('summary');heading.textContent='Add practices from library';
 const sub=document.querySelector('.session-builder-sub');
 if(sub){sub.before(holder);sub.remove();}else bank.before(holder);
 holder.append(heading);
 const filters=document.querySelector('.session-bank-controls');if(filters)holder.append(filters);
 holder.append(bank);
 }
 // v1.11.1: premium rail and progressive-disclosure menus; preserve original elements/listeners.
 const toolIcons={select:'↖',player:'●',opponent:'●',neutral:'◉',ball:'⚽',cone:'▲',goal:'▯',fullgoal:'▤',mannequin:'♙',zone:'▧',text:'T',move:'➜',pass:'⟶',dribble:'⇢',press:'↝','curve-pass':'↷','curve-move':'⤴'};
 document.querySelectorAll('#toolGrid [data-tool]').forEach(b=>{
   const original=b.textContent.trim();b.title=original;b.setAttribute('aria-label',original);
   b.innerHTML='<span class="elite-tool-icon" aria-hidden="true">'+(toolIcons[b.dataset.tool]||'•')+'</span><span class="elite-tool-label">'+original.replace(/^[^A-Za-z]+/,'').trim()+'</span>';
 });
 const catIcons={players:'◉',equipment:'▱',actions:'➜',all:'▦'};
 document.querySelectorAll('.compact-category').forEach(b=>{
  const label=b.textContent.trim();b.title=label;b.setAttribute('aria-label',label);
  b.innerHTML='<span aria-hidden="true">'+catIcons[b.dataset.category]+'</span><small>'+label+'</small>';
 });
 const head=palette.querySelector('.section-head');
 if(head){head.querySelector('h2').textContent='CREATE';}
 const swatches=$('swatches');
 if(swatches){
   const originalRow=swatches.closest('.form-row');
   const colours=document.createElement('details');colours.className='elite-colour-menu';
   const colourSummary=document.createElement('summary');colourSummary.innerHTML='<span class="elite-colour-dot" id="eliteColourDot"></span><span>Colours</span><span class="elite-chevron">⌄</span>';
   colours.append(colourSummary);colours.append(originalRow);
   palette.insertBefore(colours,document.querySelector('#toolGrid').nextSibling);
   const dot=$('eliteColourDot');
   const updateColour=()=>{const selected=swatches.querySelector('.active,.selected,[aria-pressed="true"]');dot.style.background=selected?.dataset.color||'#1a2b5f'};
   swatches.addEventListener('click',()=>requestAnimationFrame(updateColour));updateColour();
   document.addEventListener('click',e=>{if(colours.open&&!colours.contains(e.target))colours.open=false});
 }
 const objectMenu=document.createElement('details');objectMenu.className='elite-object-menu';
 objectMenu.innerHTML='<summary>⚙ Object & formation settings <span>⌄</span></summary>';
 const grid=$('toolGrid');
 // Move, never clone: existing event handlers and DOM IDs remain intact.
 let next=grid.nextElementSibling;
 while(next){const following=next.nextElementSibling;if(next!==objectMenu && !next.classList.contains('elite-colour-menu'))objectMenu.append(next);next=following;}
 palette.append(objectMenu);
 // Contextual object editing is always accessible through a compact menu.
 const observer=new MutationObserver(()=>{
  const active=[...objectMenu.querySelectorAll('#rotationPanel,#goalSizePanel,#curvePanel')].some(x=>!x.hidden);
  if(active)objectMenu.classList.add('elite-has-selection');else objectMenu.classList.remove('elite-has-selection');
 });
 ['rotationPanel','goalSizePanel','curvePanel'].forEach(id=>{const el=$(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden']})});
  // Escape closes details without mutating the underlying practice.
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&notes.classList.contains('compact-details-open'))setDetails(false)});
})();
