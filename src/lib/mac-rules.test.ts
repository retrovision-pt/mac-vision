import { describe, it, expect } from 'vitest';
import { normalizeWallet, authorizeAccountCreation, mergeChanges } from './mac-rules';
describe('MAC Vision Cloud rules', () => {
  it('converts Nome da Carteira to uppercase', () => expect(normalizeWallet(' emr ')).toBe('EMR'));
  it('does not allow collaborators to create administrators', () => expect(authorizeAccountCreation('colaborador','admin')).toBe(false));
  it('allows administrators to create managers', () => expect(authorizeAccountCreation('admin','gestor')).toBe(true));
  it('preserves two simultaneous distinct sales without duplicating IDs', () => {
    expect(mergeChanges([], [{id:'sale-a'}], [{id:'sale-b'}])).toEqual([{id:'sale-b'},{id:'sale-a'}]);
  });
});