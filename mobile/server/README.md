# Mobile entitlement server proposal — not deployed

This is a bounded adapter proposal, not an integrated or deployed coordinator. No production service, MAS source, Cloudflare account, purchase, or Store configuration changed. Phone installation unchanged. Mobile sync/Pro are not accepted merely because these tests pass.

## Implementation

`src/google.ts` verifies RS256 Google ID tokens, issuer/expiry/issued-at, approved audience-to-authorized-party mapping, shared verified `sub` and expected-account equality. Configuration maps each audience to its approved `azp` IDs. A single-audience token may omit azp only if the audience authorizes itself. Every audience in a multi-audience token must be approved and authorize its explicit azp. The current native PKCE design uses the iOS client as audience/azp.

`src/apple.ts` accepts exactly `{signedTransaction:"<JWS>"}`. Official Apple SignedDataVerifier, online OCSP always enabled in production factory, explicit ES256, bundle/product/non-consumable/transaction/environment/date/revocation checks. Untrusted JWS environment only selects the verifier, which must cryptographically confirm it. Sandbox is restricted to approved Google subjects; Xcode/LocalTesting refused.

A genuine old non-consumable JWS has no expiry and may predate refunds. Every new grant asks App Store Server API getTransactionInfo and verifies the returned JWS, same original and transaction IDs, signed within 15 minutes. Verify this freshness rule against real Apple responses before release. Current proof is separate from independent local StoreKit ownership. API/verification response bounds are 15 seconds; underlying library HTTP may continue until its own timeout. No grant on timeout/outage. 404 transaction-not-found denied; other API failures retryable unavailable.

Purchase hash equals the legacy MAS identity: SHA256(environment:bundle:product:originalTransactionId). Do not retain/log raw JWS, receipt, private key or transaction identity. Hashes derive from verified server values only.

`src/grants.ts` re-verifies existing direct Ed25519 licenses with current plan/key-hash/inclusive Bangkok expiration semantics. It returns minimized server-origin facts. Common account-owned access can accept a bound direct grant without a license header on mobile. Explicit hash revocation or direct public-key rotation invalidates it; lifetime direct grants retain existing lifetime semantics. Apple grants must expire and cannot be lifetime grants. Call existing account-quota claims before persisting.

## Manager integration required

1. Keep legacy `{receipt}` verifier; add disjoint `{signedTransaction}` branch to existing `/v3/appstore-entitlement`, without fallthrough. Keep per-account verification rate limits.
2. Use existing `appstore-purchase:<hash>.claimLicense` before any Apple grant, maximum three Google accounts. Same hash means no second quota. Legacy verifier currently returns only hash; a compatible adapter must retain verified environment before common grant provenance is persisted.
3. Preserve direct X-BillNgai-License verification and `license:<hash>.claimLicense`. After success, persist verified direct facts in the same Google subject's DO. Existing direct/Windows buyers need a desktop connection once after this binding update; iOS must recognize that account without repurchase. No direct-key field/external-purchase CTA in Apple UI.
4. Store common grants by source/purchase under a new account-owned metadata key. Internal server methods only; client cannot submit source/hash/expiry. Do not erase valid direct grant upon Apple revocation. A safe authenticated GET `/v3/entitlement` may return boolean/source without proof. Authorization after verified Google auth must use these grants for all platform clients.
5. New Apple grant TTL one hour; preserve/migrate legacy 24-hour grants deliberately. Add verified Apple notifications/current revocation invalidation before claiming immediate revocation enforcement. Revocation must invalidate all account bindings to the same purchase hash. Direct hash revocation registry must be reviewed/configured; no existing direct revocation system was invented by these tests.
6. PRD read-only account+operation-bound recovery after entitlement expiry is still required. Existing coordinator does not expose it. Never retry unknown financial outcomes using a new mutation/operation ID.

This proposal does not implement DO migration/endpoints, desktop binding, notifications or asset sync. It preserves the existing service for manager integration.

## Configuration

Keep bundle `com.visarut.billngai`, product `com.visarut.billngai.pro`, Apple app ID `6789503350`; no new SKU. Native QA bundle must never be allowed by production verifier; a test server is separate/explicit.

Approved Google audience/party map + Google JWKS, explicit sandbox subjects, existing direct public key/fingerprint, reviewed purchase revocation set, Apple verifier policy version.

App Store Server API **In-App Purchase** signing key/key ID/issuer ID as secret bindings. Not read or provisioned here. A notarization key is not evidence of these privileges. Public root DER downloaded from [Apple PKI](https://www.apple.com/certificateauthority/): G3 SHA256 `63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179`. Reviewed root rotation support remains operational work. Never accept client roots.

**Workers compatibility:** static import of official Apple 3.1.0 crashes startup because jsrsasign seeds random values in forbidden global scope. `createAppleDependencies` is async and must be awaited inside a request. Lazy import tested successfully under compatibility date 2026-10-03/nodejs_compat. Do not invoke factory at module scope.

## Evidence / unverified

TypeScript passed. **13 tests passed**: cryptographically signed Google/direct fixtures and negative cases; mocked verified Apple policy/identity/freshness/revocation; sandbox; direct grants; missing credentials. Apple positive policy mocks are not live purchase proof.

Local workerd: actual public root self-signature, EC sign/verify, fake-JWS rejection, full synthetic certificate chain carrying Apple leaf/intermediate OIDs + ES256 JWS verified by official library. Positive synthetic chain uses online=false solely in localhost diagnostic; production factory online=true. Temporary synthetic private keys deleted by test shell trap. Evidence in `review/`.

Dry-run passed for localhost-only **diagnostic**, not production coordinator. `wrangler.jsonc` has workers_dev false and handler refuses nonlocal hosts. Do not deploy this probe. npm audit zero vulnerabilities; Apple package 3.1.0 pinned, exact lockfile present.

Still unverified: deployed Workers real OCSP/API network behavior; fresh live Apple transaction responses; actual purchase/restore/refund/TestFlight/MAS continuity; approved real Google audiences; DO grants/account-quota integration; direct buyer device continuity; notifications/recovery after expiry. No Store submission/deployment.

References: [Apple library](https://github.com/apple/app-store-server-library-node), [SignedDataVerifier](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html), [Cloudflare crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
