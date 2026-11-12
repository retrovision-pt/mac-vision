import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin, isValidPin, friendlyError } from './mac-pin';

describe('numeric PIN rule', () => {
  it('accepts 4, 5 and 6 digit PINs', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
  });
  it('rejects fewer than 4 digits or non-numeric values', () => {
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });
  it('stores only a salted hash and verifies the right PIN', async () => {
    const stored = await hashPin('1234', 'pepper');
    expect(stored).not.toContain('1234$');
    expect(await verifyPin('1234', stored, 'pepper')).toBe(true);
    expect(await verifyPin('1235', stored, 'pepper')).toBe(false);
    expect(await verifyPin('1234', stored, 'other-pepper')).toBe(false);
  });
});

describe('Portuguese error messages', () => {
  it('replaces the weak password provider message', () => {
    expect(friendlyError('Password is known to be weak and easy to guess, please choose a different one.')).toBe('A password não foi aceite. Usa, no mínimo, 4 números.');
  });
  it('keeps Portuguese messages', () => {
    expect(friendlyError('Esta carteira já existe. Usa o acesso existente.')).toBe('Esta carteira já existe. Usa o acesso existente.');
  });
});
