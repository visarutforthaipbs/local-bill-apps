const fs=require('node:fs'),path=require('node:path'),esbuild=require('esbuild');
// Build the exact reviewed CommonJS core; never maintain a second merge algorithm.
module.exports=async function bundleSync(out){
 const root=path.resolve(__dirname,'..'),desktop=path.resolve(root,'..');
 await esbuild.build({stdin:{contents:"const S=require('./lib/sync-v3.cjs');const B=require('./lib/sync-v3-billing.cjs');const {BillingSyncController}=require('./lib/sync-v3-controller.cjs');window.BillNgaiSyncCore={S,B,BillingSyncController};",resolveDir:desktop},bundle:true,format:'iife',platform:'browser',target:['safari17'],outfile:path.join(out,'mobile-sync-core.js'),plugins:[{name:'native-crypto-adapter',setup(build){build.onResolve({filter:/^node:crypto$/},()=>({path:path.join(root,'web/sync-crypto.js')}));}}]});
};
