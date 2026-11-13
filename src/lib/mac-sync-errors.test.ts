import { describe, expect, it } from 'vitest';
import { syncErrorKind } from './mac-sync-errors';

describe('Cloud failures do not all mean Offline', () => {
  it('401 requires authentication, not a connectivity reset', () => {
    expect(syncErrorKind({ status: 401 })).toBe('session');
  });
  it('403 is a permission failure', () => {
    expect(syncErrorKind({ status: 403 })).toBe('permission');
  });
  it('429 requires waiting', () => {
    expect(syncErrorKind({ status: 429 })).toBe('limit');
  });
  it('503 is a service failure requiring a connectivity probe', () => {
    expect(syncErrorKind({ status: 503 })).toBe('service');
  });
  it('network failures require a connectivity probe', () => {
    expect(syncErrorKind(new Error('Failed to fetch'))).toBe('network');
  });
  it('concurrent save conflicts are not network failures', () => {
    expect(syncErrorKind(new Error('CONFLICT'))).toBe('operation');
  });
});