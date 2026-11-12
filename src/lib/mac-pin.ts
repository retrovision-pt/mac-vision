// Numeric PIN credentials, validated only by server handlers.
// Format: pbkdf2-sha256$<iterations>$<salt-hex>$<hash-hex>; the pepper never leaves the server.
export const PIN_PATTERN = /^\d{4,12}$/;
export const PIN_ITERATIONS = 100000; // Cloudflare Workers PBKDF2 maximum.
export const isValidPin = (pin: unknown): pin is string => typeof pin === 'string' && PIN_PATTERN.test(pin);

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const unhex = (value: string): Uint8Array<ArrayBuffer> => Uint8Array.from(value.match(/../g) || [], b => parseInt(b, 16));

async function derive(pin: string, pepper: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const enc = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey('raw', enc.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const peppered = new Uint8Array(await crypto.subtle.sign('HMAC', hmacKey, enc.encode(pin)));
  const key = await crypto.subtle.importKey('raw', peppered, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256));
}

export async function hashPin(pin: string, pepper: string) {
  if (!isValidPin(pin)) throw Error('A password deve ter, no mínimo, 4 números.');
  if (!pepper) throw Error('Configuração de segurança em falta.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${PIN_ITERATIONS}$${hex(salt)}$${hex(await derive(pin, pepper, salt, PIN_ITERATIONS))}`;
}

export async function verifyPin(pin: string, stored: string, pepper: string) {
  const [kind, iter, salt, expected] = stored.split('$');
  if (kind !== 'pbkdf2-sha256' || !salt || !expected || !isValidPin(pin) || !pepper) return false;
  const actual = hex(await derive(pin, pepper, unhex(salt), Number(iter)));
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < Math.max(actual.length, expected.length); i++) diff |= (actual.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  return diff === 0;
}

/** Random provider password nobody knows; sessions are only issued after PIN verification. */
export function internalSecret() {
  return hex(crypto.getRandomValues(new Uint8Array(32))) + 'Aa!9';
}

const TECHNICAL: [RegExp, string][] = [
  [/weak|easy to guess|pwned|at least \d+ characters|password should/i, 'A password não foi aceite. Usa, no mínimo, 4 números.'],
  [/invalid login credentials|invalid credentials/i, 'Password incorreta.'],
  [/rate limit|too many requests|429/i, 'Demasiadas tentativas. Aguarda alguns minutos e tenta novamente.'],
  [/failed to fetch|network|load failed|fetch failed|timeout/i, 'Sem ligação à Cloud. Verifica a internet e tenta novamente.'],
  [/jwt|session|not authenticated|auth session missing|unauthorized|401/i, 'A sessão terminou. Inicia sessão novamente.'],
  [/row-level security|permission denied|forbidden|403/i, 'Sem permissão para esta operação.'],
  [/duplicate key|already (been )?registered|already exists|unique/i, 'Este registo já existe.'],
];

/** Converts provider, database and script errors into Portuguese user messages. */
export function friendlyError(message: unknown) {
  const text = String(message ?? '').trim();
  if (!text) return 'Não foi possível concluir a operação. Tenta novamente.';
  if (/CONFLICT/.test(text)) return text.replace(/^.*CONFLICT:\s*/, '') || 'Alterações simultâneas: recarrega e tenta novamente.';
  for (const [pattern, pt] of TECHNICAL) if (pattern.test(text)) return pt;
  const english = /\b(the|is|not|failed|error|invalid|unable|cannot|undefined|null|of|to|with|must|should)\b/i.test(text) && !/[áàâãéêíóôõúçÁÉÍÓÚÇ]/.test(text);
  return english ? 'Não foi possível concluir a operação na Cloud. Tenta novamente.' : text;
}
