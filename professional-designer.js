/* v1.12 progressive enhancement. Existing handlers, object IDs, and storage are unchanged. */
(()=>{'use strict';
 const $=id=>document.getElementById(id), pitch=$('pitch'), palette=document.querySelector('#panel-design .palette-col');
 if(!pitch||!palette)return;
 window.CoachPrecision={enabled:false,step:2};
 const top=$('panel-design').querySelector('.compact-actions');
 const snap=document.createElement('label');snap.className='pro12-snap';snap.innerHTML='<input type="checkbox" id="pro12Snap"> <span>Snap 2%</span>';
 top.prepend(snap);$('pro12Snap').addEventListener('change',e=>window.CoachPrecision.enabled=e.target.checked);
 // Contextual toolbar uses the application's existing actions, avoiding duplicated editing logic.
 const bar=document.createElement('div');bar.id='pro12Context';bar.className='pro12-context';bar.hidden=true;
 bar.innerHTML='<span class="pro12-selection" id="pro12Selected">Selected</span><button type="button" data-pro12="colour">● Colour</button><button type="button" data-pro12="label">✎ Label</button><button type="button" data-pro12="rotate">↻ Rotate</button><button type="button" data-pro12="duplicate">⧉ Copy</button><button type="button" data-pro12="delete" class="pro12-danger">Delete</button><button type="button" data-pro12="close" aria-label="Dismiss toolbar">×</button>';
 const wrap=document.querySelector('#panel-design .pitch-wrap');wrap.before(bar);
 const objectMenu=palette.querySelector('.elite-object-menu'), colourMenu=palette.querySelector('.elite-colour-menu');
 function sync(){
  const selected=pitch.querySelector('[data-oid]:has(circle[stroke="#ffdf69"])');
  // Core editor draws a selection halo as a dashed yellow circle; query that halo directly.
  const halo=[...pitch.querySelectorAll('[data-oid]')].find(g=>g.querySelector('circle[stroke="#ffdf69"]'));
  const path=[...pitch.querySelectorAll('[data-pid]')].find(g=>g.querySelector('path[stroke-width="7"]'));
  const has=!!halo||!!path;
  bar.hidden=!has; if(!has)return;
  const label=halo?.querySelector('text')?.textContent|| (halo?'Object':'Movement');
  $('pro12Selected').textContent=halo?'Selected · '+label:'Selected movement';
  bar.querySelector('[data-pro12="colour"]').hidden=!halo;
  bar.querySelector('[data-pro12="label"]').hidden=!halo;
  bar.querySelector('[data-pro12="rotate"]').hidden=!halo;
  bar.querySelector('[data-pro12="duplicate"]').hidden=!halo;
 }
 let pending=false;const observer=new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;sync();});}});
 observer.observe(pitch,{childList:true,subtree:false});
 function openTab(tab){if(objectMenu){objectMenu.open=true;objectMenu.querySelector('[data-settings-tab="'+tab+'"]')?.click();}}
 bar.addEventListener('click',e=>{const b=e.target.closest('[data-pro12]');if(!b)return;
  switch(b.dataset.pro12){
   case 'colour':if(colourMenu){colourMenu.open=true;colourMenu.querySelector('summary')?.scrollIntoView({block:'nearest'});}break;
   case 'label':openTab('object');$('objectLabel')?.focus();break;
   case 'rotate':openTab('object');$('rotationPanel')?.scrollIntoView({block:'nearest'});break;
   case 'duplicate':$('duplicateBtn')?.click();break;
   case 'delete':$('deleteBtn')?.click();break;
   case 'close':bar.hidden=true;break;
  }
 });
 // Compact the existing tool rail: opening a category reveals only its relevant tools.
 palette.classList.add('pro12-rail');
 const categories=$('compactCategories');
 if(categories){categories.addEventListener('click',()=>palette.classList.add('pro12-category-open'));}
 // Clicking outside the palette dismisses the temporary tool drawer, never the active editor tool.
 document.querySelector('#panel-design .canvas-col')?.addEventListener('pointerdown',()=>palette.classList.remove('pro12-category-open'));
 const timeline=$('panel-design').querySelector('.frames');if(timeline){timeline.classList.add('pro12-timeline');
  const advanced=document.createElement('details');advanced.className='pro12-timeline-more';advanced.innerHTML='<summary>Advanced timeline & export</summary>';
  const extras=[...timeline.children].filter(el=>!el.classList.contains('frames-row')&&!el.classList.contains('frame-dots')&&!el.classList.contains('timeline-ui'));
  extras.forEach(el=>advanced.append(el));timeline.append(advanced);
 }
 // Session bank: quick-add search and one-row practice cards. Existing add/reorder listeners remain in place.
 const bank=$('sessionPracticeBank');if(bank){bank.classList.add('pro12-bank');
  const filter=$('sessionPracticeSearch');if(filter){filter.placeholder='Find a practice to add…';filter.setAttribute('autocomplete','off');}
  const search=document.createElement('button');search.type='button';search.className='btn small pro12-quick-add';search.textContent='＋ Find practice';
  const running=$('sessionRows');running?.before(search);
  search.addEventListener('click',()=>{const holder=bank.closest('details');if(holder)holder.open=true;filter?.focus();filter?.scrollIntoView({block:'nearest'});});
  // Keep the bank collapsed until needed, reducing session-builder scrolling.
  const holder=bank.closest('details');if(holder)holder.open=false;
 }
 sync();
})();
