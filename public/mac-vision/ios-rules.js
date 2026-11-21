/* Shared read-only IOS calculations: the screen and editor use the same results. */
(function(root){
 'use strict';
 const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
 const defs=[['⚖️|PONDERADOS','points'],['🏠|FIXO','fixed'],['📱|MÓVEL','mobile'],['🎯|MARCAÇÕES','marks'],['💼|+ NEGÓCIOS','business'],['📺|NC','nc'],['🚨|ALARMES','alarms'],['⚡|TV','energyTv'],['👨🏻‍💻|ATD','attended'],['📈|TE','te'],['🚨|TD','td'],['📈|TMA','tma']];
  const goal=(actual,target,hasData=true)=>!hasData||actual==null||target==null||target===''||!Number.isFinite(Number(actual))||!Number.isFinite(Number(target))?null:Number(actual)>=Number(target)?'good':'bad';
 const periodKey=(date,mode)=>mode==='month'?String(date).slice(0,7):date;
 const targets=(data,id,date,mode)=>id?data.macIOSGoals?.users?.[id]?.[periodKey(date,mode)]||{}:data.macIOSGoals?.store?.[periodKey(date,mode)]||{};
 function setTargets(data,id,date,mode,values){
  const p=periodKey(date,mode);data.macIOSGoals??={};
  if(id){data.macIOSGoals.users??={};data.macIOSGoals.users[id]??={};data.macIOSGoals.users[id][p]=values;}
  else{data.macIOSGoals.store??={};data.macIOSGoals.store[p]=values;}
 }
 function removeFromMonth(data,name,month){
  data.schedules=(data.schedules||[]).filter(s=>!(String(s.date).startsWith(month)&&key(s.employee)===key(name)));
 }
  function scheduleLines(data,month){
   const shifts=(data.schedules||[]).filter(s=>String(s.date).startsWith(month));
   const scheduled=new Set(shifts.map(s=>key(s.employee)));
   const hidden=new Set((data.macScheduleHiddenByMonth?.[month]||[]).map(key));
   const excluded=new Set((data.macScheduleExcludedByMonth?.[month]||[]).map(key));
   const names=new Map();
   for(const name of [...(data.employees||[]).map(e=>e.name),...shifts.map(s=>s.employee),...(data.macScheduleHiddenByMonth?.[month]||[]),...(data.macScheduleExcludedByMonth?.[month]||[])]){
    const k=key(name);if(k&&!names.has(k))names.set(k,name);
   }
   return [...names].map(([k,name])=>({name,hidden:hidden.has(k)||(excluded.has(k)&&!scheduled.has(k))}));
  }
  function setScheduleVisibility(data,name,month,visible){
   const k=key(name);data.macScheduleHiddenByMonth??={};
   const hidden=(data.macScheduleHiddenByMonth[month]||[]).filter(n=>key(n)!==k);
   data.macScheduleHiddenByMonth[month]=visible?hidden:[...hidden,name];
   if(visible&&data.macScheduleExcludedByMonth?.[month])data.macScheduleExcludedByMonth[month]=data.macScheduleExcludedByMonth[month].filter(n=>key(n)!==k);
  }
 function personId(shop,data,name){
  const staff=(data.employees||[]).find(e=>key(e.name)===key(name)||key(e.alias)===key(name));
  const canonical=staff?.name||name;
  const ids=[...new Set((shop?.users||[]).filter(u=>key(u.employee||u.name)===key(canonical)).map(u=>u.id))];
  return ids.length===1?ids[0]:null;
 }
 function areaStaff(snapshots,date,mode){
  const result=new Map(),working=new Set(['A','B','C','D','E','G','H','I']);
  for(const {shop,data} of snapshots){
   const canonical=value=>(data.employees||[]).find(e=>key(e.name)===key(value)||key(e.alias)===key(value))?.name||value;
   const names=new Map((data.schedules||[]).filter(s=>s.date===date&&working.has(String(s.code||'').trim().toUpperCase())).map(s=>[key(canonical(s.employee)),canonical(s.employee)]));
   for(const [k,name] of names){
    const id=personId(shop,data,name)||k;
    const staff=(data.employees||[]).find(e=>key(e.name)===k);
    const user=(shop.users||[]).find(u=>u.id===id);
    const previous=result.get(id);
    if(previous){if(!previous.photo)previous.photo=user?.photo||staff?.photo||'';}
    else result.set(id,{id,name,points:0,photo:user?.photo||staff?.photo||''});
   }
  }
  for(const {shop,data} of snapshots)for(const sale of data.sales||[]){
   if(!(mode==='month'?String(sale.date).startsWith(date.slice(0,7)):sale.date===date))continue;
   const staff=(data.employees||[]).find(e=>key(e.name)===key(sale.employee)||key(e.alias)===key(sale.employee));
   const name=staff?.name||sale.employee,id=personId(shop,data,name)||key(name),person=result.get(id);
   if(person)person.points+=Number(sale.points)||0;
  }
  return [...result.values()];
 }
  root.macIOSRules={key,defs,goal,periodKey,targets,setTargets,removeFromMonth,scheduleLines,setScheduleVisibility,personId,areaStaff};
})(typeof window==='undefined'?globalThis:window);