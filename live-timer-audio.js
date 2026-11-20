/* CoachTomAsh Studio v1.8.3 | Offline timer audio alerts.
   Generated tones, no audio downloads/network, user-gesture audio unlock for iPad.
   Preferences are stored separately from the coaching library. */
'use strict';
(() => {
  const KEY='coachtomash-live-audio-v1';
  const defaults={enabled:true,warning:true,volume:75};
  const restrict=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  let settings={...defaults};
  try {
    const prior=JSON.parse(localStorage.getItem(KEY)||'null');
    if(prior && typeof prior==='object'){
      if(typeof prior.enabled==='boolean')settings.enabled=prior.enabled;
      if(typeof prior.warning==='boolean')settings.warning=prior.warning;
      if(Number.isFinite(Number(prior.volume)))settings.volume=restrict(prior.volume,0,100);
    }
  }catch(_){/* Private storage restrictions must not stop the app. */}
  let ctx=null;
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  const by=id=>document.getElementById(id);
  function save(){try{localStorage.setItem(KEY,JSON.stringify(settings));}catch(_){}}
  function status(message){const label=by('liveSoundStatus');if(label)label.textContent=message;}
  function unlock(){
    if(!settings.enabled)return null;
    if(!AudioCtor){status('Audio unavailable in this browser');return null;}
    try {
      if(!ctx)ctx=new AudioCtor();
      if(ctx.state==='suspended' && typeof ctx.resume==='function'){
        const result=ctx.resume();
        if(result&&typeof result.catch==='function')result.catch(()=>status('Tap Test sound to enable audio'));
      }
      return ctx;
    }catch(_){status('Audio unavailable on this device');return null;}
  }
  function tone(context,frequency,start,duration,level=.85,type='sine'){
    const osc=context.createOscillator(),env=context.createGain();
    const volume=(settings.volume/100)*.24*level;
    osc.type=type;osc.frequency.setValueAtTime(frequency,start);
    env.gain.setValueAtTime(.0001,start);
    env.gain.linearRampToValueAtTime(Math.max(.0001,volume),start+.016);
    env.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(env);env.connect(context.destination);
    osc.start(start);osc.stop(start+duration+.012);
    osc.onended=()=>{try{osc.disconnect();env.disconnect();}catch(_){}};
  }
  function play(kind,event){
    if(!settings.enabled||settings.volume===0)return false;
    if(event==='warning'&&!settings.warning)return false;
    const c=unlock();if(!c)return false;
    const t=c.currentTime+.012;
    try {
      if(event==='warning'){
        tone(c,kind==='rest'?940:610,t,.16,.56,'sine');
      } else if(kind==='rest'){
        tone(c,900,t,.28,.70,'sine');
        tone(c,1175,t+.28,.43,.68,'sine');
      } else {
        tone(c,880,t,.21,1,'triangle');
        tone(c,740,t+.26,.21,1,'triangle');
        tone(c,620,t+.52,.34,1,'triangle');
      }
      return true;
    }catch(_){status('Unable to play audio alert');return false;}
  }
  function updateUI(){
    const enabled=by('liveSoundEnabled'),warning=by('liveSoundWarning'),vol=by('liveSoundVolume');
    if(!enabled||!warning||!vol)return;
    enabled.checked=settings.enabled;warning.checked=settings.warning;
    vol.value=settings.volume;warning.disabled=!settings.enabled;
    vol.disabled=!settings.enabled;
    by('liveSoundVolumeValue').textContent=settings.volume+'%';
    by('liveSoundSummary').textContent=settings.enabled?'On · '+(settings.warning?'10s warning':'No warning'):'Muted';
    by('liveSoundTestWork').disabled=!settings.enabled||settings.volume===0;
    by('liveSoundTestRest').disabled=!settings.enabled||settings.volume===0;
    status(settings.enabled?'Sound alerts armed after pressing Start or Test':'Sound alerts muted');
  }
  function mount(){
    if(!by('liveSoundEnabled'))return;
    by('liveSoundEnabled').addEventListener('change',e=>{settings.enabled=e.target.checked;if(settings.enabled)unlock();save();updateUI();});
    by('liveSoundWarning').addEventListener('change',e=>{settings.warning=e.target.checked;save();updateUI();});
    by('liveSoundVolume').addEventListener('input',e=>{settings.volume=restrict(e.target.value,0,100);save();updateUI();});
    by('liveSoundTestWork').addEventListener('click',()=>{const ok=play('practice','complete');if(ok)status('Played WORK test alert');});
    by('liveSoundTestRest').addEventListener('click',()=>{const ok=play('rest','complete');if(ok)status('Played REST test alert');});
    updateUI();
  }
  window.CTALiveTimerAudio={mount,unlock,playWarning:kind=>play(kind,'warning'),playComplete:kind=>play(kind,'complete'),getSettings:()=>({...settings})};
})();
