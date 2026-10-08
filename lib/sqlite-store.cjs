'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const digest=text=>createHash('sha256').update(text).digest('hex');
class SQLiteStore{
 constructor(file,{validate}){
  if(!path.isAbsolute(file)||typeof validate!=='function')throw Error('DATA_INVALID_STORE');
  this.file=file;this.validate=validate;
  const existed=fs.existsSync(file);
  if(existed&&!fs.lstatSync(file).isFile())throw Error('DATA_INVALID_FILE');
  if(!existed){if(!fs.existsSync(path.dirname(file)))fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);}
  this.identity=fs.lstatSync(file);
  try{
   this.db=new DatabaseSync(file,{allowExtension:false});
   const version=this.db.prepare('PRAGMA user_version').get().user_version;
   if(existed){
    if(version>1)throw Error('DATA_FUTURE_VERSION');
    if(version!==1)throw Error('DATA_INVALID_DATABASE');
    if(this.db.prepare('PRAGMA integrity_check').all().some(row=>row.integrity_check!=='ok'))throw Error('DATA_INVALID_DATABASE');
    this.read();
   }
   this.db.exec('PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
   if(!existed)this.transaction(()=>{
    this.db.exec("CREATE TABLE workspace (id INTEGER PRIMARY KEY CHECK(id=1), payload TEXT, revision TEXT NOT NULL, initialized INTEGER NOT NULL CHECK(initialized IN (0,1)), origin_path TEXT, origin_sha256 TEXT); PRAGMA user_version=1;");
    this.db.prepare("INSERT INTO workspace(id,payload,revision,initialized) VALUES(1,NULL,'empty',0)").run();
   });
  }catch(error){this.close();if(error.message?.startsWith('DATA_'))throw error;throw Error('DATA_INVALID_DATABASE',{cause:error});}
 }
 checkFile(){
  let st;try{st=fs.lstatSync(this.file);}catch(error){if(error.code==='ENOENT')throw Error('DATA_MISSING');throw error;}
  if(!st.isFile()||st.dev!==this.identity.dev||st.ino!==this.identity.ino)throw Error('DATA_CHANGED_ON_DISK');
 }
 transaction(action){this.db.exec('BEGIN IMMEDIATE');try{const result=action();this.db.exec('COMMIT');return result;}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}}
 read(){
  this.checkFile();const rows=this.db.prepare('SELECT * FROM workspace').all();
  if(rows.length!==1||rows[0].id!==1)throw Error('DATA_MISSING');
  const row=rows[0];
  if((row.origin_path===null)!==(row.origin_sha256===null)||(row.origin_path!==null&&(typeof row.origin_path!=='string'||!path.isAbsolute(row.origin_path)||!/^[a-f0-9]{64}$/.test(row.origin_sha256||''))))throw Error('DATA_INVALID_DATABASE');
  if(row.payload===null){if(row.initialized!==0||row.revision!=='empty'||row.origin_path!==null||row.origin_sha256!==null)throw Error('DATA_MISSING');return {text:null,revision:'empty'};}
  if(typeof row.payload!=='string'||row.initialized!==1||row.revision!==digest(row.payload))throw Error('DATA_INVALID_DATABASE');
  this.checked(row.payload);return {text:row.payload,revision:row.revision};
 }
 checked(text){if(typeof text!=='string'||Buffer.byteLength(text)>64*1024*1024)throw Error('DATA_INVALID_SIZE');this.validate(text);}
 origin(){
  this.checkFile();const row=this.db.prepare('SELECT origin_path,origin_sha256 FROM workspace WHERE id=1').get();if(!row)throw Error('DATA_MISSING');
  if(row.origin_path===null&&row.origin_sha256===null)return null;
  if(typeof row.origin_path!=='string'||!path.isAbsolute(row.origin_path)||!/^[a-f0-9]{64}$/.test(row.origin_sha256||''))throw Error('DATA_INVALID_DATABASE');
  return {path:row.origin_path,sha256:row.origin_sha256};
 }
 write(text,expectedRevision,origin){
  this.checked(text);this.checkFile();return this.transaction(()=>{
   if(this.read().revision!==expectedRevision)throw Error('DATA_CHANGED_ON_DISK');const revision=digest(text);
   this.db.prepare('UPDATE workspace SET payload=?,revision=?,initialized=1 WHERE id=1').run(text,revision);
   if(origin){if(!path.isAbsolute(origin.path)||!/^[a-f0-9]{64}$/.test(origin.sha256))throw Error('DATA_INVALID_MIGRATION');this.db.prepare('UPDATE workspace SET origin_path=?,origin_sha256=? WHERE id=1').run(origin.path,origin.sha256);}
   return revision;
  });
 }
 migrate(text,{originPath,backup}){
  this.checked(text);if(!path.isAbsolute(originPath)||typeof backup!=='function')throw Error('DATA_INVALID_MIGRATION');
  const previous=this.read(),source=digest(text),origin=this.origin();
  if(previous.text!==null){if(origin?.path===originPath&&origin.sha256===source)return previous.revision;throw Error('DATA_ALREADY_INITIALIZED');}
  const completed=backup(text);if(completed===false||completed?.then)throw Error('DATA_BACKUP_FAILED');
  const revision=this.transaction(()=>{
   if(this.read().revision!=='empty')throw Error('DATA_CHANGED_ON_DISK');
   this.db.prepare('UPDATE workspace SET payload=?,revision=?,initialized=1,origin_path=?,origin_sha256=? WHERE id=1').run(text,source,originPath,source);return source;
  });
  if(this.read().text!==text||this.origin()?.sha256!==source)throw Error('DATA_MIGRATION_VERIFY_FAILED');return revision;
 }
 close(){if(this.db){this.db.close();this.db=null;}}
}
module.exports={SQLiteStore};
