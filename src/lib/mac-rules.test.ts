import { describe, it, expect } from 'vitest';
import { normalizeWallet, authorizeAccountCreation, mergeChanges, hasValidAreaManager, canStartWalletSetup } from './mac-rules';
describe('MAC Vision Cloud rules', () => {
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
    expect(()=>mergeChanges({start:'09:00'},{start:'10:00'},{start:'11:00'})).toThrow('CONFLICT');
  });
  it('preserves an authorized deletion while retaining another new sale',()=>{
    expect(mergeChanges([{id:'sale-a'}],[],[{id:'sale-a'},{id:'sale-b'}])).toEqual([{id:'sale-b'}]);
  });
});