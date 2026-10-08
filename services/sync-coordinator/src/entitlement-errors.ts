export class EntitlementError extends Error {
  constructor(readonly code: string, readonly status = 403) { super(code); }
}
export function requireEntitlement(value: unknown, code: string, status = 403): asserts value {
  if (!value) throw new EntitlementError(code, status);
}
