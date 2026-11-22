/* CoachTomAsh Studio v1.10: evidence-led coaching intelligence. Read-only aggregation. */
(function(root,factory){const api=factory();root.CTAInsights=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PS=['Patience','Progress','Penetrate','Protect','Prevent'];
const arr=x=>Array.isArray(x)?x:[]; const n=x=>Number.isFinite(+x)&&+x>0?+x:0;
function build(state){
 const drills=new Map(arr(state?.drills).map(d=>[d.id,d]));
 const sessions=arr(state?.sessions), records=arr(state?.liveDelivery?.records).filter(r=>r?.status==='delivered'&&Array.isArray(r?.plan?.entries));
 const ages=[...new Set([...sessions.map(s=>s.age),...records.map(r=>r.plan?.age)].filter(Boolean))].sort();
 const byAge=ages.map(age=>{const rs=records.filter(r=>r.plan?.age===age);const practices=rs.flatMap(r=>r.plan.entries.map(e=>({e,r,o:r.practices?.[e.entryId]||{},d:drills.get(e.drillId)})));
 const outcomes={achieved:0,partial:0,revisit:0,unreviewed:0};practices.forEach(x=>{const k=['achieved','partial','revisit'].includes(x.o.outcome)?x.o.outcome:'unreviewed';outcomes[k]++;});
 return {age,planned:sessions.filter(s=>s.age===age).length,deliveries:rs.length,practices:practices.length,reviewed:practices.length-outcomes.unreviewed,reviewRate:practices.length?Math.round((practices.length-outcomes.unreviewed)/practices.length*100):0,outcomes};});
 const principle=PS.map(p=>{const practices=records.flatMap(r=>r.plan.entries.map(e=>({e,o:r.practices?.[e.entryId]||{},d:drills.get(e.drillId)}))).filter(x=>x.d?.principle===p);const reviewed=practices.filter(x=>['achieved','partial','revisit'].includes(x.o.outcome));return {name:p,delivered:practices.length,reviewed:reviewed.length,achieved:reviewed.filter(x=>x.o.outcome==='achieved').length,partial:reviewed.filter(x=>x.o.outcome==='partial').length,revisit:reviewed.filter(x=>x.o.outcome==='revisit').length};});
 const reflections=records.reduce((a,r)=>{const v=r.reviewV19||{};a.whatWorked+=!!String(v.whatWorked||'').trim();a.playerResponse+=!!String(v.playerResponse||'').trim();a.interventions+=!!String(v.interventions||'').trim();a.nextSteps+=!!String(v.nextSteps||'').trim();return a;},{whatWorked:0,playerResponse:0,interventions:0,nextSteps:0});
 const weeks=Array.from({length:10},(_,i)=>{const rs=records.filter(r=>{const s=String(r.plan?.block||'');const b=+(r.plan?.blockNumber||(s.match(/block\s*([1-4])/i)||[])[1]);const w=+(r.plan?.weekNumber||(s.match(/week\s*(10|[1-9])/i)||[])[1]);return w===i+1;});return {week:i+1,deliveries:rs.length,reviewed:rs.reduce((a,r)=>a+arr(r.plan.entries).filter(e=>['achieved','partial','revisit'].includes(r.practices?.[e.entryId]?.outcome)).length,0)};});
 const recommendations=[];const undelivered=sessions.filter(s=>!records.some(r=>r.sessionId===s.id));if(undelivered.length)recommendations.push({level:'info',title:'Saved plans not yet evidenced as delivered',detail:`${undelivered.length} saved session plan(s) have no matching completed delivery record. Check whether they are still upcoming or need delivery records.`});
 const low=principle.filter(p=>p.delivered>0&&p.reviewed/p.delivered<.5);low.forEach(p=>recommendations.push({level:'attention',title:`Review more ${p.name} practices`,detail:`${p.reviewed} of ${p.delivered} delivered practices have an outcome recorded. This is a review-coverage gap, not evidence of poor coaching.`}));
 if(records.length&&records.length-reflections.nextSteps>0)recommendations.push({level:'info',title:'Close the reflection loop',detail:`${records.length-reflections.nextSteps} delivery record(s) have no next-step priority recorded. Add one actionable coaching priority to help shape the next session.`});
 if(!records.length)recommendations.push({level:'info',title:'Start building delivery evidence',detail:'Mark a session delivered in Live Coaching Mode. Insights will use saved delivery records and your existing practice tags.'});
 return {deliveryCount:records.length,ages:byAge,principles:principle,reflections,weeks,recommendations};
}
return {build,principles:PS};
});
