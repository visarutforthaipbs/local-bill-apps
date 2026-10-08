import {Buffer} from 'node:buffer';
import { createHash } from 'node:crypto';
import { EntitlementError, requireEntitlement } from './entitlement-errors.ts';
export interface WorkspaceGrant {
  source: 'direct' | 'apple';
  purchase: string;
  verifiedAt: number;
  until: number | null;
  verifier: string;
  environment?: 'Production' | 'Sandbox';
}
export interface GrantPolicy {
  directVerifier: string;
  appleVerifier: string;
  revokedPurchases: ReadonlySet<string>;
  sandboxSubjects: ReadonlySet<string>;
}
const hashPattern = /^[a-f0-9]{64}$/;
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
}
// Server-origin only. Call after claimLicense max-account enforcement succeeds.
// Return only verified facts; never persist/log the raw key or license payload.
export async function verifyDirectGrant(key: string, publicKeyPEM: string, now = Date.now()): Promise<WorkspaceGrant> {
  requireEntitlement(typeof key === 'string' && key.length >= 10 && key.length <= 4096 && publicKeyPEM, 'PRO_REQUIRED');
  try {
    const parts = key.trim().split('.');
    requireEntitlement(parts.length === 2 && parts.every(p => /^[A-Za-z0-9+/]+={0,2}$/.test(p)), 'PRO_REQUIRED');
    const payload = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8'));
    requireEntitlement(payload && typeof payload === 'object' && !Array.isArray(payload) && payload.license === 'billngai-pro' && ['pro', 'pro-lifetime'].includes(payload.plan || 'pro'), 'PRO_REQUIRED');
    const der = Buffer.from(publicKeyPEM.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, ''), 'base64');
    const publicKey = await crypto.subtle.importKey('spki', der, {name: 'Ed25519'}, false, ['verify']);
    requireEntitlement(await crypto.subtle.verify({name:'Ed25519'}, publicKey, Buffer.from(parts[1], 'base64'), new TextEncoder().encode(canonical(payload))), 'PRO_REQUIRED');
    let until: number | null = null;
    if (payload.validUntil !== undefined && payload.validUntil !== null && payload.validUntil !== '') {
      requireEntitlement(typeof payload.validUntil === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.validUntil), 'PRO_REQUIRED');
      const midnight = Date.parse(payload.validUntil + 'T00:00:00+07:00');
      requireEntitlement(Number.isFinite(midnight) && new Date(midnight + 7 * 3600000).toISOString().slice(0,10) === payload.validUntil, 'PRO_REQUIRED');
      until = midnight + 86400000; // same inclusive Thailand date as legacy verifier
      requireEntitlement(until > now, 'PRO_REQUIRED');
    }
    return {source:'direct', purchase:createHash('sha256').update(key.trim()).digest('hex'), verifiedAt:now, until, verifier:createHash('sha256').update(der).digest('hex')};
  } catch (error) { if (error instanceof EntitlementError) throw error; throw new EntitlementError('PRO_REQUIRED'); }
}
export function hasWorkspaceAccess(grants: readonly WorkspaceGrant[], subject: string, policy: GrantPolicy, now = Date.now()): boolean {
  return grants.some(grant => {
    if (!grant || !hashPattern.test(grant.purchase) || !Number.isSafeInteger(grant.verifiedAt) || grant.verifiedAt <= 0 || grant.verifiedAt > now + 60000 || policy.revokedPurchases.has(grant.purchase)) return false;
    if (grant.until !== null && (!Number.isSafeInteger(grant.until) || grant.until <= now)) return false;
    if (grant.source === 'direct') return grant.verifier === policy.directVerifier && hashPattern.test(grant.verifier);
    if (grant.source === 'apple') return grant.verifier === policy.appleVerifier && grant.until !== null && grant.until <= grant.verifiedAt + 86400000 && (grant.environment === 'Production' || (grant.environment === 'Sandbox' && policy.sandboxSubjects.has(subject)));
    return false;
  });
}
