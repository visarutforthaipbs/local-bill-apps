// Force mask 0 on the home-grown encoder and diff against the qrcode library.
const QRCode = require('qrcode');

const EXP=new Array(256),LOG=new Array(256);
(function(){let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&0x100)x^=0x11d;}for(let i=255;i<256;i++)EXP[i]=EXP[i-255];})();
const mul=(a,b)=> (a===0||b===0)?0:EXP[(LOG[a]+LOG[b])%255];
function genPoly(d){let p=[1];for(let i=0;i<d;i++){const np=new Array(p.length+1).fill(0);for(let j=0;j<p.length;j++){np[j]^=p[j];np[j+1]^=mul(p[j],EXP[i]);}p=np;}return p;}
function ecEncode(data,n){const g=genPoly(n);const r=new Array(n).fill(0);for(let i=0;i<data.length;i++){const f=data[i]^r[0];r.shift();r.push(0);for(let j=0;j<n;j++)r[j]^=mul(g[j],f);}return r;}
const T={1:[10,1,16,0,0],2:[16,1,28,0,0],3:[26,1,44,0,0],4:[18,2,32,0,0],5:[24,2,43,0,0],6:[16,4,27,0,0],7:[18,4,31,0,0],8:[22,2,38,2,39],9:[22,3,36,2,37],10:[26,4,43,1,44]};
const ALIGN={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
const dataCap=v=>T[v][1]*T[v][2]+T[v][3]*T[v][4];
function toBytes(s){const o=[];for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)o.push(c);else if(c<2048){o.push(192|(c>>6),128|(c&63));}else{o.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}}return o;}
function encode(bytes,v){const dc=dataCap(v);const bits=[];const put=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};put(0b0100,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));const cap=dc*8;put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);let pi=0;while(bits.length<cap){put([0xEC,0x11][pi++%2],8);}const cw=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];cw.push(b);}return cw;}
function interleave(dc,v){const t=T[v],ec=t[0],blocks=[];let idx=0;[[t[1],t[2]],[t[3],t[4]]].forEach(g=>{for(let b=0;b<g[0];b++){const d=dc.slice(idx,idx+g[1]);idx+=g[1];blocks.push({data:d,ec:ecEncode(d,ec)});}});const out=[];const md=Math.max(...blocks.map(b=>b.data.length));for(let i=0;i<md;i++)blocks.forEach(b=>{if(i<b.data.length)out.push(b.data[i]);});const me=Math.max(...blocks.map(b=>b.ec.length));for(let i=0;i<me;i++)blocks.forEach(b=>{if(i<b.ec.length)out.push(b.ec[i]);});return out;}
const MASKS=[(r,c)=>(r+c)%2===0,(r,c)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,(r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];
function build(v,cw,forceMask){
  const size=v*4+17;
  const m=[],res=[];for(let i=0;i<size;i++){m.push(new Array(size).fill(null));res.push(new Array(size).fill(false));}
  const setF=(r,c,val)=>{m[r][c]=val?1:0;res[r][c]=true;};
  function finder(r,c){for(let dr=-1;dr<=7;dr++)for(let dc=-1;dc<=7;dc++){const rr=r+dr,cc=c+dc;if(rr<0||rr>=size||cc<0||cc>=size)continue;const ring=(dr>=0&&dr<=6&&(dc===0||dc===6))||(dc>=0&&dc<=6&&(dr===0||dr===6));const core=dr>=2&&dr<=4&&dc>=2&&dc<=4;setF(rr,cc,(ring||core)&&dr>=0&&dr<=6&&dc>=0&&dc<=6);}}
  finder(0,0);finder(0,size-7);finder(size-7,0);
  for(let i=8;i<size-8;i++){setF(6,i,i%2===0);setF(i,6,i%2===0);}
  const ap=ALIGN[v];
  for(let a=0;a<ap.length;a++)for(let b=0;b<ap.length;b++){const r=ap[a],c=ap[b];if((r<=8&&c<=8)||(r<=8&&c>=size-9)||(r>=size-9&&c<=8))continue;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++)setF(r+dr,c+dc,Math.max(Math.abs(dr),Math.abs(dc))!==1);}
  setF(size-8,8,true);
  for(let i=0;i<9;i++){if(i!==6){res[8][i]=true;res[i][8]=true;}}
  for(let i=0;i<8;i++){res[8][size-1-i]=true;res[size-1-i][8]=true;}
  res[8][size-8]=true;
  function place(maskFn){const mm=m.map(r=>r.slice());let bi=0;const tot=cw.length*8;let col=size-1,up=true;while(col>0){if(col===6)col--;for(let i=0;i<size;i++){const row=up?size-1-i:i;for(let c2=0;c2<2;c2++){const cc=col-c2;if(res[row][cc])continue;let bit=0;if(bi<tot){bit=(cw[bi>>3]>>(7-(bi&7)))&1;bi++;}if(maskFn(row,cc))bit^=1;mm[row][cc]=bit;}}col-=2;up=!up;}return mm;}
  return {mm:place(MASKS[forceMask]), res, size};
}

const payload = '00020101021229370016A0000006770101110113006681234567853037645407800000.005802TH6304479F';
const bytes = toBytes(payload);
// qrcode lib version for this payload at ECC M:
const ref = QRCode.create(payload, {errorCorrectionLevel:'M', maskPattern:0});
const refMods = ref.modules; // {size, data}
const v = ref.version;
console.log('reference version', v, 'size', refMods.size);

const dc = interleave(encode(bytes, v), v);
const {mm, res, size} = build(v, dc, 0);
console.log('home-grown size', size);

function refAt(r,c){ return refMods.data[r*refMods.size + c] ? 1 : 0; }
let diffs=0, firstDiffs=[];
for(let r=0;r<size;r++) for(let c=0;c<size;c++){
  const a = mm[r][c]?1:0, b = refAt(r,c);
  if(a!==b){ diffs++; if(firstDiffs.length<25) firstDiffs.push([r,c,a,b,res[r][c]?'fn':'data']); }
}
console.log('total module diffs (mask0):', diffs);
console.log('first diffs [r,c,ours,ref,kind]:');
firstDiffs.forEach(d=>console.log('  ', d.join('\t')));
