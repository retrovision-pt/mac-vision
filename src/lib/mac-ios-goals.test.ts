import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Staff={id:string;name:string;points:number};
type Rules={performance:(key:string,actual:number|null,target:number|null,hasData?:boolean)=>string|null;parseTarget:(key:string,input:string)=>number|null;formatTarget:(key:string,value:number|null)=>string;monthToDate:(rows:{date:string;points:number}[],date:string)=>{date:string;points:number}[];goal:(a:number|null,t:number|string|null,hasData?:boolean)=>string|null;areaStaff:(s:unknown[],d:string,m:string)=>Staff[];setTargets:(d:unknown,id:string|null,date:string,mode:string,v:Record<string,number>)=>void;targets:(d:unknown,id:string|null,date:string,mode:string)=>Record<string,number>;removeFromMonth:(d:unknown,n:string,m:string)=>void;scheduleLines:(d:unknown,m:string)=>{name:string;hidden:boolean}[];setScheduleVisibility:(d:unknown,n:string,m:string,v:boolean)=>void};
const sandbox:{macIOSRules?:Rules}={};
runInNewContext(readFileSync('public/mac-vision/ios-rules.js','utf8'),sandbox);
const rules=sandbox.macIOSRules;
if(!rules)throw Error('IOS rules not loaded');
describe('IOS goals',()=>{
 it('evaluates TE against 35 percent regardless of the configured target',()=>{
  expect(rules.performance('te',35,90)).toBe('good');
  expect(rules.performance('te',34.9,10)).toBe('bad');
  expect(rules.performance('te',36,null)).toBe('good');
 });
 it('evaluates TD against a maximum of 12 percent regardless of the configured target',()=>{
  expect(rules.performance('td',12,5)).toBe('good');
  expect(rules.performance('td',12.1,20)).toBe('bad');
  expect(rules.performance('td',10,null)).toBe('good');
 });
 it('keeps zero neutral when no objective exists for every indicator',()=>{
  for(const key of ['points','fixed','mobile','marks','business','nc','alarms','energyTv','attended','te','td','tma'])expect(rules.performance(key,0,null)).toBeNull();
  expect(rules.performance('td',0,12)).toBe('good');
 });
 it('reads TE and TD as percentage values rather than fractions',()=>{
  expect(rules.parseTarget('te','35%')).toBe(35);
  expect(rules.parseTarget('td','12%')).toBe(12);
  expect(rules.parseTarget('te','35')).toBe(35);
 });
 it('stores TMA in seconds while accepting and displaying minutes and seconds',()=>{
  expect(rules.parseTarget('tma','10:00')).toBe(600);
  expect(rules.parseTarget('tma','10:30')).toBe(630);
  expect(rules.formatTarget('tma',600)).toBe('10:00');
  expect(rules.parseTarget('tma','10:60')).toBeNaN();
 });
 it('keeps saved shifts when hiding and restoring a monthly row',()=>{
  const shifts=[{employee:'Ana',date:'2026-11-21',code:'A',start:'09:00',end:'18:00'}];
  const data={employees:[{name:'Ana'}],schedules:shifts};
  rules.setScheduleVisibility(data,'Ana','2026-11',false);
  expect(rules.scheduleLines(data,'2026-11')).toEqual([{name:'Ana',hidden:true}]);
  expect(data.schedules).toEqual(shifts);
  expect(rules.scheduleLines(data,'2026-12')).toEqual([{name:'Ana',hidden:false}]);
  rules.setScheduleVisibility(data,'Ana','2026-11',true);
  expect(rules.scheduleLines(data,'2026-11')).toEqual([{name:'Ana',hidden:false}]);
  expect(data.schedules).toEqual(shifts);
 });
 it('finds hidden names outside the current staff list and restores old exclusions',()=>{
  const data={employees:[],schedules:[],macScheduleHiddenByMonth:{'2026-11':['Ana']},macScheduleExcludedByMonth:{'2026-11':['Rui']}};
  expect(rules.scheduleLines(data,'2026-11')).toEqual([{name:'Ana',hidden:true},{name:'Rui',hidden:true}]);
  rules.setScheduleVisibility(data,'Rui','2026-11',true);
  expect(data.macScheduleExcludedByMonth['2026-11']).toEqual([]);
  expect(data.macScheduleHiddenByMonth['2026-11']).toEqual(['Ana']);
 });
 it('does not invent a default goal or fall back to store goals for a person',()=>{
  const data={};rules.setTargets(data,null,'2026-11-21','day',{points:30});
  expect(rules.targets(data,'u1','2026-11-21','day')).toEqual({});
  expect(rules.goal(null,30)).toBeNull();
 });
 it('is green when the result equals the goal',()=>expect(rules.goal(10,10)).toBe('good'));
 it('is red below the goal',()=>expect(rules.goal(9,10)).toBe('bad'));
 it('is neutral without a goal',()=>expect(rules.goal(9,'')).toBeNull());
 it('is neutral when zero results have no supporting records',()=>expect(rules.goal(0,30,false)).toBeNull());
  it('keeps monthly targets independent by person, store and month, regardless of display mode',()=>{
  const data={};
  rules.setTargets(data,'u1','2026-11-21','day',{points:10});
  rules.setTargets(data,'u2','2026-11-21','day',{points:20});
  rules.setTargets(data,null,'2026-11-21','month',{points:200});
  expect(rules.targets(data,'u1','2026-11-21','day')).toEqual({points:10});
  expect(rules.targets(data,'u2','2026-11-21','day')).toEqual({points:20});
  expect(rules.targets(data,null,'2026-11-21','month')).toEqual({points:200});
   expect(rules.targets(data,'u1','2026-11-01','month')).toEqual({points:10});
   rules.setTargets(data,'u1','2026-12-01','month',{points:30});
   expect(rules.targets(data,'u1','2026-11-30','day')).toEqual({points:10});
   expect(rules.targets(data,'u1','2026-12-21','day')).toEqual({points:30});
 });
  it('accumulates from the first day through the selected date without later days or other months',()=>{
   const rows=[{date:'2026-10-31',points:100},{date:'2026-11-01',points:10},{date:'2026-11-21',points:20},{date:'2026-11-22',points:50},{date:'2026-12-01',points:100}];
   const accumulated=rules.monthToDate(rows,'2026-11-21');
   expect(accumulated.map(r=>r.date)).toEqual(['2026-11-01','2026-11-21']);
   expect(accumulated.reduce((sum,row)=>sum+row.points,0)).toBe(30);
  });
  it('ignores legacy daily goals without deleting them or dividing the monthly goal',()=>{
   const data={macIOSGoals:{users:{u1:{'2026-11-21':{points:5},'2026-11':{points:300}}}}};
   expect(rules.targets(data,'u1','2026-11-21','day')).toEqual({points:300});
   rules.setTargets(data,'u1','2026-12-21','day',{points:400});
   expect(data.macIOSGoals.users.u1['2026-11-21']).toEqual({points:5});
   expect(rules.targets(data,'u1','2026-11-30','month')).toEqual({points:300});
  });
 it('removes only the selected monthly schedule, preserving employees and sales',()=>{
  const data={employees:[{name:'Ana'}],sales:[{employee:'Ana',points:5}],schedules:[{employee:'Ana',date:'2026-11-21'},{employee:'Ana',date:'2026-12-21'},{employee:'Rui',date:'2026-11-21'}]};
  rules.removeFromMonth(data,'Ana','2026-11');
  expect(data.schedules).toEqual([{employee:'Ana',date:'2026-12-21'},{employee:'Rui',date:'2026-11-21'}]);
  expect(data.employees).toEqual([{name:'Ana'}]);expect(data.sales).toEqual([{employee:'Ana',points:5}]);
 });
 it('lists only scheduled staff once across stores',()=>{
  const user={id:'u1',name:'Ana',employee:'Ana'};
  const rows=rules.areaStaff([
   {shop:{users:[user]},data:{employees:[{name:'Ana'},{name:'Rui'}],schedules:[{date:'2026-11-21',employee:'Ana',code:'A'},{date:'2026-11-21',employee:'Rui',code:'F'}],sales:[{date:'2026-11-21',employee:'Ana',points:2}]}},
   {shop:{users:[user]},data:{employees:[{name:'Ana'}],schedules:[{date:'2026-11-21',employee:'Ana',code:'B'}],sales:[{date:'2026-11-21',employee:'Ana',points:3}]}}
  ],'2026-11-21','day');
  expect(rows.map(r=>[r.name,r.points])).toEqual([['Ana',5]]);
 });
});
