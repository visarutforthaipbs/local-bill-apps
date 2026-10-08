import { jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';
import { EntitlementError, requireEntitlement } from './entitlement-errors.ts';

// Every audience lists its approved authorized parties. Do not merge all client
// IDs into a global azp list: web audience + iOS azp is a deliberate pairing.
export type GoogleClients = Readonly<Record<string, readonly string[]>>;
export function parseGoogleClients(raw: string): GoogleClients {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new EntitlementError('GOOGLE_CLIENTS_NOT_CONFIGURED', 503); }
  requireEntitlement(value && typeof value === 'object' && !Array.isArray(value), 'GOOGLE_CLIENTS_NOT_CONFIGURED', 503);
  const entries = Object.entries(value);
  requireEntitlement(entries.length > 0 && entries.length <= 20, 'GOOGLE_CLIENTS_NOT_CONFIGURED', 503);
  for (const [audience, parties] of entries) {
    requireEntitlement(/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(audience) && Array.isArray(parties) && parties.length > 0 && parties.length <= 20 && parties.every(p => typeof p === 'string' && /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(p)), 'GOOGLE_CLIENTS_NOT_CONFIGURED', 503);
  }
  return Object.freeze(Object.fromEntries(entries.map(([aud, parties]) => [aud, Object.freeze([...parties as string[]])])));
}
export function validateGoogleClaims(payload: JWTPayload, clients: GoogleClients, now = Date.now()): string {
  const audiences = typeof payload.aud === 'string' ? [payload.aud] : payload.aud;
  requireEntitlement(Array.isArray(audiences) && audiences.length > 0 && new Set(audiences).size === audiences.length && audiences.every(a => typeof a === 'string' && Object.hasOwn(clients, a)), 'UNAUTHORIZED', 401);
  // A single-audience token may omit azp only when that audience authorizes itself.
  const party = payload.azp ?? (audiences.length === 1 ? audiences[0] : undefined);
  requireEntitlement(typeof party === 'string' && audiences.every(a => clients[a].includes(party)), 'UNAUTHORIZED', 401);
  requireEntitlement(typeof payload.sub === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(payload.sub), 'UNAUTHORIZED', 401);
  requireEntitlement(Number.isSafeInteger(payload.iat) && Number.isSafeInteger(payload.exp) && payload.iat! <= Math.floor(now / 1000) + 60 && payload.exp! > payload.iat! && payload.exp! - payload.iat! <= 7200, 'UNAUTHORIZED', 401);
  return payload.sub;
}
export async function verifyGoogleToken(token: string, clients: GoogleClients, key: JWTVerifyGetKey | CryptoKey | Uint8Array, expectedAccount?: string): Promise<string> {
  requireEntitlement(typeof token === 'string' && token.length > 0 && token.length < 8192, 'UNAUTHORIZED', 401);
  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, key as JWTVerifyGetKey, { issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: Object.keys(clients), algorithms: ['RS256'], requiredClaims: ['sub', 'iat', 'exp'], clockTolerance: 30 }));
  } catch { throw new EntitlementError('UNAUTHORIZED', 401); }
  const subject = validateGoogleClaims(payload, clients);
  requireEntitlement(!expectedAccount || expectedAccount === subject, 'SYNC_ACCOUNT_MISMATCH');
  return subject;
}
