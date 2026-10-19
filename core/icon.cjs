// Ícone da bandeja desenhado em código: um reator ciano (anel + núcleo), sem arquivos de imagem.
// Devolve pixels BGRA, o formato de nativeImage.createFromBitmap.
function reactorBitmap(size=32,{active=false}={}){
 const buf=Buffer.alloc(size*size*4);const c=(size-1)/2;const R=size*0.46,ring=size*0.09,core=size*0.2;
 const [r0,g0,b0]=active?[255,255,255]:[76,201,255];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const d=Math.hypot(x-c,y-c);
  const ringA=Math.max(0,1-Math.abs(d-(R-ring))/ring);const coreA=Math.max(0,1-Math.max(0,d-core*0.55)/(core*0.6));const glow=Math.max(0,1-d/R)*0.25;
  const a=Math.min(1,Math.max(ringA,coreA,glow));if(a<=0)continue;const white=coreA>0.6?coreA:0;
  const i=(y*size+x)*4;buf[i]=Math.round(b0+(255-b0)*white);buf[i+1]=Math.round(g0+(255-g0)*white);buf[i+2]=Math.round(r0+(255-r0)*white);buf[i+3]=Math.round(a*255);}
 return buf;}
module.exports={reactorBitmap};
