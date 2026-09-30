// Only coordination metadata crosses this boundary. Customer payloads stay in Drive.
export type Change = {
  key: string; base: number; hash: string; file: string;
  sealedHash?: string; number?: string; reservation?: string;
  claims?: string[];
};
export type Commit = { operation: string; changes: Change[] };
export class ProtocolError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function need(condition: unknown, code: string, status = 400): asserts condition {
  if (!condition) throw new ProtocolError(code, status);
}
export const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export const recordKey = (value: unknown): value is string => typeof value === 'string' && /^(document|client|recurring|reviewEvent|business):[A-Za-z0-9_-]{1,128}$/.test(value);
export const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const number = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 96 && !/[\x00-\x1f]/.test(value);
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  return JSON.stringify(value);
}
export function validateCommit(value: unknown): asserts value is Commit {
  need(value && typeof value === 'object', 'INVALID_COMMIT');
  const c = value as Commit;
  need(Object.keys(c).every(k=>['operation','changes'].includes(k)),'UNKNOWN_COMMIT_FIELD');
  need(identifier(c.operation) && Array.isArray(c.changes) && c.changes.length > 0 && c.changes.length <= 512, 'INVALID_COMMIT');
  const keys = new Set<string>();
  for (const v of c.changes) {
    need(v && typeof v==='object' && Object.keys(v).every(k=>['key','base','hash','file','sealedHash','number','reservation','claims'].includes(k)),'UNKNOWN_CHANGE_FIELD');
    need(v && recordKey(v.key) && !keys.has(v.key), 'INVALID_KEY'); keys.add(v.key);
    need(Number.isSafeInteger(v.base) && v.base >= 0 && hash(v.hash) && identifier(v.file), 'INVALID_REVISION');
    need(v.sealedHash === undefined || hash(v.sealedHash), 'INVALID_SEAL');
    need(v.number === undefined || (number(v.number) && v.sealedHash), 'INVALID_NUMBER');
    need(v.reservation === undefined || identifier(v.reservation), 'INVALID_RESERVATION');
    need(v.claims === undefined || (Array.isArray(v.claims) && v.claims.length <= 16 && v.claims.every(x => typeof x === 'string' && /^[A-Za-z0-9:_-]{1,200}$/.test(x)) && new Set(v.claims).size === v.claims.length), 'INVALID_CLAIMS');
  }
}
