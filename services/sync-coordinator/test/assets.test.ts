import { env } from 'cloudflare:test';
import { it, expect } from 'vitest';
declare module 'cloudflare:test' { interface ProvidedEnv extends Env {} }
const hash=(n:number)=>n.toString(16).padStart(64,'0');
const fresh=()=>{
 const stub=env.WORKSPACES.getByName(crypto.randomUUID());
 const invoke=async(action:string,input:unknown)=>{const result=await stub.request(action,input);if(result.status!==200)throw new Error((result.data as {error:string}).error);return result.data as any;};
 return {initialize:(v:unknown)=>invoke('initialize',v),commit:(v:unknown)=>invoke('commit',v),pull:(n:number)=>invoke('pull',n)};
};
it('accepts a stored image record and never lets its key carry different content',async()=>{
 const s=fresh(),asset={key:'asset:'+hash(7),base:0,hash:hash(1),file:'driveAsset'};
 expect((await s.initialize({root:'rootFolder',commit:{operation:'init',changes:[{key:'business:main',base:0,hash:hash(0),file:'driveFile'},asset]}})).ok).toBe(true);
 // The same content committed again by another device is an ordinary revision conflict, resolved by pulling.
 expect(await s.commit({operation:'again',changes:[asset]})).toMatchObject({ok:false,conflicts:[{key:asset.key,revision:1,hash:hash(1)}]});
 await expect(s.commit({operation:'changed',changes:[{...asset,base:1,hash:hash(2)}]})).rejects.toThrow('ASSET_IMMUTABLE');
 expect((await s.pull(0)).transactions).toHaveLength(1);
});
