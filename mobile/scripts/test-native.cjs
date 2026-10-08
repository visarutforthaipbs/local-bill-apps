'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'BillNgai-native-tests-'));
try{
 for(const [source,test,name] of [['BillNgaiStore.swift','StoreTests.swift','store-tests'],['BillNgaiEditorDraftStore.swift','EditorDraftTests.swift','draft-tests']]){
 const binary=path.join(temporary,name);
 execFileSync('xcrun',['swiftc',path.join(root,'ios/App/App',source),path.join(root,'test',test),'-lsqlite3','-o',binary],{stdio:'inherit'});
 execFileSync(binary,[path.join(root,'../lib/billing-data.cjs')],{stdio:'inherit'});
 }
}catch(error){process.exitCode=1;}
finally{fs.rmSync(temporary,{recursive:true,force:true});}
