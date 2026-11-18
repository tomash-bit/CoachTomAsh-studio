/* CoachTomAsh Studio v1.5: IndexedDB persistence, recovery & snapshots.
   LocalStorage remains an immediate v1-compatible mirror. Never delete legacy data. */
(function (root) {
  'use strict';
  const LEGACY_KEY = 'coachtomash-studio-v1';
  const DB_NAME = 'coachtomash-studio-offline-v1';
  const DB_VERSION = 1;
  const SNAPSHOT_MS = 5 * 60 * 1000;
  const SNAPSHOT_LIMIT = 18;
  const records = {main: 'current'};
  let capturedLegacy = null;
  try { capturedLegacy = root.localStorage.getItem(LEGACY_KEY) || root.localStorage.getItem('elitecoach-studio-v1'); }
  catch (_) {}
  let db = null, ready = false, available = false, lastError = '', lastSnapshotAt = 0;
  let pending = null, writer = null, debounce = 0, lastSavedAt = 0;
  const notify = () => root.dispatchEvent(new CustomEvent('cta-storage-status', {detail: info()}));
  const getError = e => (e && (e.message || e.name)) || String(e || 'Unknown error');

  function checksum(raw) { // Fast corruption check; not a cryptographic signature.
    let n = 2166136261;
    for (let i=0;i<raw.length;i++) {n ^= raw.charCodeAt(i);n = Math.imul(n,16777619);}
    return (n>>>0).toString(16).padStart(8,'0');
  }
  function validState(value) {
    return !!value && typeof value==='object' && Array.isArray(value.drills) && value.drills.length > 0 &&
      value.drills.every(d => !!d && typeof d.id==='string' && Array.isArray(d.frames) && d.frames.length>0 &&
        d.frames.every(f => !!f && Array.isArray(f.objects) && Array.isArray(f.paths))) &&
      (value.sessions===undefined || Array.isArray(value.sessions));
  }
  function parse(raw) { try {const v=JSON.parse(raw);return validState(v)?v:null;} catch (_) {return null;} }
  function validRecord(record) {
    return record && typeof record.raw==='string' && checksum(record.raw)===record.hash && parse(record.raw);
  }
  const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  const transactionDone = tx => new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error || new Error('Transaction aborted'));
  });
  async function open() { // Need upgrade handler before the request can complete.
    if (!('indexedDB' in root)) throw new Error('IndexedDB is unavailable');
    const req=root.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded=()=>{
      const data=req.result;
      if(!data.objectStoreNames.contains('records')) data.createObjectStore('records',{keyPath:'key'});
      if(!data.objectStoreNames.contains('snapshots')) data.createObjectStore('snapshots',{keyPath:'id'});
    };
    db=await request(req);
    db.onversionchange=()=>{db.close();db=null;available=false;lastError='Storage version changed; reload the app.';notify();};
    available=true;
    return db;
  }
  async function getMain() {return request(db.transaction('records','readonly').objectStore('records').get(records.main));}
  async function listSnapshots() {
    if (!db) return [];
    const entries=await request(db.transaction('snapshots','readonly').objectStore('snapshots').getAll());
    return entries.sort((a,b)=>b.savedAt-a.savedAt);
  }
  function makeRecord(state, reason='autosave') {
    const raw=JSON.stringify(state);
    if (!parse(raw)) throw new Error('The app refused to save invalid practice data');
    return {key:records.main,raw,hash:checksum(raw),savedAt:Date.now(),reason};
  }
  async function writeRecord(state, reason='autosave', forceSnapshot=false) {
    if (!available || !db) return false;
    const entry=makeRecord(state,reason);
    const snapshot=forceSnapshot || entry.savedAt-lastSnapshotAt >= SNAPSHOT_MS;
    const tx=db.transaction(['records','snapshots'],'readwrite');
    tx.objectStore('records').put(entry);
    if (snapshot) {
      tx.objectStore('snapshots').put({id:entry.savedAt+'-'+Math.random().toString(36).slice(2,8),
        raw:entry.raw,hash:entry.hash,savedAt:entry.savedAt,reason,
        drills:state.drills.length,sessions:Array.isArray(state.sessions)?state.sessions.length:0});
    }
    await transactionDone(tx);
    lastSavedAt=entry.savedAt;
    if(snapshot) lastSnapshotAt=entry.savedAt;
    if(snapshot) await pruneSnapshots();
    notify();
    return true;
  }
  async function pruneSnapshots() {
    const items=await listSnapshots();
    if(items.length<=SNAPSHOT_LIMIT)return;
    const tx=db.transaction('snapshots','readwrite');
    for(const item of items.slice(SNAPSHOT_LIMIT))tx.objectStore('snapshots').delete(item.id);
    await transactionDone(tx);
  }
  async function initialize(getWorkingState, adoptRecoveredState) {
    try {
      await open();
      const stored=await getMain();
      const snapshots=await listSnapshots();
      lastSnapshotAt=snapshots[0]?.savedAt || 0;
      let recoverable=validRecord(stored)?{record:stored,source:'primary'}:null;
      if(!recoverable) for(const item of snapshots) {
        if(validRecord(item)) {recoverable={record:item,source:'snapshot'};break;}
      }
      const oldState=parse(capturedLegacy);
      if(oldState) {
        // A successful v1.4 save is authoritative. Keep historical backup if it differs.
        if(recoverable && recoverable.record.raw===JSON.stringify(oldState)) {
          lastSavedAt=recoverable.record.savedAt;
        } else {
        if(recoverable) {
          const previous=JSON.parse(recoverable.record.raw);
          await writeRecord(previous,'pre-migration safety copy',true);
        }
        await writeRecord(oldState,recoverable?'migration sync':'v1.4 migration',true);
        }
      } else if(recoverable) {
        const restored=JSON.parse(recoverable.record.raw);
        adoptRecoveredState(restored);
        try {root.localStorage.setItem(LEGACY_KEY,recoverable.record.raw);}catch(_){}
        // Re-establish a healthy primary if the old primary was corrupt.
        if(recoverable.source==='snapshot') await writeRecord(restored,'automatic snapshot recovery',true);
      } else {
        // No historical data: retain app's initial session; never treat corruption as a blank library silently.
        const working=getWorkingState();
        if(validState(working)) await writeRecord(working,'initial local library',true);
      }
      ready=true;
      notify();
      return {available:true,recovered:!oldState && !!recoverable,
        fromSnapshot:!oldState && recoverable?.source==='snapshot',
        corruptedLocal:!!capturedLegacy && !oldState};
    } catch(e) {
      available=false;
      lastError=getError(e);
      ready=true;notify();
      return {available:false,error:lastError,corruptedLocal:!!capturedLegacy && !parse(capturedLegacy)};
    }
  }
  function queueSave(state) {
    if(!ready || !available)return;
    try {pending=JSON.parse(JSON.stringify(state));} catch(e){lastError=getError(e);notify();return;}
    clearTimeout(debounce);
    debounce=setTimeout(()=>{flush().catch(e=>{lastError=getError(e);notify();});},550);
  }
  async function flush() {
    clearTimeout(debounce);debounce=0;
    if(!ready || !available)return false;
    if(writer) {await writer;if(pending)return flush();return true;}
    if(!pending)return true;
    const state=pending;pending=null;
    writer=writeRecord(state).catch(e=>{lastError=getError(e);notify();return false;});
    const ok=await writer;writer=null;
    if(pending)return flush();
    return ok;
  }
  async function saveSnapshot(state,reason='manual recovery point') {
    if(!available)throw new Error(lastError||'IndexedDB backup storage unavailable');
    await flush();
    return writeRecord(state,reason,true);
  }
  async function getRecoveryPoints() {
    if(!available)return [];
    const list=await listSnapshots();
    return list.map(({id,savedAt,reason,drills,sessions})=>({id,savedAt,reason,drills,sessions}));
  }
  async function getSnapshotState(id) {
    if(!available)throw new Error('IndexedDB unavailable');
    const record=await request(db.transaction('snapshots','readonly').objectStore('snapshots').get(id));
    const parsed=validRecord(record);
    if(!parsed)throw new Error('Recovery point is missing or failed integrity checks');
    return parsed;
  }
  function info() {return {ready,available,lastError,lastSavedAt,lastSnapshotAt,legacyKey:LEGACY_KEY};}
  root.CTAStorage={initialize,queueSave,flush,saveSnapshot,getRecoveryPoints,getSnapshotState,
    info,validState,checksum, // testable pure helpers
    capturedLegacy:()=>capturedLegacy};
})(window);
