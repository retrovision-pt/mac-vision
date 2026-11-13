/** Keep operation failures separate from reachability and authentication. */
export function syncErrorKind(error: unknown): 'session' | 'permission' | 'limit' | 'service' | 'network' | 'operation' {
  const e = error as { status?: number; statusCode?: number; message?: string; code?: string } | null;
  const status = Number(e?.status || e?.statusCode || 0);
  const text = String(e?.message || error || '');
  if (status === 401 || /jwt|unauthorized|not authenticated|auth session missing|sessão.*(termin|inválid|expir)|inicia sessão na cloud/i.test(text)) return 'session';
  if (status === 403 || /42501|permission denied|row.level security|forbidden|sem permissão|não tens.*(permiss|autoriza)/i.test(text)) return 'permission';
  if (status === 429 || /rate limit|too many requests|demasiadas tentativas/i.test(text)) return 'limit';
  if (status >= 500 || /service unavailable|bad gateway/i.test(text)) return 'service';
  if (/failed to fetch|fetch failed|network|load failed|timeout|sem ligação|não respondeu/i.test(text)) return 'network';
  return 'operation';
}