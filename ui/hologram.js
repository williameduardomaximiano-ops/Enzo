import * as THREE from 'three';
import { IMAGE_URI } from './hologram-image.js';

// COSMO — holograma visual aprovado em 13/10/2026.
// A imagem fornecida pelo usuário é a fonte visual fiel (linhas, olhos,
// estrelas e onda azul); o shader anima as regiões faciais sem redesenhar o rosto.
// Este modo é 2.5D: preserva o visual original, mas NÃO é um modelo 3D rigado.
const IMAGE = IMAGE_URI;
const VERTEX = `
  varying vec2 vUv;
  uniform float uTiltX;
  uniform float uTiltY;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Microprofundidade apenas na região do rosto, sem mover o fundo espacial.
    vec2 rel = (uv - vec2(.422, .575)) / vec2(.23, .39);
    float face = exp(-dot(rel,rel)*2.2);
    p.z += face * .028;
    p.x += face * uTiltX * .013;
    p.y += face * uTiltY * .008;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FRAGMENT = `
  uniform sampler2D uImage;
  uniform vec3 uAccent;
  uniform float uVisualMode;
  uniform float uMouth;
  uniform float uBlink;
  uniform float uBrow;
  uniform float uEnergy;
  uniform float uTiltX;
  uniform float uTiltY;
  varying vec2 vUv;
  float ellipse(vec2 uv, vec2 center, vec2 radius) {
    vec2 d=(uv-center)/radius;
    return exp(-dot(d,d)*3.0);
  }
  void main() {
    vec2 uv = vUv;
    // Movimento quase imperceptível da cabeça, com fundo fixo.
    float face=ellipse(uv,vec2(.422,.565),vec2(.245,.405));
    uv.x -= uTiltX*.0025*face;
    uv.y -= uTiltY*.0017*face;

    // Amplitude da voz abre e fecha o contorno dos lábios.
    float lips=ellipse(uv,vec2(.419,.343),vec2(.100,.042));
    uv.y += uMouth*.012*lips*sign(uv.y-.343);

    // Pequena atuação das sobrancelhas nos estados de resposta/permissão.
    float browL=ellipse(uv,vec2(.347,.654),vec2(.085,.055));
    float browR=ellipse(uv,vec2(.516,.654),vec2(.085,.055));
    uv.y -= uBrow*.0035*(browL+browR);

    // Piscar: amostra progressivamente a pálpebra, sem sobrepor olhos novos.
    vec2 leftEye=vec2(.348,.585), rightEye=vec2(.518,.585);
    float l=ellipse(uv,leftEye,vec2(.063,.030));
    float r=ellipse(uv,rightEye,vec2(.063,.030));
    float eyeMask=clamp(l+r,0.0,1.0);
    float direction=uv.x<.435?leftEye.y:rightEye.y;
    uv.y+=uBlink*eyeMask*(direction-uv.y)*.93;

    vec3 col=texture2D(uImage,clamp(uv,vec2(.001),vec2(.999))).rgb;
    // O modo original mantém cada cor da imagem sem modificação.
    if(uVisualMode > 0.5) {
      float lit=max(max(col.r,col.g),col.b);
      float glow=smoothstep(.12,.83,lit);
      float grey=dot(col,vec3(.2126,.7152,.0722));
      vec3 tint=uAccent*(grey*1.16+.04);
      col=mix(col,tint,glow*.90);
    }
    // Escurece o interior da boca durante a fala, conservando o wireframe.
    float inner=ellipse(vUv,vec2(.417,.340),vec2(.076,.008))*uMouth;
    col *= 1.0-inner*.31;
    // Nenhuma recoloração do original. Somente intensidade ligada ao estado.
    col*=mix(.87,1.03,clamp(uEnergy,0.0,1.0));
    gl_FragColor=vec4(col,1.0);
  }
