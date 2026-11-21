import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Rules={scheduled:(turns:{date:string;employee:string;code:string}[],date:string)=>Set<string>;goal:(actual:number,target:number)=>string|null};
const sandbox:{macExportRules?:Rules}={};
runInNewContext(readFileSync('public/mac-vision/export-rules.js','utf8'),sandbox);
const rules=sandbox.macExportRules;
if(!rules)throw Error('Export rules not loaded');
describe('Read-only image export rules',()=>{
 it('includes only working shifts on the selected date',()=>{
  const names=rules.scheduled([{date:'2026-11-21',employee:'A',code:'A'},{date:'2026-11-21',employee:'B',code:'FE'},{date:'2026-11-20',employee:'C',code:'B'}],'2026-11-21');
  expect([...names]).toEqual(['A']);
 });
 it('uses green at or above the configured goal',()=>{
  expect(rules.goal(10,10)).toBe('good');expect(rules.goal(11,10)).toBe('good');
 });
 it('uses red below the configured goal',()=>expect(rules.goal(9,10)).toBe('bad'));
 it('never invents a goal for an unavailable value',()=>expect(rules.goal(Number.NaN,10)).toBeNull());
});