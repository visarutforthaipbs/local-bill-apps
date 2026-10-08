// Only the portable SHA-256 primitive changes; all billing/sync logic is shared.
import {sha256} from '@noble/hashes/sha2.js';
export const randomUUID=()=>globalThis.crypto.randomUUID();
export function createHash(algorithm){
 if(algorithm!=='sha256')throw Error('SYNC_HASH_UNSUPPORTED');
 const hash=sha256.create();
 const api={update(text){hash.update(new TextEncoder().encode(text));return api;},digest(format){if(format!=='hex')throw Error('SYNC_HASH_FORMAT_UNSUPPORTED');return Array.from(hash.digest(),b=>b.toString(16).padStart(2,'0')).join('');}};
 return api;
}
