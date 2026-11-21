import { describe,expect,it } from 'vitest';
import { removalError } from './mac-admin-rules';
const mac={id:'mac',wallet_id:'wallet',role:'admin',admin_type:'mac'};
const otherMac={...mac,id:'other'};
const admin={...mac,id:'admin',admin_type:'area'};
describe('Gestor MAC Vision — protected administration',()=>{
 it('can remove other administrators globally across its wallet',()=>expect(removalError(mac,admin,'owner',[mac,admin],true)).toBeNull());
 it('can remove managers and collaborators globally',()=>{
  for(const role of ['gestor','colaborador'])expect(removalError(mac,{...admin,role},'owner',[mac],true)).toBeNull();
 });
 it('keeps normal store managers limited',()=>expect(removalError({...mac,role:'gestor'},admin,'owner',[admin],true)).not.toBeNull());
 it('protects the last MAC global administrator',()=>expect(removalError(admin,mac,'admin',[mac,admin],true)).toBe('É necessário manter o último administrador global.'));
 it('allows removal of a MAC administrator when another remains',()=>expect(removalError(mac,otherMac,'owner',[mac,otherMac],true)).toBeNull());
 it('never removes the owner',()=>expect(removalError(mac,admin,'admin',[mac,admin],true)).toBe('O dono da carteira não pode ser removido.'));
 it('never removes the current session',()=>expect(removalError(mac,mac,'owner',[mac],true)).toBe('Não podes remover a própria sessão.'));
 it('rejects disabled accounts and accounts in another wallet',()=>{
  expect(removalError({...mac,disabled:true},admin,'owner',[mac,admin],true)).not.toBeNull();
  expect(removalError(mac,{...admin,wallet_id:'other'},'owner',[mac,admin],true)).not.toBeNull();
 });
});