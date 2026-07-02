// Verify the PromptPay payload + QR encoder from billing.html by decoding it with jsQR.
const jsQR = require('jsqr');

/* ---- copied verbatim from billing.html ---- */
function ppCrc16(str){
  let crc=0xFFFF;
  for(let i=0;i<str.length;i++){ crc^=(str.charCodeAt(i)<<8);
    for(let j=0;j<8;j++){ crc = (crc&0x8000)? ((crc<<1)^0x1021)&0xFFFF : (crc<<1)&0xFFFF; } }
  return crc.toString(16).toUpperCase().padStart(4,'0');
}
function promptpayPayload(target, amount){
  const digits = String(target||'').replace(/\D/g,'');
  if(digits.length!==10 && digits.length!==13) return null;
  const tlv=(id,val)=> id + String(val.length).padStart(2,'0') + val;
  let acc;
  if(digits.length===10){
    const p = digits[0]==='0' ? '66'+digits.slice(1) : digits;
    acc = tlv('01', ('0000000000000'+p).slice(-13));
  }else{
    acc = tlv('02', digits);
  }
  const merchant = tlv('29', tlv('00','A000000677010111') + acc);
  const hasAmt = amount!=null && Number(amount)>0;
  let p = '000201' + (hasAmt?'010212':'010211') + merchant + tlv('53','764');
  if(hasAmt) p += tlv('54', Number(amount).toFixed(2));
  p += tlv('58','TH') + '6304';
  return p + ppCrc16(p);
}

const QR = (function(){
  const EXP=new Array(256),LOG=new Array(256);
  (function(){let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&0x100)x^=0x11d;}for(let i=255;i<256;i++)EXP[i]=EXP[i-255];})();
  const mul=(a,b)=> (a===0||b===0)?0:EXP[(LOG[a]+LOG[b])%255];
  function genPoly(d){let p=[1];for(let i=0;i<d;i++){const np=new Array(p.length+1).fill(0);for(let j=0;j<p.length;j++){np[j]^=p[j];np[j+1]^=mul(p[j],EXP[i]);}p=np;}return p;}
  function ecEncode(data,n){const g=genPoly(n);const r=new Array(n).fill(0);for(let i=0;i<data.length;i++){const f=data[i]^r[0];r.shift();r.push(0);for(let j=0;j<n;j++)r[j]^=mul(g[j],f);}return r;}
  const T={1:[10,1,16,0,0],2:[16,1,28,0,0],3:[26,1,44,0,0],4:[18,2,32,0,0],5:[24,2,43,0,0],6:[16,4,27,0,0],7:[18,4,31,0,0],8:[22,2,38,2,39],9:[22,3,36,2,37],10:[26,4,43,1,44]};
  const ALIGN={1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};
  const dataCap=v=>T[v][1]*T[v][2]+T[v][3]*T[v][4];
  function chooseV(len){for(let v=1;v<=10;v++){const cci=v<10?8:16;if(Math.floor((dataCap(v)*8-4-cci)/8)>=len)return v;}throw new Error('QR: data too long');}
  function toBytes(s){const o=[];for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)o.push(c);else if(c<2048){o.push(192|(c>>6),128|(c&63));}else{o.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}}return o;}
  function encode(bytes,v){const dc=dataCap(v);const bits=[];const put=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};put(0b0100,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));const cap=dc*8;put(0,Math.min(4,cap-bits.length));while(bits.length%8)bits.push(0);let pi=0;while(bits.length<cap){put([0xEC,0x11][pi++%2],8);}const cw=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i+j];cw.push(b);}return cw;}
  function interleave(dc,v){const t=T[v],ec=t[0],blocks=[];let idx=0;[[t[1],t[2]],[t[3],t[4]]].forEach(g=>{for(let b=0;b<g[0];b++){const d=dc.slice(idx,idx+g[1]);idx+=g[1];blocks.push({data:d,ec:ecEncode(d,ec)});}});const out=[];const md=Math.max(...blocks.map(b=>b.data.length));for(let i=0;i<md;i++)blocks.forEach(b=>{if(i<b.data.length)out.push(b.data[i]);});const me=Math.max(...blocks.map(b=>b.ec.length));for(let i=0;i<me;i++)blocks.forEach(b=>{if(i<b.ec.length)out.push(b.ec[i]);});return out;}
  const MASKS=[(r,c)=>(r+c)%2===0,(r,c)=>r%2===0,(r,c)=>c%3===0,(r,c)=>(r+c)%3===0,(r,c)=>(Math.floor(r/2)+Math.floor(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,(r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];
  function build(v,cw){
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
    function fmtBits(mask){const data=(0b00<<3)|mask;let rem=data;for(let i=0;i<10;i++){rem<<=1;if(rem&0b10000000000)rem^=0b10100110111;}return((data<<10)|(rem&0b1111111111))^0b101010000010010;}
    function placeFmt(mm,mask){const bits=fmtBits(mask);const A=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];const B=[[size-1,8],[size-2,8],[size-3,8],[size-4,8],[size-5,8],[size-6,8],[size-7,8],[8,size-8],[8,size-7],[8,size-6],[8,size-5],[8,size-4],[8,size-3],[8,size-2],[8,size-1]];for(let i=0;i<15;i++){const bit=(bits>>i)&1;mm[A[i][0]][A[i][1]]=bit;mm[B[i][0]][B[i][1]]=bit;}}
    function penalty(mm){const n=size;let s=0;for(let r=0;r<n;r++){let run=1;for(let c=1;c<n;c++){if(mm[r][c]===mm[r][c-1]){run++;if(run===5)s+=3;else if(run>5)s++;}else run=1;}}for(let c=0;c<n;c++){let run=1;for(let r=1;r<n;r++){if(mm[r][c]===mm[r-1][c]){run++;if(run===5)s+=3;else if(run>5)s++;}else run=1;}}for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++){const v=mm[r][c];if(v===mm[r][c+1]&&v===mm[r+1][c]&&v===mm[r+1][c+1])s+=3;}const seq=[1,0,1,1,1,0,1,0,0,0,0],seq2=[0,0,0,0,1,0,1,1,1,0,1];function chk(line){let t=0;for(let i=0;i+11<=line.length;i++){let m1=true,m2=true;for(let k=0;k<11;k++){if(line[i+k]!==seq[k])m1=false;if(line[i+k]!==seq2[k])m2=false;}if(m1||m2)t+=40;}return t;}for(let r=0;r<n;r++)s+=chk(mm[r]);for(let c=0;c<n;c++){const col=[];for(let r=0;r<n;r++)col.push(mm[r][c]);s+=chk(col);}let dark=0;for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(mm[r][c])dark++;s+=Math.floor(Math.abs(dark*100/(n*n)-50)/5)*10;return s;}
    let best=null,bs=Infinity;for(let k=0;k<8;k++){const mm=place(MASKS[k]);placeFmt(mm,k);const sc=penalty(mm);if(sc<bs){bs=sc;best=mm;}}
    return best;
  }
  function generate(str){const bytes=toBytes(str);const v=chooseV(bytes.length);return build(v,interleave(encode(bytes,v),v));}
  return {generate};
})();