`;

export function createHologram(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'low-power', alpha:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.setClearColor(0x03040a,1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.01,10);
  camera.position.z=3;
  const uniforms = {
    uImage:{value:null}, uMouth:{value:0}, uBlink:{value:0},
    uBrow:{value:0}, uEnergy:{value:1}, uTiltX:{value:0},uTiltY:{value:0},
    uAccent:{value:new THREE.Color(0x55d6ef)}, uVisualMode:{value:0}
  };
  // Muitos segmentos: permite a pequena deformação espacial do rosto.
  const geometry = new THREE.PlaneGeometry(1,1,48,40);
  const material = new THREE.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT});
  const plane = new THREE.Mesh(geometry,material);
  scene.add(plane);
  const accentColors=Object.freeze({original:0x55d6ef,'humanoid-blue':0x408fff,'sentinel-cyan':0x48f4df,'phantom-violet':0xa883ff,'titan-silver':0xcbd9ec,'fusion-amber':0xffbd63});
  let disposed=false, ready=false, state='idle', level=0, smoothLevel=0;
  let targetX=0,targetY=0,frameId=0,previous=0,nextBlink=3,blinkStart=-10;
  let blinkCounter=0;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  const textureLoader=new THREE.TextureLoader();
  const texture=textureLoader.load(IMAGE, t=>{
    if(disposed){t.dispose();return;}
    t.colorSpace=THREE.SRGBColorSpace;
    t.magFilter=THREE.LinearFilter;
    t.minFilter=THREE.LinearMipmapLinearFilter;
    uniforms.uImage.value=t;
    ready=true;
    resize();
  }, undefined, ()=>{
    if(!disposed){canvas.dataset.hologramError='imagem-indisponivel';
      // A falha não afeta nenhuma função de voz/IA ou comando.
    }
  });
  function resize(){
    if(disposed)return;
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    renderer.setSize(r.width,r.height,false);
    const viewport=r.width/r.height;
    camera.left=-viewport;camera.right=viewport;camera.top=1;camera.bottom=-1;
    camera.updateProjectionMatrix();
    const imageAspect=(texture.image?.width&&texture.image?.height)
      ?texture.image.width/texture.image.height:1536/1135;
    // Cover, sem distorcer. Nunca altera a proporção da imagem aprovada.
    const h=Math.max(2,2*viewport/imageAspect);
    plane.scale.set(h*imageAspect,h,1);
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  const move=e=>{const r=canvas.getBoundingClientRect();
    targetX=THREE.MathUtils.clamp((e.clientX-r.left)/Math.max(r.width,1)-.5,-.5,.5);
    targetY=THREE.MathUtils.clamp((e.clientY-r.top)/Math.max(r.height,1)-.5,-.5,.5);
  };
  const leave=()=>{targetX=0;targetY=0};
  canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerleave',leave);
  function draw(ms){
    if(disposed)return;
    frameId=requestAnimationFrame(draw);
    if(document.hidden||ms-previous<(reduced?100:33))return;
    previous=ms;
    const time=ms/1000;
    if(!reduced && time>nextBlink){blinkStart=time;nextBlink=time+3.4+((blinkCounter++*7)%6)*.37;}
    const delta=time-blinkStart;
    const blink=!reduced&&delta>=0&&delta<.19?Math.sin((delta/.19)*Math.PI):0;
    uniforms.uBlink.value=blink;
    smoothLevel+=(level-smoothLevel)*.35;
    uniforms.uMouth.value=state==='speaking'?Math.min(1,smoothLevel*5):0;
    uniforms.uBrow.value=state==='thinking'?.7:state==='permission'?.95:0;
    const brightness=state==='paused'?.77:state==='listening'?1.07:1;
    uniforms.uEnergy.value+=(brightness-uniforms.uEnergy.value)*.1;
    const x=reduced?0:targetX*.65;
    const y=reduced?0:targetY*.45;
    uniforms.uTiltX.value+=(x-uniforms.uTiltX.value)*.08;
    uniforms.uTiltY.value+=(y-uniforms.uTiltY.value)*.08;
    if(ready)renderer.render(scene,camera);
  }
  frameId=requestAnimationFrame(draw);
  canvas.dataset.hologram='imagem-oficial-animada-v1';
  canvas.dataset.visualReference='holograma-oficial.jpg';
  return {
    setPreset(name){if(!Object.hasOwn(accentColors,name))return false;uniforms.uAccent.value.setHex(accentColors[name]);uniforms.uVisualMode.value=name==='original'?0:1;canvas.dataset.avatarPreset=name;return true;},
    setState(s){state=s},
    setLevel(v){level=Number.isFinite(v)?Math.max(0,v):0},
    dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frameId);
      observer.disconnect();canvas.removeEventListener('pointermove',move);
      canvas.removeEventListener('pointerleave',leave);
      texture.dispose();material.dispose();geometry.dispose();renderer.dispose();}
  };
}
