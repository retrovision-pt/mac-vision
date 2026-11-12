import { describe, it, expect } from 'vitest';
import { normalizeWallet, authorizeAccountCreation, mergeChanges, hasValidAreaManager, canStartWalletSetup, canStartPreviewSetup, registryChanges } from './mac-rules';
describe('MAC Vision Cloud rules', () => {
  it('allows a protected MAC administrator to manage every account role',()=>{
    for(const role of ['admin','gestor','colaborador'])expect(authorizeAccountCreation('admin',role)).toBe(true);
  });
  it('does not remove three collaborators missing from a stale browser list',()=>{
    const ga={id:'ga',name:'GA'},users=[ga,{id:'c1'},{id:'c2'},{id:'c3'}];
    expect(registryChanges([{id:'store',users}],[{id:'store',users:[ga]}])).toEqual([]);
  });
  it('sends only a changed account and preserves its permanent identifier',()=>{
    expect(registryChanges([{id:'s',users:[{id:'1',name:'Old'},{id:'2'}]}],[{id:'s',users:[{id:'1',name:'New'},{id:'2'}]}])).toEqual([{id:'s',users:[{id:'1',name:'New'}]}]);
  });
  it('rejects duplicate user identifiers rather than overwriting another account',()=>expect(()=>registryChanges([],[{id:'s',users:[{id:'1'},{id:'1'}]}])).toThrow('duplicado'));
  const previewGrant={expires_at:'2026-11-26T00:00:00Z',consumed_by:null};
  const resetTime=Date.parse('2026-11-12T00:47:00Z');
  it('opens authorized preview setup with no valid GA even when old wallets remain',()=>expect(canStartPreviewSetup(true,false,previewGrant,resetTime)).toBe(true));
  it('never authorizes automatic setup on the published app',()=>expect(canStartPreviewSetup(false,false,previewGrant,resetTime)).toBe(false));
  it('closes preview setup when a GA exists',()=>expect(canStartPreviewSetup(true,true,previewGrant,resetTime)).toBe(false));
  it('requires backend authorization even in preview',()=>expect(canStartPreviewSetup(true,false,null,resetTime)).toBe(false));
  it('does not consider unrelated test accounts a valid GA',()=>expect(hasValidAreaManager({id:'real',owner_id:'ga'},[{id:'test',wallet_id:'audit',role:'admin'}],[{user_id:'test',role:'admin'}])).toBe(false));
  it('requires the owner account and protected admin assignment for a valid GA',()=>{
    const wallet={id:'real',owner_id:'ga'},accounts=[{id:'ga',wallet_id:'real',role:'admin'}];
    expect(hasValidAreaManager(wallet,accounts,[])).toBe(false);
    expect(hasValidAreaManager(wallet,accounts,[{user_id:'ga',role:'admin'}])).toBe(true);
  });
  it('never allows setup without a private authorization',()=>expect(canStartWalletSetup(null,0,false)).toBe(false));
  it('never allows taking over an existing wallet',()=>expect(canStartWalletSetup({expires_at:'2027-01-01',consumed_by:null},0,true)).toBe(false));
  it('accepts an unused unexpired authorization for a new wallet',()=>expect(canStartWalletSetup({expires_at:'2027-01-01',consumed_by:null},Date.parse('2026-11-12'),false)).toBe(true));
  it('rejects reused authorizations',()=>expect(canStartWalletSetup({expires_at:'2027-01-01',consumed_by:'ga'},0,false)).toBe(false));
  it('rejects expired authorizations',()=>expect(canStartWalletSetup({expires_at:'2026-11-11',consumed_by:null},Date.parse('2026-11-12'),false)).toBe(false));
  it('converts Nome da Carteira to uppercase', () => expect(normalizeWallet(' emr ')).toBe('EMR'));
  it('does not allow collaborators to create administrators', () => expect(authorizeAccountCreation('colaborador','admin')).toBe(false));
  it('allows administrators to create managers', () => expect(authorizeAccountCreation('admin','gestor')).toBe(true));
  it('preserves two simultaneous distinct sales without duplicating IDs', () => {
    expect(mergeChanges([], [{id:'sale-a'}], [{id:'sale-b'}])).toEqual([{id:'sale-b'},{id:'sale-a'}]);
  });
  it('rejects competing changes to the same schedule instead of silently losing one',()=>{
    expect(mergeChanges({selectedDate:'2026-11-10',sales:[]},{selectedDate:'2026-11-12',sales:[{id:'a'}]},{selectedDate:'2026-11-11',sales:[{id:'b'}]})).toEqual({selectedDate:'2026-11-12',sales:[{id:'b'},{id:'a'}]});
    expect(()=>mergeChanges({start:'09:00'},{start:'10:00'},{start:'11:00'})).toThrow('CONFLICT');
  });
  it('preserves an authorized deletion while retaining another new sale',()=>{
    expect(mergeChanges([{id:'sale-a'}],[],[{id:'sale-a'},{id:'sale-b'}])).toEqual([{id:'sale-b'}]);
  });
});