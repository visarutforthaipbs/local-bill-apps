import {Buffer} from 'node:buffer';
import { createHash } from 'node:crypto';
import type { AppStoreServerAPIClient, SignedDataVerifier, Environment as AppleEnvType, JWSTransactionDecodedPayload } from '@apple/app-store-server-library';
const Environment = {PRODUCTION:'Production', SANDBOX:'Sandbox'} as const;
import { EntitlementError, requireEntitlement } from './entitlement-errors.ts';

export type AppleEnvironment = 'Production' | 'Sandbox';
export interface AppleVerifierConfig {
  bundleId: string;
  productId: string;
  appAppleId: number;
  roots: Buffer[];
  sandboxSubjects: readonly string[];
  api: { signingKey: string; keyId: string; issuerId: string };
}
export interface AppleDependencies {
  verify(jws: string, environment: AppleEnvironment): Promise<JWSTransactionDecodedPayload>;
  current(transactionId: string, environment: AppleEnvironment): Promise<string>;
}
export const APPLE_GRANT_TTL = 60 * 60 * 1000;
async function bounded<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new EntitlementError('APPSTORE_VERIFICATION_UNAVAILABLE', 503)), 15000); })]); }
  finally { if (timer) clearTimeout(timer); }
}

const ID = /^\d{1,128}$/;
// Identical to legacy verifyReceipt: one purchase cannot get two account quotas.
export function purchaseHash(environment: AppleEnvironment, bundle: string, product: string, original: string): string {
  requireEntitlement((environment === Environment.PRODUCTION || environment === Environment.SANDBOX) && /^[A-Za-z0-9._-]+$/.test(bundle) && /^[A-Za-z0-9._-]+$/.test(product) && ID.test(original), 'APPSTORE_TRANSACTION_INVALID');
  return createHash('sha256').update([environment, bundle, product, original].join(':')).digest('hex');
}
function validateTransaction(tx: JWSTransactionDecodedPayload, config: Pick<AppleVerifierConfig, 'bundleId' | 'productId'>, environment: AppleEnvironment, now: number) {
  requireEntitlement(tx.bundleId === config.bundleId && tx.productId === config.productId && tx.environment === environment && tx.type === 'Non-Consumable', 'APPSTORE_TRANSACTION_INVALID');
  requireEntitlement(typeof tx.transactionId === 'string' && ID.test(tx.transactionId) && typeof tx.originalTransactionId === 'string' && ID.test(tx.originalTransactionId), 'APPSTORE_TRANSACTION_INVALID');
  requireEntitlement(Number.isSafeInteger(tx.signedDate) && tx.signedDate! > 0 && tx.signedDate! <= now + 60000, 'APPSTORE_TRANSACTION_INVALID');
  requireEntitlement(Number.isSafeInteger(tx.purchaseDate) && tx.purchaseDate! > 0 && tx.purchaseDate! <= now + 60000, 'APPSTORE_TRANSACTION_INVALID');
  requireEntitlement(!Object.hasOwn(tx, 'revocationDate') && !Object.hasOwn(tx, 'revocationReason') && !Object.hasOwn(tx, 'revocationType') && !Object.hasOwn(tx, 'revocationPercentage') && tx.isUpgraded !== true, 'APPSTORE_PRO_REVOKED');
  requireEntitlement(tx.expiresDate === undefined || (Number.isSafeInteger(tx.expiresDate) && tx.expiresDate > now), 'APPSTORE_PRO_EXPIRED');
}
function validJWS(jws: unknown): asserts jws is string {
  requireEntitlement(typeof jws === 'string' && jws.length >= 12 && jws.length <= 400000 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jws), 'APPSTORE_TRANSACTION_INVALID');
  // Pin algorithm before invoking library, which otherwise accepts algorithms
  // compatible with its public key. Header claims never select trust roots.
  let header: unknown;
  try { header = JSON.parse(Buffer.from(jws.split('.')[0], 'base64url').toString('utf8')); } catch { throw new EntitlementError('APPSTORE_TRANSACTION_INVALID'); }
  requireEntitlement(header && typeof header === 'object' && (header as {alg?:string}).alg === 'ES256', 'APPSTORE_TRANSACTION_INVALID');
}
export async function createAppleDependencies(config: AppleVerifierConfig): Promise<AppleDependencies> {
  requireEntitlement(config.roots.length > 0 && config.roots.every(root=>root.length>0) && Number.isSafeInteger(config.appAppleId) && config.appAppleId > 0 && config.api?.signingKey && config.api.keyId && config.api.issuerId, 'APPSTORE_NOT_CONFIGURED', 503);
  // jsrsasign seeds randomness at import. Workers forbids that in global scope;
  // load the official library inside the request handler, not at module startup.
  const [{AppStoreServerAPIClient, SignedDataVerifier, VerificationException, VerificationStatus, APIException},{default:fetchApple}] = await Promise.all([import('@apple/app-store-server-library'),import('node-fetch')]);
  // Retain the official JWT signing/response validation, but bound its HTTP
  // body/deadline and prohibit redirects or arbitrary outbound URLs.
  class BoundedAppleClient extends AppStoreServerAPIClient {
    constructor(private readonly endpoint:string,environment:AppleEnvType){super(config.api.signingKey,config.api.keyId,config.api.issuerId,config.bundleId,environment);}
    protected override makeFetchRequest(path:string,query:URLSearchParams,method:string,body:string|Buffer|undefined,headers:Record<string,string>){
      requireEntitlement(method==='GET' && /^\/inApps\/v1\/transactions\/\d{1,128}$/.test(path) && !query.size && body===undefined,'APPSTORE_TRANSACTION_INVALID');
      return fetchApple(this.endpoint+path,{method,headers,redirect:'manual',size:524288,timeout:15000,signal:AbortSignal.timeout(15000)});
    }
  }
  const verifiers = new Map<AppleEnvironment, SignedDataVerifier>();
  const clients = new Map<AppleEnvironment, AppStoreServerAPIClient>();
  for (const environment of [Environment.PRODUCTION, Environment.SANDBOX] as const) {
    verifiers.set(environment, new SignedDataVerifier(config.roots, true, environment as AppleEnvType, config.bundleId, config.appAppleId));
    clients.set(environment, new BoundedAppleClient(environment===Environment.PRODUCTION?'https://api.storekit.itunes.apple.com':'https://api.storekit-sandbox.itunes.apple.com',environment as AppleEnvType));
  }
  return {
    async verify(jws, environment) {
      try { return await bounded(verifiers.get(environment)!.verifyAndDecodeTransaction(jws)); }
      catch (error) {
        if (error instanceof EntitlementError) throw error;
        if (error instanceof VerificationException && error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE) throw new EntitlementError('APPSTORE_VERIFICATION_UNAVAILABLE', 503);
        throw new EntitlementError('APPSTORE_TRANSACTION_INVALID');
      }
    },
    async current(id, environment) {
      try {
        const result = await bounded(clients.get(environment)!.getTransactionInfo(id));
        requireEntitlement(typeof result.signedTransactionInfo === 'string', 'APPSTORE_VERIFICATION_UNAVAILABLE', 503);
        return result.signedTransactionInfo;
      } catch (error) {
        if (error instanceof APIException && error.httpStatusCode === 404) throw new EntitlementError('APPSTORE_TRANSACTION_INVALID');
        throw new EntitlementError('APPSTORE_VERIFICATION_UNAVAILABLE', 503);
      }
    }
  };
}
export async function verifyStoreKit2(input: unknown, subject: string, config: Pick<AppleVerifierConfig, 'bundleId' | 'productId' | 'sandboxSubjects'>, dependencies: AppleDependencies, now = Date.now()) {
  const request = input as { signedTransaction?: unknown };
  requireEntitlement(request && typeof request === 'object' && !Array.isArray(request) && Object.keys(request).length === 1 && Object.hasOwn(request, 'signedTransaction'), 'APPSTORE_TRANSACTION_INVALID');
  validJWS(request.signedTransaction);
  // Untrusted environment is a routing hint only: the selected verifier must
  // cryptographically confirm this same environment before using any identity.
  let routing: {environment?: unknown};
  try { routing = JSON.parse(Buffer.from(request.signedTransaction.split('.')[1], 'base64url').toString('utf8')); } catch { throw new EntitlementError('APPSTORE_TRANSACTION_INVALID'); }
  requireEntitlement(routing && (routing.environment === Environment.PRODUCTION || routing.environment === Environment.SANDBOX), 'APPSTORE_TRANSACTION_INVALID');
  const environment = routing.environment;
  requireEntitlement(environment !== Environment.SANDBOX || config.sandboxSubjects.includes(subject), 'APPSTORE_SANDBOX_NOT_ENABLED');
  validJWS(request.signedTransaction);
  const proof = await dependencies.verify(request.signedTransaction, environment);
  validateTransaction(proof, config, environment, now);
  // A non-consumable JWS has no expiry. Even a genuine old proof may predate a
  // refund: ask Apple for current transaction information on every new grant.
  const latestJWS = await dependencies.current(proof.transactionId!, environment);
  validJWS(latestJWS);
  const latest = await dependencies.verify(latestJWS, environment);
  // Freshness comes from the bounded authenticated server request above. Apple
  // does not promise to re-sign a lifetime transaction on every API read.
  validateTransaction(latest, config, environment, now);
  requireEntitlement(latest.transactionId === proof.transactionId && latest.originalTransactionId === proof.originalTransactionId, 'APPSTORE_TRANSACTION_INVALID');
  return { purchase: purchaseHash(environment, config.bundleId, config.productId, latest.originalTransactionId!), environment, checkedAt: now, until: now + APPLE_GRANT_TTL };
}
