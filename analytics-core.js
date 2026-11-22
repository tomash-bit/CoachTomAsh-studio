/* CoachTomAsh Studio 1.9: analytic aggregation never mutates source data. */
(function(root,factory){const a=factory();root.CTAReviewAnalytics=a;if(typeof module!=='undefined'&&module.exports)module.exports=a;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const PS=['Patience','Progress','Penetrate','Protect','Prevent'],TYPES=['Principle-based','Individualised','Position-specific','Team Training','Match Prep','Recovery'];
const list=x=>Array.isArray(x)?x:[],num=x=>Number.isFinite(+x)&&(+x)>0?+x:0;
const bn=x=>{let n=+(x?.blockNumber||(String(x?.block||'').match(/block\s*([1-4])/i)||[])[1]);return n>=1&&n<=4?n:0;};
const wn=x=>{let n=+(x?.weekNumber||(String(x?.block||'').match(/week\s*(10|[1-9])/i)||[])[1]);return n>=1&&n<=10?n:0;};
const duration=(e,dm)=>e?.duration!==undefined&&e?.duration!==null&&e?.duration!==''?num(e.duration):num(dm.get(e?.drillId)?.duration);
function summarize(state,opts={}){
 const dm=new Map(list(state?.drills).map(d=>[d.id,d]));const plans=list(state?.sessions).filter(s=>(!opts.age||s.age===opts.age)&&(!opts.block||bn(s)==opts.block)&&(!opts.week||wn(s)==opts.week));
 const now=Number(opts.now)||Date.now(),days=opts.period==='30'?30:opts.period==='90'?90:0;
 const runs=list(state?.liveDelivery?.records).filter(r=>r?.status==='delivered'&&Array.isArray(r?.plan?.entries)&&(!opts.age||r.plan.age===opts.age)&&(!opts.block||bn(r.plan)==opts.block)&&(!opts.week||wn(r.plan)==opts.week)&&(!days||((r.deliveredAt||r.updatedAt||r.createdAt)>=now-days*86400000&&(r.deliveredAt||r.updatedAt||r.createdAt)<=now)));
 const P=Object.fromEntries([...PS,'Unassigned'].map(n=>[n,{name:n,planned:0,deliveredScheduled:0,recorded:0}]));const T=Object.fromEntries([...TYPES,'Unassigned'].map(n=>[n,{name:n,planned:0,deliveredScheduled:0}]));
 const outcomes={achieved:0,partial:0,revisit:0,unreviewed:0},weekly=Array.from({length:10},(_,i)=>({week:i+1,planned:0,delivered:0,deliveries:0}));
 const totals={plannedSessions:plans.length,plannedMinutes:0,deliveredRecords:runs.length,deliveredSessions:new Set(runs.map(r=>r.sessionId)).size,deliveredScheduledMinutes:0,recordedWorkMinutes:0,recordedRestMinutes:0,completedPractices:0,deliveredPractices:0,reviewedPractices:0};
 const tags=e=>{const d=dm.get(e?.drillId);return {d,p:PS.includes(d?.principle)?d.principle:'Unassigned',t:TYPES.includes(d?.practiceType)?d.practiceType:'Unassigned'};};
 for(const s of plans){if(wn(s))weekly[wn(s)-1].planned++;for(const e of list(s.entries)){const m=duration(e,dm),{p,t}=tags(e);totals.plannedMinutes+=m;P[p].planned+=m;T[t].planned+=m;}}
 const seen=Array.from({length:10},()=>new Set());const records=[];
 for(const r of runs){const w=wn(r.plan);if(w){weekly[w-1].deliveries++;seen[w-1].add(r.sessionId);}const rows=[];
   for(const e of r.plan.entries){const {d,p,t}=tags(e),o=r.practices?.[e.entryId]||{},m=duration(e,dm),work=num(o.actualMs)/60000,rest=num(o.restMs)/60000,outcome=['achieved','partial','revisit'].includes(o.outcome)?o.outcome:'unreviewed';
     totals.deliveredPractices++;totals.deliveredScheduledMinutes+=m;totals.recordedWorkMinutes+=work;totals.recordedRestMinutes+=rest;P[p].deliveredScheduled+=m;P[p].recorded+=work;T[t].deliveredScheduled+=m;outcomes[outcome]++;
     if(o.completed)totals.completedPractices++;if(outcome!=='unreviewed')totals.reviewedPractices++;
     rows.push({entryId:e.entryId,practice:d?.name||'Unavailable practice',principle:p,practiceType:t,scheduledMin:m,recordedWorkMin:work,outcome,completed:!!o.completed,notes:String(o.reflection||'')});
   }
   records.push({id:r.id,sessionId:r.sessionId,title:String(r.plan.title||'Untitled session'),age:String(r.plan.age||'Unspecified'),block:bn(r.plan),week:w,deliveredAt:r.deliveredAt||r.updatedAt||r.createdAt||0,scheduledMin:rows.reduce((a,e)=>a+e.scheduledMin,0),recordedWorkMin:rows.reduce((a,e)=>a+e.recordedWorkMin,0),completed:rows.filter(e=>e.completed).length,practiceCount:rows.length,overallReflection:String(r.overallReflection||''),review:{...(r.reviewV19||{})},rows});
 }
 weekly.forEach((w,i)=>w.delivered=seen[i].size);records.sort((a,b)=>b.deliveredAt-a.deliveredAt);
 return {filters:opts,totals,outcomes,principles:[...PS,'Unassigned'].map(x=>P[x]),types:[...TYPES,'Unassigned'].map(x=>T[x]),weekly,records};
}
return {summarize,PS,TYPES};
});
