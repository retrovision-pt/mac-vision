import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Staff={id:string;name:string;points:number};
type Rules={goal:(a:number|null,t:number|string|null)=>string|null;areaStaff:(s:unknown[],d:string,m:string)=>Staff[];setTargets:(d:unknown,id:string|null,date:string,mode:string,v:Record<string,number>)=>void;targets:(d:unknown,id:string|null,date:string,mode:string)=>Record<string,number>;removeFromMonth:(d:unknown,n:string,m:string)=>void};
const sandbox:{macIOSRules?:Rules}={};
runInNewContext(readFileSync('public/mac-vision/ios-rules.js','utf8'),sandbox);
const rules=sandbox.macIOSRules;
if(!rules)throw Error('IOS rules not loaded');
describe('IOS goals',()=>{
 it('is green when the result equals the goal',()=>expect(rules.goal(10,10)).toBe('good'));
 it('is red below the goal',()=>expect(rules.goal(9,10)).toBe('bad'));
 it('is neutral without a goal',()=>expect(rules.goal(9,'')).toBeNull());
 it('keeps store, individual and period targets independent',()=>{
  const data={};
  rules.setTargets(data,'u1','2026-11-21','day',{points:10});
  rules.setTargets(data,'u2','2026-11-21','day',{points:20});
  rules.setTargets(data,null,'2026-11-21','month',{points:200});
  expect(rules.targets(data,'u1','2026-11-21','day')).toEqual({points:10});
  expect(rules.targets(data,'u2','2026-11-21','day')).toEqual({points:20});
  expect(rules.targets(data,null,'2026-11-21','month')).toEqual({points:200});
  expect(rules.targets(data,'u1','2026-11-21','month')).toEqual({});
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
