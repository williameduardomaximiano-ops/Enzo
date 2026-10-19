const {test}=require('node:test');
const assert=require('node:assert/strict');
const {VoiceCapture}=require('../ui/voice-capture.cjs');
const block=level=>new Float32Array(1600).fill(level);
test('keeps a sentence together across a one second pause',()=>{
 const c=new VoiceCapture();
 for(let i=0;i<5;i++)assert.equal(c.push(block(.03)),null);
 for(let i=0;i<10;i++)assert.equal(c.push(block(0)),null);
 for(let i=0;i<5;i++)assert.equal(c.push(block(.03)),null);
 let result;for(let i=0;i<14;i++)result=c.push(block(0));
 assert.ok(result);assert.equal(result.length,34);
});
test('ignores background noise and brief clicks',()=>{
 const c=new VoiceCapture();
 for(let i=0;i<100;i++)assert.equal(c.push(block(.002)),null);
 assert.ok(c.samples<=16000*.45);
 c.push(block(.1));for(let i=0;i<14;i++)assert.equal(c.push(block(0)),null);
 assert.equal(c.started,false);
});
test('reset discards captured speaker audio; utterances stay within worker limit',()=>{
 const c=new VoiceCapture();c.push(block(.04));c.reset();
 for(let i=0;i<14;i++)assert.equal(c.push(block(0)),null);
 let result;for(let i=0;i<280;i++){result=c.push(block(.04));if(result)break;}
 assert.ok(result);assert.ok(result.reduce((n,b)=>n+b.length,0)<=16000*29);
});