/* ---- decode test ---- */
function matrixToImageData(mm, scale, quiet){
  const n = mm.length;
  const total = n + quiet*2;
  const W = total*scale;
  const data = new Uint8ClampedArray(W*W*4);
  for(let i=0;i<data.length;i+=4){ data[i]=255;data[i+1]=255;data[i+2]=255;data[i+3]=255; }
  for(let r=0;r<n;r++) for(let c=0;c<n;c++){
    if(!mm[r][c]) continue;
    for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++){
      const y=(r+quiet)*scale+dy, x=(c+quiet)*scale+dx;
      const idx=(y*W+x)*4; data[idx]=0;data[idx+1]=0;data[idx+2]=0;data[idx+3]=255;
    }
  }
  return {data, width:W, height:W};
}

const cases = [
  ['mobile 10-digit, no amount', promptpayPayload('0812345678', null)],
  ['mobile 10-digit, amount 8000', promptpayPayload('0812345678', 8000)],
  ['mobile, amount 8000.00', promptpayPayload('0865551234', 8000)],
  ['national id 13-digit, amount', promptpayPayload('1234567890123', 1234.50)],
];

let pass=0, fail=0;
for(const [label, payload] of cases){
  if(!payload){ console.log('SKIP', label, '(null payload)'); continue; }
  const mm = QR.generate(payload);
  const img = matrixToImageData(mm, 8, 4);
  const res = jsQR(img.data, img.width, img.height);
  const ok = res && res.data === payload;
  console.log(ok?'PASS':'FAIL', '|', label);
  console.log('   size', mm.length+'x'+mm.length, '| payload len', payload.length);
  console.log('   payload :', payload);
  if(res) console.log('   decoded :', res.data);
  else    console.log('   decoded : <none — unscannable>');
  ok ? pass++ : fail++;
}
console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
