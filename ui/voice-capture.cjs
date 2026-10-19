// Sample-based endpointing, independent of callback timing.
class VoiceCapture {
 constructor(rate=16000){this.rate=rate;this.reset();}
 reset(){this.frames=[];this.samples=0;this.voiced=0;this.silent=0;this.started=false;}
 push(input,threshold=.013){
  const rms=Math.sqrt(input.reduce((sum,x)=>sum+x*x,0)/input.length);
  const speaking=rms>(this.started?threshold*.65:threshold);
  this.frames.push(input);this.samples+=input.length;
  if(speaking){this.started=true;this.voiced+=input.length;this.silent=0;}
  else if(this.started)this.silent+=input.length;
  if(!this.started){
   while(this.frames.length>1&&this.samples-this.frames[0].length>=this.rate*.35)this.samples-=this.frames.shift().length;
   return null;
  }
  if(this.silent<this.rate*1.4&&this.samples<this.rate*28)return null;
  const chunks=this.voiced>=this.rate*.22?this.frames:null;
  this.reset();return chunks;
 }
}
module.exports={VoiceCapture};

