// Check me: single-note pitch detector (YIN with cumulative-mean normalisation and parabolic
// interpolation) plus an attack/onset detector, running in an AudioWorklet. Works on input only:
// nothing is ever sent to the speakers. Posts batches of frames [time, rms, f0, confidence, onset].
class CheckMeProcessor extends AudioWorkletProcessor{
  constructor(){
    super();
    this.dec=sampleRate>32000?2:1;            // 48/44.1 kHz -> 24/22 kHz (enough for C7 at 2.1 kHz)
    this.sr=sampleRate/this.dec;
    this.W=Math.round(this.sr*0.016);         // integration window ~16 ms
    this.maxTau=Math.ceil(this.sr/185);       // lowest note ~185 Hz (piece goes down to A3 = 220 Hz)
    this.minTau=Math.floor(this.sr/2600);     // highest ~2.6 kHz (C7 = 2.1 kHz, stretched)
    this.N=this.W+this.maxTau+2;
    this.ring=new Float32Array(this.N);this.wi=0;this.buf=new Float32Array(this.N);this.fill=0;
    this.hop=Math.round(this.sr*0.008);this.sinceHop=0;   // a frame every ~8 ms
    this.d=new Float32Array(this.maxTau+2);
    this.prevSample=0;this.half=0;this.halfAcc=0;
    this.hf=[];this.lastOnset=-1;this.out=[];this.t=0;
    // onset note check: spectrum just after the strike minus spectrum just before it
    this.FN=2048;this.FFT=4096;this.H=8192;this.hist=new Float32Array(this.H);this.hi=0;this.count=0;
    this.pend=[];this.re=new Float32Array(this.FFT);this.im=new Float32Array(this.FFT);
    this.win=new Float32Array(this.FN);for(let i=0;i<this.FN;i++)this.win[i]=0.5-0.5*Math.cos(2*Math.PI*i/(this.FN-1));
    this.port.onmessage=e=>{if(e.data==="flush")this.flush();};
  }
  flush(){if(this.out.length){this.port.postMessage(this.out);this.out=[];}}
  analyse(time){
    const N=this.N,W=this.W,maxTau=this.maxTau,d=this.d,b=this.buf,r=this.ring;
    for(let i=0;i<N;i++)b[i]=r[(this.wi+i)%N];   // oldest -> newest
    let e=0,h=0;
    for(let i=N-this.hop;i<N;i++){e+=b[i]*b[i];const df=b[i]-b[i-1];h+=df*df;}
    const rms=Math.sqrt(e/this.hop),hf=Math.sqrt(h/this.hop);
    // onset: sudden rise of high-frequency energy (a hammer strike) vs the last ~50 ms
    // (compared with the quietest of the last ~50 ms; a broadband jump in level also counts, for low notes)
    let onset=0;const hist=this.hf,rh=this.rh||(this.rh=[]);
    if(hist.length>=6){let m=Infinity,mr=Infinity;for(const v of hist)m=Math.min(m,v);for(const v of rh)mr=Math.min(mr,v);
      const hit=(hf>m*1.9&&hf>0.0015)||(rms>mr*1.8&&rms>0.004&&hf>m*1.3);
      if(hit&&(this.lastOnset<0||time-this.lastOnset>0.12)){onset=1;this.lastOnset=time;
        const at=this.count-(this.hop>>1),gap=Math.round(this.sr*0.005);
        if(at-this.hop-gap-this.FN>0)this.pend.push({time,pre:at-this.hop-gap-this.FN,post:at+gap});}}
    hist.push(hf);if(hist.length>6)hist.shift();rh.push(rms);if(rh.length>6)rh.shift();
    // YIN
    let f0=0,conf=0;
    if(rms>0.0008){
      const off=N-W-maxTau-1;
      d[0]=1;let run=0,tau=-1;
      for(let t=1;t<=maxTau;t++){
        let s=0;for(let j=0;j<W;j++){const x=b[off+j]-b[off+j+t];s+=x*x;}
        run+=s;d[t]=run>0?s*t/run:1;
      }
      for(let t=this.minTau;t<maxTau;t++){if(d[t]<0.15){while(t+1<maxTau&&d[t+1]<d[t])t++;tau=t;break;}}
      if(tau<0){let best=this.minTau;for(let t=this.minTau;t<maxTau;t++)if(d[t]<d[best])best=t;tau=best;}
      const a=d[tau-1],c=d[tau+1],m=d[tau],den=a+c-2*m;
      const tt=den>0?tau+(a-c)/(2*den):tau;
      f0=this.sr/tt;conf=Math.max(0,1-m);
    }
    this.out.push([+time.toFixed(4),+rms.toFixed(5),+f0.toFixed(2),+conf.toFixed(3),onset,+hf.toFixed(5)]);
    if(this.out.length>=6)this.flush();
  }
  spectrum(start){ // magnitude spectrum of FN samples from absolute index start (Hann, zero-padded to FFT)
    const n=this.FFT,re=this.re,im=this.im,H=this.H,base=this.count-start;
    for(let i=0;i<n;i++){re[i]=i<this.FN?this.hist[((this.hi-base+i)%H+H)%H]*this.win[i]:0;im[i]=0;}
    for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);
      for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let k=0;k<len>>1;k++){const p=i+k,q=p+(len>>1);
        const tr=re[q]*cr-im[q]*ci,ti=re[q]*ci+im[q]*cr;re[q]=re[p]-tr;im[q]=im[p]-ti;re[p]+=tr;im[p]+=ti;
        const nc=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=nc;}}}
    const m=new Float32Array(n>>1);for(let i=0;i<n>>1;i++)m[i]=Math.hypot(re[i],im[i]);return m;
  }
  onsetNote(p){
    if(this.count-p.pre>this.H)return;
    const A=this.spectrum(p.post),B=this.spectrum(p.pre),n=A.length,D=new Float32Array(n);
    let sd=0,sa=0;for(let i=0;i<n;i++){D[i]=Math.max(0,A[i]-1.1*B[i]);sd+=D[i];sa+=A[i];}
    if(sa<=0)return;
    const bin=this.sr/this.FFT;
    const hsum=X=>{const S=[];for(let m=55;m<=100;m++){const f0=440*Math.pow(2,(m-69)/12);let v=0;
      for(let h=1;h<=8;h++){const f=h*f0;if(f>this.sr*0.45)break;
        const lo=Math.floor(f*0.98/bin),hi=Math.ceil(f*1.02/bin);let mx=0;for(let k=lo;k<=hi&&k<n;k++)if(X[k]>mx)mx=X[k];v+=mx/h;}
      S[m]=v;}return S;};
    const S=hsum(D);
    let best=55;for(let m=55;m<=100;m++)if(S[m]>S[best])best=m;
    // was the same pitch already the loudest thing ringing? (then this is likely a swell, not a new strike)
    let sb=0;for(let i=0;i<n;i++)sb+=B[i];
    let same=0;if(sb>0.3*sa){const P=hsum(B);let bp=55;for(let m=55;m<=100;m++)if(P[m]>P[bp])bp=m;same=bp===best?1:0;}
    let second=0;for(let m=55;m<=100;m++){const k=Math.abs(m-best);if(k&&k!==12&&k!==24&&k!==19&&S[m]>second)second=S[m];}
    this.port.postMessage({n:[+p.time.toFixed(4),best,+(S[best]/(second||1e-9)).toFixed(2),+(sd/sa).toFixed(3),same]});
  }
  process(inputs){
    const inp=inputs[0]&&inputs[0][0];
    const q=128;
    if(inp){
      const r=this.ring;
      for(let i=0;i<inp.length;i++){
        let s=inp[i];
        if(this.dec===2){this.halfAcc+=s;if(++this.half<2)continue;s=this.halfAcc/2;this.half=0;this.halfAcc=0;}
        r[this.wi]=s;this.wi=(this.wi+1)%this.N;
        this.hist[this.hi]=s;this.hi=(this.hi+1)%this.H;this.count++;
        if(this.pend.length&&this.count>=this.pend[0].post+this.FN)this.onsetNote(this.pend.shift());
        if(this.fill<this.N)this.fill++;
        if(++this.sinceHop>=this.hop){this.sinceHop=0;if(this.fill>=this.N)this.analyse(currentTime+i/sampleRate);}
      }
    }
    return true;
  }
}
registerProcessor("checkme",CheckMeProcessor);
