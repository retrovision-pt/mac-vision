import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

type Sale={id:string;kind:string;label:string;qty?:number;meta?:{mobilePortability?:boolean;catalogProduct?:string}};
const sandbox:{macPortabilityRules?:{eligible:(sale:Sale)=>boolean;value:(sale:Sale)=>boolean|null;count:(sales:Sale[])=>number}}={};
runInNewContext(readFileSync('public/mac-vision/portability-rules.js','utf8'),sandbox);
const rules=sandbox.macPortabilityRules;
if(!rules)throw Error('Portability rules not loaded');
describe('Móvel Convergente — Port',()=>{
 it('requires both Móvel and Convergente',()=>{
  expect(rules.eligible({id:'1',kind:'mobile',label:'Convergente'})).toBe(true);
  expect(rules.eligible({id:'1',kind:'mobile',label:'📱 Convergente Voz'})).toBe(true);
  expect(rules.eligible({id:'1',kind:'mobile',label:'🌍 Convergente Net Ret'})).toBe(true);
  expect(rules.eligible({id:'1',kind:'fixed',label:'Convergente'})).toBe(false);
  expect(rules.eligible({id:'1',kind:'mobile',label:'Não convergente'})).toBe(false);
 });
 it('adds exactly +1 per eligible SIM sale, not the quantity',()=>expect(rules.count([{id:'1',kind:'mobile',label:'Convergente',qty:5,meta:{mobilePortability:true}}])).toBe(1));
 it('does not count NÃO',()=>expect(rules.count([{id:'1',kind:'mobile',label:'Convergente',meta:{mobilePortability:false}}])).toBe(0));
 it('keeps old sales without an answer undefined',()=>expect(rules.value({id:'1',kind:'mobile',label:'Convergente'})).toBeNull());
 it('never counts the same sale twice',()=>{
  const sale={id:'1',kind:'mobile',label:'Convergente',meta:{mobilePortability:true}};
  expect(rules.count([sale,sale])).toBe(1);
 });
 it('SIM to NÃO reduces Port by one and NÃO to SIM increases it by one',()=>{
  const sale={id:'1',kind:'mobile',label:'Convergente',meta:{mobilePortability:false}};
  expect(rules.count([sale])).toBe(0);sale.meta.mobilePortability=true;
  expect(rules.count([sale])).toBe(1);sale.meta.mobilePortability=false;
  expect(rules.count([sale])).toBe(0);
 });
 it('counts only the supplied filtered sales',()=>{
  expect(rules.count([{id:'selected',kind:'mobile',label:'Convergente',meta:{mobilePortability:true}}])).toBe(1);
  expect(rules.count([])).toBe(0);
 });
});