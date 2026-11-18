/* CoachTomAsh Studio v1.5: on-device recovery panel and safe migration UI. */
(() => {
  'use strict';
  const engine=window.CTAStorage;
  const gate=document.getElementById('storageGate');
  const status=document.getElementById('storageStatus');
  const dialog=document.getElementById('storageDialog');
  const message=document.getElementById('storageMessage');
  const list=document.getElementById('recoveryList');
  const guard=document.getElementById('snapshotNow');
  const stamp=ms=>ms?new Date(ms).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'}):'Not yet saved';
  function updateStatus(){
    const info=engine.info();
    status.textContent=info.available?'● Local recovery active':'⚠ JSON backups needed';
    status.title=info.available?'Local-only IndexedDB autosave. No cloud account is used.':(info.lastError||'IndexedDB unavailable');
    message.textContent=info.available?
      'Your library is saved immediately in the original browser format and mirrored into IndexedDB. Recovery points are kept on this device only. Last IndexedDB save: '+stamp(info.lastSavedAt)+'.':
      'IndexedDB recovery is unavailable: '+(info.lastError||'Unknown issue')+'. Your original browser save should still work. Please export a JSON backup regularly.';
    guard.disabled=!info.available;
  }
  async function refreshRecovery(){
    updateStatus();
    try {
      const points=await engine.getRecoveryPoints();
      list.innerHTML=points.length?points.map(item=>
        '<div class="recovery-point"><div><strong>'+esc(stamp(item.savedAt))+'</strong><small>'+esc(item.reason||'Automatic backup')+' · '+item.drills+' practices · '+item.sessions+' sessions</small></div><div class="recovery-actions"><button type="button" class="btn small" data-download-point="'+esc(item.id)+'">JSON</button><button type="button" class="btn small dark" data-restore-point="'+esc(item.id)+'">Restore</button></div></div>').join(''):
        '<p class="hint">No recovery points yet. Use Create recovery point after saving a practice.</p>';
    } catch(e) {list.textContent='Could not load recovery points: '+e.message;}
  }
  document.getElementById('storageOpen').addEventListener('click',()=>{dialog.showModal();refreshRecovery();});
  document.getElementById('storageClose').addEventListener('click',()=>dialog.close());
  document.getElementById('storageRefresh').addEventListener('click',refreshRecovery);
  document.getElementById('storageExport').addEventListener('click',()=>document.getElementById('backupBtn').click());
  guard.addEventListener('click',async()=>{
    guard.disabled=true;
    try {await engine.saveSnapshot(state,'manual recovery point');toast('On-device recovery point created');await refreshRecovery();}
    catch(e) {alert('Recovery point failed: '+e.message+'\nExport a JSON backup instead.');}
    finally {guard.disabled=!engine.info().available;}
  });
  list.addEventListener('click',async event=>{
    const target=event.target.closest('button');if(!target)return;
    const id=target.dataset.downloadPoint||target.dataset.restorePoint;
    if(!id)return;
    try {
      const recovered=await engine.getSnapshotState(id);
      if(target.dataset.downloadPoint){
        downloadText('CoachTomAsh_Recovery_'+safeFilename(new Date().toISOString().slice(0,19))+'.json',
          JSON.stringify({format:'coachtomash-studio-v1',exported:new Date().toISOString(),state:recovered},null,2),'application/json');
        return;
      }
      if(!confirm('Restore this recovery point?\n\nYour CURRENT practices and sessions will be replaced on this device. A safety snapshot of the current library will be made first. Export a JSON backup for extra protection.'))return;
      target.disabled=true;
      await engine.saveSnapshot(state,'before manual restore');
      // Validate the full library before replacing anything.
      if(!engine.validState(recovered))throw new Error('Selected recovery point has invalid practice data');
      state=copy(recovered);
      ensureSessionState();
      frameIndex=0;selectedId=null;selectedPath=null;undoStack=[];
      if(!persist())throw new Error('Restored data could not be written to browser storage. Export your library immediately.');
      await engine.saveSnapshot(state,'manual restore completed');
      refresh();renderSession();renderLibrary();
      dialog.close();toast('Recovery restored. Your library is ready.');
    } catch(e){alert('Recovery failed: '+e.message);}
    finally {target.disabled=false;}
  });
  // The legacy save path stays synchronous for every existing module. IndexedDB is
  // a second durable store, never a destructive replacement of the original key.
  const oldPersist=persist;
  persist=function(){const ok=oldPersist();engine.queueSave(state);return ok;};
  // Save a recovery point immediately before any JSON import might replace state.
  document.getElementById('fileInput').addEventListener('change',()=>{
    if(engine.info().available)engine.saveSnapshot(state,'before imported backup').catch(e=>console.warn('Pre-import recovery unavailable',e));
  },true);
  window.addEventListener('cta-storage-status',updateStatus);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')engine.flush();});
  window.addEventListener('pagehide',()=>{engine.flush();});
  async function initialize(){
    try {
      const result=await engine.initialize(()=>state,recovered=>{
        state=copy(recovered);
        ensureSessionState();
        frameIndex=0;selectedId=null;selectedPath=null;undoStack=[];
        refresh();renderLibrary();renderSession();
      });
      if(result.recovered) {
        const kind=result.fromSnapshot?'an earlier recovery point':'your previous library';
        toast('Restored '+kind+' from this device');
      }
      if(result.corruptedLocal && !result.recovered){
        alert('The original browser library could not be read. Check Data safety for available recovery points and import your JSON backup if needed.');
      }
      if(!result.available) console.warn('IndexedDB recovery disabled:',result.error);
    } catch(error) {console.error('Could not initialise recovery',error);}
    finally {updateStatus();gate.hidden=true;}
  }
  initialize();
})();
