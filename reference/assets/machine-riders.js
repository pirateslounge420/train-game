// machine-riders.js — the gangs' riders on machine horses, code-built per DESIGN.md §P, for §V's cyborg frontier.
// One rig, many skins. Same part tree, pivots, masses and hit zones as the reference build's HORSE_RIG / RIDER_RIG (§O),
// so hits, detachment and the gore table port unchanged; a skin only changes the pieces' materials, the poncho pattern and the bow.
//
// Skins (from Mike's concept frames, reference/assets/*-concept.jpg):
//   'goldLightning'  — brass horse, green energy, green poncho with yellow bolts, brown hat, compound bow   (§E's green + yellow lightning gang)
//   'violetChevron'  — black horse, violet energy, purple-and-black chevron poncho, black hat, recurve bow
//
// Use (browser):  <script src="machine-riders.js"><\/script>
//                 const r=MachineRiders.build(THREE,{skin:'goldLightning'}); scene.add(r.root);
//                 each frame: r.animate(phase, speedMetresPerSecond, dt, time)   (phase advances by dt*speed/2.4, as in the game)
// Use (node):     const MR=require('./machine-riders.js').MachineRiders
//
// Piece grammar, in the part's own space (y up, -z forward; the rider sits facing -z):
//   ['plate', w,h,d, x,y,z, mat, chamfer]  (a chamfered box)    ['riv', x,y,z] (a rivet)    ['spr', size, x,y,z] (a bloom of energy light)
//   ['box', w,h,d, x,y,z, mat]    ['cyl', rTop,rBot,h, x,y,z, mat, axis('x'|'y'|'z'), segments]    ['sph', r, x,y,z, mat]    ['torus', R,tube, x,y,z, mat, arc]
(function(root){
'use strict';
const PI=Math.PI;

const SKINS={
  goldLightning:{ name:'Gold Lightning', plate:0xc9a227, plate2:0x8a6a1c, under:0x1a1a1f, chrome:0x9a8a5a, accent:0x46ff5e, eye:0xb0ffb8,
    hat:0x6b3f1e, band:'poncho', bandana:0x2f9a4a, coat:0x3a2a1c, glove:0x7a4a22, boot:0x15120f, quiver:0x4a2e18, mane:0x151515,
    poncho:{pattern:'lightning',base:'#2f8f3a',mark:'#f0d030'}, bow:'compound', bowColor:0xc9a227 },
  violetChevron:{ name:'Violet Chevron', plate:0x2a2c3a, plate2:0x3b3e52, under:0x13141b, chrome:0x8d93a4, accent:0xa877ff, eye:0xc9a6ff,
    hat:0x101117, band:0x5a2ad0, bandana:0x7b55f0, coat:0x1a1622, glove:0x101117, boot:0x14110f, quiver:0x101117, mane:0x101117,
    poncho:{pattern:'chevron',base:'#1c1030',mark:'#8a5cf0'}, bow:'recurve', bowColor:0x6f33e8 },
};

// ---- materials: brass and iron with a painted grain, cloth with a weave, energy that glows ----
function makeMaterials(THREE,skin){
  const A=new THREE.Color(skin.accent), Ad=A.clone().multiplyScalar(0.36);
  const grain=grainTexture(THREE,'metal'), weave=grainTexture(THREE,'cloth'), leather=grainTexture(THREE,'leather');
  const metal=(c,shine,spec)=>new THREE.MeshPhongMaterial({color:c,map:grain,shininess:shine,specular:spec});
  const cloth=(c,map)=>new THREE.MeshLambertMaterial({color:c,map:map||weave});
  const M={};
  M.plate=metal(skin.plate,55,0x66573a); M.plate2=metal(skin.plate2,40,0x4a4030); M.under=metal(skin.under,18,0x222228);
  M.chrome=new THREE.MeshPhongMaterial({color:skin.chrome,shininess:120,specular:0xd0d0d8});
  M.hat=cloth(skin.hat,leather); M.bandana=cloth(skin.bandana); M.coat=cloth(skin.coat); M.glove=cloth(skin.glove,leather); M.boot=cloth(skin.boot,leather); M.quiver=cloth(skin.quiver,leather);
  M.strap=cloth(0x3a2616,leather); M.mane=new THREE.MeshLambertMaterial({color:skin.mane});
  M.glow=new THREE.MeshLambertMaterial({color:Ad.getHex(),emissive:A.getHex(),emissiveIntensity:0.9});   // energy: veins, bands, hubs, bow marks
  M.eye=new THREE.MeshBasicMaterial({color:skin.eye});                  // horse eye, goggle lenses, forehead lens: unlit, always bright
  M.bow=skin.bow==='compound'?metal(skin.bowColor,70,0x77653a):new THREE.MeshLambertMaterial({color:skin.bowColor,emissive:Ad.getHex()});
  M.shaft=cloth(0xcdbf9a); M.fletch=cloth(parseInt(skin.poncho.mark.slice(1),16)); M.string=new THREE.MeshBasicMaterial({color:0xe8e2cf});
  M.void=new THREE.MeshLambertMaterial({color:0x07060c});
  M.poncho=cloth(0xffffff,ponchoTexture(THREE,skin.poncho,2));
  M.band=skin.band==='poncho'?cloth(0xffffff,ponchoTexture(THREE,skin.poncho,6)):cloth(skin.band);
  M.spr=new THREE.SpriteMaterial({map:glowSprite(THREE),color:A.getHex(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.6});
  M._accent=A;
  // with an sRGB-output renderer (the viewer), hex colours must be taken as sRGB, or everything washes out
  if(skin._srgb){ for(const k in M){ const m=M[k]; if(m&&m.color&&m.color.convertSRGBToLinear) m.color.convertSRGBToLinear(); if(m&&m.emissive&&m.emissive.convertSRGBToLinear) m.emissive.convertSRGBToLinear(); if(m&&m.specular&&m.specular.convertSRGBToLinear) m.specular.convertSRGBToLinear(); } }
  return M;
}
// a grey grain, tinted by each material's colour: brushed metal with panel scratches, a cloth weave, a leather pebble
const _texCache={};
function grainTexture(THREE,kind){
  if(_texCache[kind]) return _texCache[kind];
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  g.fillStyle='#d6d6d6'; g.fillRect(0,0,128,128);
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  if(kind==='metal'){ for(let i=0;i<900;i++){ const v=170+Math.floor(rnd()*70); g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(rnd()*128,rnd()*128,1+rnd()*14,1); }
    g.fillStyle='rgba(60,50,40,0.35)'; for(let i=0;i<10;i++){ g.fillRect(rnd()*128,rnd()*128,rnd()*40,1); }
    g.fillStyle='rgba(255,250,230,0.25)'; for(let i=0;i<14;i++){ g.fillRect(rnd()*128,rnd()*128,rnd()*20,1); } }
  else if(kind==='cloth'){ for(let y=0;y<128;y+=2) for(let x=0;x<128;x+=2){ const v=200+Math.floor(rnd()*40)-((x+y)%4?0:18); g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(x,y,2,2); } }
  else { for(let i=0;i<1400;i++){ const v=150+Math.floor(rnd()*80); g.fillStyle='rgb('+v+','+v+','+v+')'; g.fillRect(rnd()*128,rnd()*128,2+rnd()*3,2+rnd()*3); } }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2); t.anisotropy=4; t.minFilter=THREE.LinearMipmapLinearFilter;
  return _texCache[kind]=t;
}
// a soft radial disc for the light that blooms off eyes, lenses and hubs
function glowSprite(THREE){
  if(_texCache.spr) return _texCache.spr;
  const c=document.createElement('canvas'); c.width=c.height=64; const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.25,'rgba(255,255,255,0.55)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr; g.fillRect(0,0,64,64);
  return _texCache.spr=new THREE.CanvasTexture(c);
}
// the poncho cloth, drawn once on a canvas: chevrons or lightning bolts, with a weave over it
function ponchoTexture(THREE,p,repeat){
  const c=document.createElement('canvas'); c.width=128; c.height=128; const g=c.getContext('2d');
  g.fillStyle=p.base; g.fillRect(0,0,128,128); g.fillStyle=p.mark;
  if(p.pattern==='chevron'){ const amp=10, step=16;
    for(let r=0;r<4;r++){ const y0=r*32+6; g.beginPath(); g.moveTo(0,y0);
      for(let x=0;x<=128;x+=step){ g.lineTo(x+step/2,y0+amp); g.lineTo(x+step,y0); }
      g.lineTo(128,y0+10); for(let x=128;x>=0;x-=step){ g.lineTo(x-step/2,y0+amp+10); g.lineTo(x-step,y0+10); }
      g.closePath(); g.fill(); }
  } else { // bolts: a zigzag ribbon, four columns, staggered
    for(let col=0;col<4;col++){ const x0=col*32+8+(col%2)*6, y0=(col%2)*16;
      const pts=[[0,0],[10,0],[4,18],[12,18],[-2,44],[2,26],[-6,26]];
      for(const yy of [y0-64,y0,y0+64]){ g.beginPath(); pts.forEach(([x,y],i)=>i?g.lineTo(x0+x,yy+y):g.moveTo(x0+x,yy+y)); g.closePath(); g.fill(); } }
  }
  let seed=3; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for(let y=0;y<128;y+=2) for(let x=0;x<128;x+=2){ if((x+y)%4===0||rnd()<0.08){ g.fillStyle='rgba(0,0,0,'+(0.06+rnd()*0.08)+')'; g.fillRect(x,y,2,2); } }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(repeat,repeat);
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.anisotropy=4; if(THREE.sRGBEncoding) t.encoding=THREE.sRGBEncoding;
  return t;
}
// a plate is a chamfered box: the edges catch the light. Extruded along its thinnest axis so every long edge is bevelled.
const _geoCache={};
function plateGeo(THREE,w,h,d,c){
  const key=[w,h,d,c].join(','); if(_geoCache[key]) return _geoCache[key];
  const mn=Math.min(w,h,d); c=Math.min(c,mn*0.4);
  let a,b,depth,rot; if(mn===d){ a=w;b=h;depth=d;rot=null; } else if(mn===w){ a=d;b=h;depth=w;rot='y'; } else { a=w;b=d;depth=h;rot='x'; }
  const sh=new THREE.Shape(); const ax=a/2-c, by=b/2-c; sh.moveTo(-ax,-by); sh.lineTo(ax,-by); sh.lineTo(ax,by); sh.lineTo(-ax,by); sh.lineTo(-ax,-by);
  const g=new THREE.ExtrudeGeometry(sh,{depth:depth-2*c,bevelEnabled:true,bevelThickness:c,bevelSize:c,bevelSegments:2,steps:1,curveSegments:1});
  g.translate(0,0,-(depth-2*c)/2); if(rot==='y') g.rotateY(PI/2); else if(rot==='x') g.rotateX(PI/2);
  g.computeVertexNormals();
  return _geoCache[key]=g;
}

// ---- the horse: a machine. Pivots, masses, hit zones as HORSE_RIG. ----
const HORSE=[
 {n:'barrel',p:null,at:[0,0,0],rot:[0,0,0],mass:160,c:[0,0,0],r:0.5,pri:13,hp:3, hit:[[0.5,0.7,1.1,0,0,0.05]],
  pieces:[['box',0.5,0.7,1.1,0,0,0.05,'under'],['plate',0.56,0.56,0.92,0,0.03,0.05,'plate',0.06],['plate',0.44,0.06,0.9,0,0.36,0.05,'plate2'],['box',0.52,0.12,0.3,0,-0.28,0.05,'under'],...rivets(0,0.5,0.86,0.28,0.03,0.05,'x'),...rivets(0,0.5,0.86,-0.28,0.03,0.05,'x'),['box',0.54,0.05,0.03,0,-0.06,-0.5,'strap'],['box',0.56,0.03,0.07,0,-0.12,0.12,'strap'],['box',0.3,0.06,0.5,0,0.4,0.05,'strap'],['box',0.02,0.3,0.06,-0.285,0.2,0.1,'strap'],['box',0.02,0.3,0.06,0.285,0.2,0.1,'strap'],['torus',0.045,0.01,-0.285,0.04,0.1,'chrome'],['torus',0.045,0.01,0.285,0.04,0.1,'chrome'],
          ['box',0.012,0.03,0.7,-0.272,0.1,0.05,'glow'],['box',0.012,0.03,0.7,0.272,0.1,0.05,'glow'],
          ['box',0.012,0.34,0.03,-0.272,-0.06,-0.25,'glow'],['box',0.012,0.34,0.03,0.272,-0.06,-0.25,'glow'],
          ['box',0.012,0.22,0.03,-0.272,-0.12,0.32,'glow'],['box',0.012,0.22,0.03,0.272,-0.12,0.32,'glow'],
          ['box',0.3,0.03,0.012,0,-0.2,-0.5,'glow'],['box',0.03,0.03,0.03,-0.26,0.22,-0.3,'chrome'],['box',0.03,0.03,0.03,0.26,0.22,-0.3,'chrome'],['box',0.03,0.03,0.03,-0.26,0.22,0.4,'chrome'],['box',0.03,0.03,0.03,0.26,0.22,0.4,'chrome']]},
 {n:'croup',p:'barrel',at:[0,0.02,0.6],rot:[0,0,0],mass:70,c:[0,0,0.3],r:0.42,pri:12,hp:2, hit:[[0.46,0.6,0.6,0,0,0.3]],
  pieces:(function(){ const p=[['plate',0.46,0.6,0.6,0,0,0.3,'plate',0.07],['plate',0.42,0.08,0.44,0,0.2,0.42,'plate',0.03,{rot:[0.55,0,0]}],['plate',0.4,0.06,0.34,0,-0.1,0.6,'plate2',0.02,{rot:[-0.5,0,0]}],['plate',0.4,0.05,0.5,0,0.3,0.3,'plate2'],['box',0.012,0.03,0.4,-0.233,0.18,0.3,'glow'],['box',0.012,0.03,0.4,0.233,0.18,0.3,'glow']];
    for(const s of [-1,1]){ p.push(['cyl',0.16,0.16,0.06,s*0.25,0,0.3,'plate2','x',10]); p.push(['cyl',0.05,0.05,0.09,s*0.25,0,0.3,'glow','x',10]); p.push(['spr',0.3,s*0.3,0,0.3]);
      for(let i=0;i<8;i++){ const a=i/8*PI*2; p.push(['plate',0.05,0.05,0.05,s*0.25,Math.cos(a)*0.17,0.3+Math.sin(a)*0.17,'plate2']); } } // the hip gear's teeth
    return p; })()},
 {n:'tail',p:'croup',at:[0,0.22,0.6],rot:[-0.5,0,0],mass:3,c:[0,0,0.3],r:0.14,pri:14,hp:1, hit:[[0.1,0.12,0.6,0,0,0.3]],
  pieces:[['box',0.06,0.07,0.6,0,0,0.3,'mane'],['box',0.035,0.05,0.5,-0.045,-0.03,0.36,'mane'],['box',0.035,0.05,0.5,0.045,-0.03,0.36,'mane'],['box',0.03,0.04,0.4,-0.02,-0.07,0.48,'mane'],['box',0.03,0.04,0.4,0.02,-0.07,0.48,'mane'],['box',0.025,0.035,0.3,0,-0.1,0.58,'mane']]},
 {n:'neck1',p:'barrel',at:[0,0.28,-0.5],rot:[0.55,0,0],mass:26,c:[0,0.1,-0.2],r:0.24,pri:5,hp:1, hit:[[0.3,0.36,0.42,0,0.1,-0.2]],
  pieces:[['box',0.3,0.36,0.42,0,0.1,-0.2,'under'],['plate',0.32,0.22,0.34,0,0.14,-0.22,'plate',0.04],['plate',0.03,0.3,0.36,-0.16,0.02,-0.2,'plate2',0.01],['plate',0.03,0.3,0.36,0.16,0.02,-0.2,'plate2',0.01],['box',0.012,0.26,0.03,-0.162,0.1,-0.2,'glow'],['box',0.012,0.26,0.03,0.162,0.1,-0.2,'glow'],
          ['box',0.035,0.14,0.08,0,0.3,-0.06,'mane'],['box',0.035,0.16,0.08,0,0.32,-0.16,'mane'],['box',0.035,0.16,0.08,0,0.33,-0.26,'mane'],['box',0.035,0.14,0.08,0,0.31,-0.36,'mane'],['box',0.035,0.12,0.08,0,0.27,0.04,'mane']]},
 {n:'neck2',p:'neck1',at:[0,0.22,-0.4],rot:[0.25,0,0],mass:18,c:[0,0.08,-0.2],r:0.22,pri:4,hp:1, hit:[[0.27,0.32,0.4,0,0.08,-0.2]],
  pieces:[['box',0.27,0.32,0.4,0,0.08,-0.2,'under'],['plate',0.29,0.2,0.3,0,0.12,-0.2,'plate',0.04],['plate',0.03,0.26,0.32,-0.145,0.02,-0.2,'plate2',0.01],['plate',0.03,0.26,0.32,0.145,0.02,-0.2,'plate2',0.01],['box',0.012,0.22,0.03,-0.147,0.08,-0.2,'glow'],['box',0.012,0.22,0.03,0.147,0.08,-0.2,'glow'],
          ['box',0.035,0.15,0.08,0,0.27,-0.08,'mane'],['box',0.035,0.15,0.08,0,0.28,-0.18,'mane'],['box',0.035,0.14,0.08,0,0.27,-0.28,'mane'],['box',0.035,0.12,0.08,0,0.24,-0.36,'mane']]},
 {n:'skull',p:'neck2',at:[0,0.18,-0.38],rot:[-0.85,0,0],mass:12,c:[0,0,-0.22],r:0.28,pri:3,hp:1,
  hit:[[0.25,0.28,0.5,0,-0.02,-0.22],[0.06,0.14,0.06,-0.08,0.18,-0.1],[0.06,0.14,0.06,0.08,0.18,-0.1]],
  pieces:[['plate',0.25,0.28,0.5,0,-0.02,-0.22,'plate',0.04],['box',0.2,0.18,0.2,0,-0.08,-0.5,'under'],['plate',0.27,0.04,0.44,0,0.1,-0.2,'plate2'],
          ['plate',0.06,0.14,0.06,-0.08,0.18,-0.1,'plate2'],['plate',0.06,0.14,0.06,0.08,0.18,-0.1,'plate2'],
          ['cyl',0.06,0.06,0.03,0,0.12,-0.26,'plate2','y',12],['cyl',0.04,0.04,0.045,0,0.12,-0.26,'eye','y',12], // the forehead lens
          ['sph',0.045,-0.125,0.03,-0.3,'eye'],['sph',0.045,0.125,0.03,-0.3,'eye'],['spr',0.22,-0.14,0.03,-0.31],['spr',0.22,0.14,0.03,-0.31],['spr',0.2,0,0.12,-0.29],['box',0.27,0.03,0.03,0,0.05,-0.3,'strap'],['box',0.03,0.03,0.4,-0.13,-0.02,-0.22,'strap'],['box',0.03,0.03,0.4,0.13,-0.02,-0.22,'strap'],['riv',-0.135,0.05,-0.3],['riv',0.135,0.05,-0.3],
          ['box',0.24,0.025,0.22,0,0.0,-0.42,'under'],['box',0.012,0.03,0.3,-0.126,-0.06,-0.25,'glow'],['box',0.012,0.03,0.3,0.126,-0.06,-0.25,'glow']]},
];
for(const [L,side,par,at] of [['FL',-1,'barrel',[-0.17,-0.3,-0.42]],['FR',1,'barrel',[0.17,-0.3,-0.42]],['BL',-1,'croup',[-0.17,-0.32,0]],['BR',1,'croup',[0.17,-0.32,0]]]){
  const back=L[0]==='B', w=back?0.14:0.13, d=back?0.15:0.14;
  HORSE.push({n:'upper'+L,p:par,at,rot:[0,0,0],mass:back?20:18,c:[0,-0.22,0],r:0.17,pri:9,hp:1,leg:L, hit:[[w,0.45,d,0,-0.22,0]],
    pieces:[['plate',w,0.45,d,0,-0.22,0,'plate'],['cyl',0.1,0.1,0.17,0,0,0,'plate2','x',12],['cyl',0.04,0.04,0.19,0,0,0,'glow','x',10],['spr',0.2,side*0.1,0,0],
            ['cyl',0.022,0.022,0.3,side*0.085,-0.2,0.07,'chrome','y',8],['cyl',0.03,0.03,0.08,side*0.085,-0.06,0.07,'chrome','y',8],['box',0.012,0.3,0.02,-side*0.07,-0.22,-0.075,'glow']]});
  HORSE.push({n:'lower'+L,p:'upper'+L,at:[0,-0.44,0],rot:[0,0,0],mass:8,c:[0,-0.24,0],r:0.15,pri:8,hp:1,leg:L, hit:[[0.11,0.44,0.12,0,-0.22,0],[0.13,0.08,0.15,0,-0.46,0]],
    pieces:[['plate',0.11,0.44,0.12,0,-0.22,0,'plate'],['cyl',0.08,0.08,0.14,0,0,0,'plate2','x',12],['cyl',0.03,0.03,0.16,0,0,0,'glow','x',10],
            ['box',0.12,0.05,0.13,0,-0.3,0,'glow'],['plate',0.12,0.05,0.13,0,-0.38,0,'plate2'],['box',0.13,0.08,0.15,0,-0.46,0,'boot']]});
}

// ---- the rider: goggles, bandana, poncho with fringe, quiver, gloves. Pivots as RIDER_RIG. ----
const RIDER=[
 {n:'pelvis',p:'barrel',at:[0,0.42,0.05],rot:[0,0,0],mass:14,c:[0,0.1,0],r:0.2,pri:10,hp:1, hit:[[0.36,0.2,0.3,0,0.1,0]],
  pieces:[['box',0.36,0.2,0.3,0,0.1,0,'coat'],['box',0.37,0.05,0.31,0,0.17,0,'strap'],['box',0.05,0.06,0.02,0,0.17,-0.16,'chrome']]},
 {n:'torso',p:'pelvis',at:[0,0.2,0],rot:[0,0,0],mass:30,c:[0,0.3,0],r:0.4,pri:11,hp:2, hit:[[0.6,0.6,0.44,0,0.3,0]],
  pieces:(function(){ const p=[['box',0.6,0.6,0.44,0,0.3,0,'poncho'],['box',0.66,0.16,0.5,0,0.04,0,'poncho'],['sph',0.07,-0.3,0.5,0,'poncho'],['sph',0.07,0.3,0.5,0,'poncho']];
    for(let x=-0.27;x<=0.271;x+=0.06){ p.push(['box',0.035,0.1,0.015,x,-0.05,-0.22,'band']); p.push(['box',0.035,0.1,0.015,x,-0.05,0.22,'band']); }
    for(let z=-0.2;z<=0.201;z+=0.08){ p.push(['box',0.015,0.1,0.035,-0.3,-0.05,z,'band']); p.push(['box',0.015,0.1,0.035,0.3,-0.05,z,'band']); }
    p.push(['box',0.08,0.62,0.03,0.12,0.3,-0.225,'glove']); // bandolier strap across the chest
    p.push(['cyl',0.055,0.055,0.5,0.17,0.42,0.2,'quiver','y',8]); // quiver on the back, slung right
    for(let i=0;i<4;i++){ const x=0.14+i*0.025, z=0.17+(i%2)*0.04; p.push(['cyl',0.007,0.007,0.34,x,0.78,z,'shaft','y',4]); p.push(['box',0.02,0.07,0.03,x,0.9,z,'fletch']); }
    return p; })()},
 {n:'neck',p:'torso',at:[0,0.6,0],rot:[0,0,0],mass:2,c:[0,0.06,0],r:0.12,pri:2,hp:1, hit:[[0.12,0.12,0.12,0,0.05,0]],
  pieces:[['box',0.12,0.12,0.12,0,0.05,0,'bandana']]},
 {n:'head',p:'neck',at:[0,0.12,0],rot:[0,0,0],mass:5,c:[0,0.1,0],r:0.16,pri:1,hp:1, hit:[[0.24,0.26,0.24,0,0.1,0],[0.28,0.15,0.28,0,0.04,0]],
  pieces:[['box',0.24,0.26,0.24,0,0.1,0,'void'],['box',0.28,0.15,0.28,0,0.04,0,'bandana'],['box',0.1,0.18,0.06,0,-0.05,0.14,'bandana'],
          ['box',0.26,0.05,0.26,0,0.15,0,'glove'],
          ['cyl',0.06,0.06,0.035,-0.065,0.11,-0.125,'plate2','z',12],['cyl',0.06,0.06,0.035,0.065,0.11,-0.125,'plate2','z',12],['box',0.04,0.03,0.03,0,0.11,-0.13,'plate2'],
          ['cyl',0.045,0.045,0.04,-0.065,0.11,-0.13,'eye','z',12],['cyl',0.045,0.045,0.04,0.065,0.11,-0.13,'eye','z',12],['spr',0.14,-0.065,0.11,-0.15],['spr',0.14,0.065,0.11,-0.15],['box',0.26,0.04,0.26,0,0.11,0,'strap'],['box',0.08,0.08,0.05,0,0.0,0.15,'bandana']]},
 {n:'hat',p:'head',at:[0,0.22,0],rot:[-0.3,0,0],mass:0.5,c:[0,0.12,0],r:0.14,pri:0,hp:1, hit:[[0.4,0.28,0.4,0,0.18,0]],
  pieces:[['cyl',0.34,0.34,0.035,0,0,0,'hat','y',16],['cyl',0.19,0.225,0.27,0,0.15,0,'hat','y',14],['cyl',0.232,0.232,0.055,0,0.05,0,'band','y',14],['box',0.07,0.03,0.18,0,0.29,0,'void'],['box',0.08,0.03,0.2,-0.3,0.025,0,'hat',{rot:[0,0,0.35]}],['box',0.08,0.03,0.2,0.3,0.025,0,'hat',{rot:[0,0,-0.35]}]]},
 {n:'upperArmL',p:'torso',at:[-0.3,0.5,0],rot:[-1.3,0,0.3],mass:4,c:[0,-0.15,0],r:0.12,pri:6,hp:1,arm:true, hit:[[0.1,0.3,0.1,0,-0.15,0]],
  pieces:[['box',0.1,0.3,0.1,0,-0.15,0,'poncho']]},
 {n:'lowerArmL',p:'upperArmL',at:[0,-0.3,0],rot:[0.2,0,0],mass:3,c:[0,-0.15,0],r:0.11,pri:6,hp:1,arm:true,bow:true, hit:[[0.09,0.3,0.09,0,-0.15,0]],
  pieces:[['sph',0.058,0,0,0,'coat'],['box',0.09,0.3,0.09,0,-0.15,0,'coat'],['box',0.1,0.08,0.1,0,-0.3,0,'glove'],['box',0.105,0.03,0.105,0,-0.25,0,'glow'],['box',0.03,0.06,0.025,-0.03,-0.36,-0.03,'glove'],['box',0.03,0.06,0.025,0.0,-0.36,-0.045,'glove'],['box',0.03,0.06,0.025,0.03,-0.36,-0.03,'glove']]},
 {n:'upperArmR',p:'torso',at:[0.3,0.5,0],rot:[-1.0,0,-0.7],mass:4,c:[0,-0.15,0],r:0.12,pri:6,hp:1,arm:true, hit:[[0.1,0.3,0.1,0,-0.15,0]],
  pieces:[['box',0.1,0.3,0.1,0,-0.15,0,'poncho']]},
 {n:'lowerArmR',p:'upperArmR',at:[0,-0.3,0],rot:[-1.2,0,0],mass:3,c:[0,-0.15,0],r:0.11,pri:6,hp:1,arm:true, hit:[[0.09,0.3,0.09,0,-0.15,0]],
  pieces:[['sph',0.058,0,0,0,'coat'],['box',0.09,0.3,0.09,0,-0.15,0,'coat'],['box',0.1,0.08,0.1,0,-0.3,0,'glove'],['box',0.105,0.03,0.105,0,-0.25,0,'glow']]},
 {n:'upperLegL',p:'pelvis',at:[-0.18,0,0],rot:[-1.2,0,0.3],mass:10,c:[0,-0.2,0],r:0.14,pri:7,hp:1,rleg:true, hit:[[0.13,0.4,0.13,0,-0.2,0]],
  pieces:[['sph',0.085,0,0,0,'coat'],['box',0.13,0.4,0.13,0,-0.2,0,'coat']]},
 {n:'lowerLegL',p:'upperLegL',at:[0,-0.4,0],rot:[1.5,0,0],mass:5,c:[0,-0.2,0],r:0.12,pri:7,hp:1,rleg:true, hit:[[0.11,0.4,0.11,0,-0.2,0],[0.12,0.1,0.2,0,-0.42,-0.03]],
  pieces:[['sph',0.072,0,0,0,'coat'],['box',0.11,0.4,0.11,0,-0.2,0,'coat'],['box',0.115,0.05,0.115,0,-0.3,0,'glow'],['box',0.12,0.1,0.2,0,-0.42,-0.03,'boot'],['cyl',0.025,0.025,0.02,0,-0.42,0.08,'chrome','z',6]]},
 {n:'upperLegR',p:'pelvis',at:[0.18,0,0],rot:[-1.2,0,-0.3],mass:10,c:[0,-0.2,0],r:0.14,pri:7,hp:1,rleg:true, hit:[[0.13,0.4,0.13,0,-0.2,0]],
  pieces:[['sph',0.085,0,0,0,'coat'],['box',0.13,0.4,0.13,0,-0.2,0,'coat']]},
 {n:'lowerLegR',p:'upperLegR',at:[0,-0.4,0],rot:[1.5,0,0],mass:5,c:[0,-0.2,0],r:0.12,pri:7,hp:1,rleg:true, hit:[[0.11,0.4,0.11,0,-0.2,0],[0.12,0.1,0.2,0,-0.42,-0.03]],
  pieces:[['sph',0.072,0,0,0,'coat'],['box',0.11,0.4,0.11,0,-0.2,0,'coat'],['box',0.115,0.05,0.115,0,-0.3,0,'glow'],['box',0.12,0.1,0.2,0,-0.42,-0.03,'boot'],['cyl',0.025,0.025,0.02,0,-0.42,0.08,'chrome','z',6]]},
];
const GALLOP={FL:0.5,FR:0.62,BL:0.0,BR:0.12};

function addPiece(THREE,M,g,pc){
  let geo, m, matName=pc[7]; const extra=typeof pc[pc.length-1]==='object'&&!Array.isArray(pc[pc.length-1])?pc[pc.length-1]:null;
  if(pc[0]==='box'){ geo=new THREE.BoxGeometry(pc[1],pc[2],pc[3]); m=new THREE.Mesh(geo,M[pc[7]]); m.position.set(pc[4],pc[5],pc[6]); }
  else if(pc[0]==='plate'){ geo=plateGeo(THREE,pc[1],pc[2],pc[3],pc[8]||0.014); m=new THREE.Mesh(geo,M[pc[7]]); m.position.set(pc[4],pc[5],pc[6]); }
  else if(pc[0]==='cyl'){ geo=new THREE.CylinderGeometry(pc[1],pc[2],pc[3],pc[9]||12); m=new THREE.Mesh(geo,M[pc[7]]); m.position.set(pc[4],pc[5],pc[6]);
    if(pc[8]==='x') m.rotation.z=PI/2; else if(pc[8]==='z') m.rotation.x=PI/2; }
  else if(pc[0]==='sph'){ geo=new THREE.SphereGeometry(pc[1],10,8); m=new THREE.Mesh(geo,M[pc[5]]); m.position.set(pc[2],pc[3],pc[4]); matName=pc[5]; }
  else if(pc[0]==='riv'){ geo=_geoCache.riv||(_geoCache.riv=new THREE.SphereGeometry(0.013,6,5)); m=new THREE.Mesh(geo,M.chrome); m.position.set(pc[1],pc[2],pc[3]); matName='chrome'; }
  else if(pc[0]==='spr'){ m=new THREE.Sprite(M.spr); m.scale.set(pc[1],pc[1],1); m.position.set(pc[2],pc[3],pc[4]); m.userData.glow=true; g.add(m); return m; }
  else if(pc[0]==='torus'){ geo=new THREE.TorusGeometry(pc[1],pc[2],6,16,pc[7]||PI*2); m=new THREE.Mesh(geo,M[pc[6]]); m.position.set(pc[3],pc[4],pc[5]); matName=pc[6]; }
  if(!M[matName]) throw new Error('no material '+matName);
  m.castShadow=true; m.receiveShadow=matName!=='glow'&&matName!=='eye';
  if(extra&&extra.rot){ m.rotation.x+=extra.rot[0]; m.rotation.y+=extra.rot[1]; m.rotation.z+=extra.rot[2]; }
  g.add(m); return m;
}
// rivets at the four corners of a plate's outward face (x side when it is thin in x, else the +y / -z face given)
function rivets(w,h,d,x,y,z,face){ const out=[]; const e=0.02;
  if(face==='x'){ const sx=x>0?1:-1; for(const [yy,zz] of [[h/2-e*2,d/2-e*2],[h/2-e*2,-d/2+e*2],[-h/2+e*2,d/2-e*2],[-h/2+e*2,-d/2+e*2]]) out.push(['riv',x+sx*(w/2),y+yy,z+zz]); }
  else if(face==='y'){ for(const [xx,zz] of [[w/2-e*2,d/2-e*2],[w/2-e*2,-d/2+e*2],[-w/2+e*2,d/2-e*2],[-w/2+e*2,-d/2+e*2]]) out.push(['riv',x+xx,y+h/2,z+zz]); }
  else { const sz=z<0?-1:1; for(const [xx,yy] of [[w/2-e*2,h/2-e*2],[w/2-e*2,-h/2+e*2],[-w/2+e*2,h/2-e*2],[-w/2+e*2,-h/2+e*2]]) out.push(['riv',x+xx,y+yy,z+sz*(d/2)]); }
  return out; }
function buildRig(THREE,M,defs,parts){
  for(const d of defs){
    const g=new THREE.Group(); g.position.set(d.at[0],d.at[1],d.at[2]); g.rotation.set(d.rot[0],d.rot[1],d.rot[2]);
    for(const pc of d.pieces) addPiece(THREE,M,g,pc);
    parts[d.n]={def:d,g,hp:d.hp,on:true,name:d.n};
    if(d.p&&parts[d.p]) parts[d.p].g.add(g);
  }
}
// the bow in the left hand: a recurve (violet frame) or a compound with cams and cables (gold frame)
function buildBow(THREE,M,skin,bowG){
  if(skin.bow==='compound'){
    addPiece(THREE,M,bowG,['plate',0.3,0.06,0.09,0,0,-0.03,'bow',0.012]);                       // riser, along the bow's height (x)
    addPiece(THREE,M,bowG,['box',0.08,0.04,0.06,0,0,0.02,'glove']);                             // the grip
    for(const s of [-1,1]){ const limb=addPiece(THREE,M,bowG,['plate',0.34,0.02,0.05,s*0.3,0,-0.09,'bow',0.006]); limb.rotation.y=s*0.3;
      addPiece(THREE,M,bowG,['cyl',0.075,0.075,0.022,s*0.47,0,-0.14,'plate2','y',14]); addPiece(THREE,M,bowG,['cyl',0.028,0.028,0.03,s*0.47,0,-0.14,'glow','y',10]); // the cams
      addPiece(THREE,M,bowG,['spr',0.14,s*0.47,0,-0.14]); addPiece(THREE,M,bowG,['box',0.09,0.012,0.012,s*0.2,0,-0.1,'glow']); }
    const s1=addPiece(THREE,M,bowG,['cyl',0.004,0.004,0.94,0,0,0.02,'string','y',3]); s1.rotation.z=PI/2;   // the bowstring, cam to cam
    for(const y of [-0.012,0.012]){ const c=addPiece(THREE,M,bowG,['cyl',0.003,0.003,0.9,0,y,-0.1,'string','y',3]); c.rotation.z=PI/2; } // the cables
  } else {
    const bow=addPiece(THREE,M,bowG,['torus',0.42,0.025,0,0,0,'bow',PI]); bow.rotation.set(PI/2,0,0);
    addPiece(THREE,M,bowG,['box',0.08,0.05,0.07,0,0,-0.41,'glove']);
    for(const s of [-1,1]){ const z=addPiece(THREE,M,bowG,['box',0.09,0.014,0.02,s*0.3,0,-0.29,'glow']); z.rotation.y=-s*0.5; addPiece(THREE,M,bowG,['box',0.07,0.014,0.02,s*0.22,0,-0.34,'glow']); }
    const str=addPiece(THREE,M,bowG,['cyl',0.004,0.004,0.84,0,0,0,'string','y',3]); str.rotation.z=PI/2;
  }
}
// returns {root, horse, rider, parts, hat, cape, bow, animate, materials, skin}
function build(THREE,opts){
  opts=opts||{}; let skin=typeof opts.skin==='string'?SKINS[opts.skin]:(opts.skin||SKINS.goldLightning); if(opts.srgb) skin=Object.assign({_srgb:true},skin);
  const M=opts.materials||makeMaterials(THREE,skin);
  const root=new THREE.Group(); const horse=new THREE.Group(); horse.position.y=1.15; root.add(horse);
  const parts={}; buildRig(THREE,M,HORSE,parts); horse.add(parts.barrel.g);
  buildRig(THREE,M,RIDER,parts);
  const cape=new THREE.Group(); cape.position.set(0,0.58,0.2); parts.torso.g.add(cape); addPiece(THREE,M,cape,['box',0.56,0.02,0.75,0,0,0.375,'poncho']);
  const bowG=new THREE.Group(); bowG.position.set(0,-0.32,0); parts.lowerArmL.g.add(bowG); buildBow(THREE,M,skin,bowG);
  if(opts.side>0) root.scale.x=-1;
  function animate(ph,spd,dt,time){
    const P=parts, a=Math.min(1,spd/3);
    for(const L of ['FL','FR','BL','BR']){ const o=ph+GALLOP[L]*2*PI, front=L[0]==='F'; const up=P['upper'+L], lo=P['lower'+L];
      if(up.on) up.g.rotation.x=Math.sin(o)*(front?0.75:0.85)*a;
      if(lo.on){ const fold=Math.max(0,Math.sin(o+1.0))*a; lo.g.rotation.x=front?-fold*1.1:fold*0.9; } }
    horse.position.y=1.15+(0.09*Math.sin(2*ph+0.5)+0.04)*a; horse.rotation.x=0.07*Math.sin(ph+1.0)*a;
    if(P.neck1.on) P.neck1.g.rotation.x=0.55+0.08*Math.sin(ph)*a; if(P.tail.on) P.tail.g.rotation.x=1.15-0.75*a+0.25*Math.sin(ph*0.5)*a;
    cape.rotation.x=1.35-Math.min(0.95,spd*0.045)+0.12*Math.sin((time||0)*7+ph)+0.06*Math.sin((time||0)*11.3);
    const pulse=0.8+0.25*Math.sin((time||0)*5.5)+0.08*Math.sin((time||0)*17); M.glow.emissiveIntensity=pulse; M.spr.opacity=0.35+0.25*pulse;
  }
  return {root,horse,rider:parts.pelvis.g,parts,hat:parts.hat.g,cape,bow:bowG,animate,materials:M,skin};
}
root.MachineRiders={SKINS,HORSE,RIDER,GALLOP,build,makeMaterials,ponchoTexture};
})(typeof module!=='undefined'&&module.exports?module.exports:window);
