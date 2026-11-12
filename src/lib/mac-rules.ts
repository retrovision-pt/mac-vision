export const normalizeWallet = (value: string) => value.trim().toUpperCase();
export const normalizeUsername = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
export const loginAddress = (id: string) => `${id}@macvision.local`;
export function hasValidAreaManager(wallet: {id:string;owner_id:string}, accounts: {id:string;wallet_id:string;role:string}[], roles: {user_id:string;role:string}[]) {
  return accounts.some(a=>a.id===wallet.owner_id&&a.wallet_id===wallet.id&&a.role==='admin') && roles.some(r=>r.user_id===wallet.owner_id&&r.role==='admin');
}
export function canStartWalletSetup(grant: {expires_at:string;consumed_by:string|null}|null, now: number, walletExists: boolean) {
  return !!grant && !grant.consumed_by && Date.parse(grant.expires_at)>now && !walletExists;
}
export function canStartPreviewSetup(development: boolean, hasManager: boolean, grant: {expires_at:string;consumed_by:string|null}|null, now:number) {
  return development && !hasManager && canStartWalletSetup(grant,now,false);
}
export function authorizeAccountCreation(actor: string, target: string) {
  return actor === 'admin' || (actor === 'gestor' && target === 'colaborador');
}
export function mergeChanges(base: any, local: any, remote: any): any {
  if (JSON.stringify(base) === JSON.stringify(local)) return remote;
  if (JSON.stringify(base) === JSON.stringify(remote)) return local;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const key = (x: any) => String(x?.id ?? (x?.date ? `${x.date}|${x.employee || ''}|${x.code || ''}` : x?.name ?? JSON.stringify(x)));
    const b = new Map((Array.isArray(base) ? base : []).map((x: any) => [key(x), x]));
    const l = new Map(local.map(x => [key(x), x]));
    const r = new Map(remote.map(x => [key(x), x]));
    for (const [id, old] of b) {
      if (!l.has(id)) r.delete(id);
      else if (JSON.stringify(l.get(id)) !== JSON.stringify(old)) r.set(id, mergeChanges(old, l.get(id), r.get(id)));
    }
    for (const [id, value] of l) if (!b.has(id)) r.set(id, value);
    return [...r.values()];
  }
  if (local && remote && typeof local === 'object' && typeof remote === 'object') {
    const result = { ...remote };
    for (const k of new Set([...Object.keys(base || {}), ...Object.keys(local)])) {
      if (!(k in local)) delete result[k];
      else result[k] = mergeChanges(base?.[k], local[k], remote[k]);
    }
    return result;
  }
  throw new Error('CONFLICT: o mesmo campo foi alterado noutra sessão; recarrega antes de guardar.');
}