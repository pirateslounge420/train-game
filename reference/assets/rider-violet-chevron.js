// rider-violet-chevron.js — the Violet Chevron rider on a machine horse. Code-built, per DESIGN.md §P.
// Same part tree, pivots, masses and hit zones as the reference build's HORSE_RIG / RIDER_RIG (§O),
// so hits, detachment and the gore table port unchanged. Only the pieces hung on each part differ.
//
// Use (browser):  <script src="rider-violet-chevron.js"></script>  then  const r=VioletChevron.build(THREE); scene.add(r.root);
//                 each frame: r.animate(phase, speedMetresPerSecond, dt)   (phase advances by dt*speed/2.4, as in the game)
// Use (node):     const VC=require('./rider-violet-chevron.js')
//
// Piece grammar, in the part's own space (y up, -z forward for the horse; the rider sits facing -z):
//   ['box', w,h,d, x,y,z, mat]                  ['cyl', rTop,rBot,h, x,y,z, mat, axis('x'|'y'|'z'), segments]
//   ['sph', r, x,y,z, mat]                       ['torus', R, tube, x,y,z, mat, arc]
(function(root){
'use strict';
const PI=Math.PI;

// ---- palette: the concept frame, black plate and violet light ----
const COL={ black:0x101117, plate:0x1b1c25, plate2:0x272938, chrome:0x7d8292, violet:0x6f33e8, glow:0xa877ff,
            coat:0x1a1622, bandana:0x7b55f0, hatband:0x5a2ad0, boot:0x14110f, shaft:0xcdbf9a, fletch:0x8a5cf0 };

function makeMaterials(THREE){
  const L=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c},o||{}));
  const M={};
  M.black=L(COL.black); M.plate=L(COL.plate); M.plate2=L(COL.plate2); M.chrome=L(COL.chrome);
  M.violet=L(COL.violet,{emissive:0x2a0f66});
  M.glow=L(0x3a1a7a,{emissive:COL.glow,emissiveIntensity:0.9});          // lightning veins, bands, hubs
  M.eye=new THREE.MeshBasicMaterial({color:0xc9a6ff});                      // horse eye, goggle lenses: unlit, always bright
  M.coat=L(COL.coat); M.bandana=L(COL.bandana); M.hatband=L(COL.hatband); M.boot=L(COL.boot);
  M.shaft=L(COL.shaft); M.fletch=L(COL.fletch); M.string=new THREE.MeshBasicMaterial({color:0xe8e2cf});
  M.chevron=L(0xffffff,{map:chevronTexture(THREE)});                        // the poncho
  M.void=L(0x07060c);                                                       // no face under the bandana
  return M;
}
// purple-on-black zigzag, drawn once on a canvas
function chevronTexture(THREE){
  const c=document.createElement('canvas'); c.width=128; c.height=128; const g=c.getContext('2d');
  g.fillStyle='#1c1030'; g.fillRect(0,0,128,128);
  g.fillStyle='#8a5cf0';
  const rows=4, amp=10, step=16;
  for(let r=0;r<rows;r++){ const y0=r*32+6;
    g.beginPath(); g.moveTo(0,y0);
    for(let x=0;x<=128;x+=step){ g.lineTo(x+step/2,y0+amp); g.lineTo(x+step,y0); }
    g.lineTo(128,y0+10); for(let x=128;x>=0;x-=step){ g.lineTo(x-step/2,y0+amp+10); g.lineTo(x-step,y0+10); }
    g.closePath(); g.fill(); }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(2,2);
  t.magFilter=THREE.LinearFilter; t.minFilter=THREE.LinearMipmapLinearFilter; t.anisotropy=4;
  return t;
}

// ---- the horse: a machine. Pivots, masses, hit zones as HORSE_RIG. ----
// hit: the hit boxes (w,h,d,x,y,z), kept identical to the flesh horse so the gore table and tests carry over.
const HORSE=[
 {n:'barrel',p:null,at:[0,0,0],rot:[0,0,0],mass:160,c:[0,0,0],r:0.5,pri:13,hp:3, hit:[[0.5,0.7,1.1,0,0,0.05]],
  pieces:[['box',0.5,0.7,1.1,0,0,0.05,'plate'],['box',0.08,0.5,0.82,-0.25,-0.02,0.05,'plate2'],['box',0.08,0.5,0.82,0.25,-0.02,0.05,'plate2'],
          ['box',0.44,0.06,0.9,0,0.36,0.05,'plate2'],['box',0.52,0.12,0.3,0,-0.28,0.05,'black'],
          ['box',0.012,0.03,0.7,-0.293,0.1,0.05,'glow'],['box',0.012,0.03,0.7,0.293,0.1,0.05,'glow'],
          ['box',0.012,0.34,0.03,-0.293,-0.06,-0.25,'glow'],['box',0.012,0.34,0.03,0.293,-0.06,-0.25,'glow'],
          ['box',0.012,0.22,0.03,-0.293,-0.12,0.32,'glow'],['box',0.012,0.22,0.03,0.293,-0.12,0.32,'glow'],
          ['box',0.3,0.03,0.012,0,-0.2,-0.5,'glow']]},
 {n:'croup',p:'barrel',at:[0,0.02,0.6],rot:[0,0,0],mass:70,c:[0,0,0.3],r:0.42,pri:12,hp:2, hit:[[0.46,0.6,0.6,0,0,0.3]],
  pieces:[['box',0.46,0.6,0.6,0,0,0.3,'plate'],['cyl',0.17,0.17,0.06,-0.25,0.0,0.3,'plate2','x',10],['cyl',0.17,0.17,0.06,0.25,0,0.3,'plate2','x',10],
          ['cyl',0.06,0.06,0.09,-0.25,0,0.3,'glow','x',10],['cyl',0.06,0.06,0.09,0.25,0,0.3,'glow','x',10],
          ['box',0.4,0.05,0.5,0,0.3,0.3,'plate2'],['box',0.012,0.03,0.4,-0.233,0.18,0.3,'glow'],['box',0.012,0.03,0.4,0.233,0.18,0.3,'glow']]},
 {n:'tail',p:'croup',at:[0,0.22,0.6],rot:[-0.5,0,0],mass:3,c:[0,0,0.3],r:0.14,pri:14,hp:1, hit:[[0.1,0.12,0.6,0,0,0.3]],
  pieces:[['box',0.08,0.1,0.6,0,0,0.3,'black'],['box',0.05,0.06,0.5,-0.05,-0.03,0.36,'black'],['box',0.05,0.06,0.5,0.05,-0.03,0.36,'black'],['box',0.04,0.05,0.3,0,-0.08,0.5,'black']]},
 {n:'neck1',p:'barrel',at:[0,0.28,-0.5],rot:[0.55,0,0],mass:26,c:[0,0.1,-0.2],r:0.24,pri:5,hp:1, hit:[[0.3,0.36,0.42,0,0.1,-0.2]],
  pieces:[['box',0.3,0.36,0.42,0,0.1,-0.2,'plate'],['box',0.012,0.26,0.03,-0.152,0.1,-0.2,'glow'],['box',0.012,0.26,0.03,0.152,0.1,-0.2,'glow'],
          ['box',0.06,0.16,0.14,0,0.3,-0.12,'black'],['box',0.06,0.16,0.14,0,0.32,-0.26,'black'],['box',0.05,0.14,0.12,0,0.28,0.0,'black']]},
 {n:'neck2',p:'neck1',at:[0,0.22,-0.4],rot:[0.25,0,0],mass:18,c:[0,0.08,-0.2],r:0.22,pri:4,hp:1, hit:[[0.27,0.32,0.4,0,0.08,-0.2]],
  pieces:[['box',0.27,0.32,0.4,0,0.08,-0.2,'plate'],['box',0.012,0.22,0.03,-0.137,0.08,-0.2,'glow'],['box',0.012,0.22,0.03,0.137,0.08,-0.2,'glow'],
          ['box',0.06,0.16,0.14,0,0.26,-0.14,'black'],['box',0.05,0.14,0.12,0,0.26,-0.3,'black']]},
 {n:'skull',p:'neck2',at:[0,0.18,-0.38],rot:[-0.85,0,0],mass:12,c:[0,0,-0.22],r:0.28,pri:3,hp:1,
  hit:[[0.25,0.28,0.5,0,-0.02,-0.22],[0.06,0.14,0.06,-0.08,0.18,-0.1],[0.06,0.14,0.06,0.08,0.18,-0.1]],
  pieces:[['box',0.25,0.28,0.5,0,-0.02,-0.22,'plate'],['box',0.2,0.18,0.2,0,-0.08,-0.5,'black'],['box',0.27,0.04,0.44,0,0.1,-0.2,'plate2'],
          ['box',0.06,0.14,0.06,-0.08,0.18,-0.1,'plate2'],['box',0.06,0.14,0.06,0.08,0.18,-0.1,'plate2'],
          ['sph',0.045,-0.125,0.03,-0.3,'eye'],['sph',0.045,0.125,0.03,-0.3,'eye'],
          ['box',0.24,0.025,0.22,0,0.0,-0.42,'black'],['box',0.012,0.03,0.3,-0.126,-0.06,-0.25,'glow'],['box',0.012,0.03,0.3,0.126,-0.06,-0.25,'glow']]},
];
for(const [L,side,par,at] of [['FL',-1,'barrel',[-0.17,-0.3,-0.42]],['FR',1,'barrel',[0.17,-0.3,-0.42]],['BL',-1,'croup',[-0.17,-0.32,0]],['BR',1,'croup',[0.17,-0.32,0]]]){
  const back=L[0]==='B', w=back?0.14:0.13, d=back?0.15:0.14;
  HORSE.push({n:'upper'+L,p:par,at,rot:[0,0,0],mass:back?20:18,c:[0,-0.22,0],r:0.17,pri:9,hp:1,leg:L, hit:[[w,0.45,d,0,-0.22,0]],
    pieces:[['box',w,0.45,d,0,-0.22,0,'plate'],['cyl',0.1,0.1,0.17,0,0,0,'plate2','x',12],['cyl',0.04,0.04,0.19,0,0,0,'glow','x',10],
            ['cyl',0.022,0.022,0.3,side*0.085,-0.2,0.07,'chrome','y',8],['box',0.012,0.3,0.02,-side*0.07,-0.22,-0.075,'glow']]});
  HORSE.push({n:'lower'+L,p:'upper'+L,at:[0,-0.44,0],rot:[0,0,0],mass:8,c:[0,-0.24,0],r:0.15,pri:8,hp:1,leg:L, hit:[[0.11,0.44,0.12,0,-0.22,0],[0.13,0.08,0.15,0,-0.46,0]],
    pieces:[['box',0.11,0.44,0.12,0,-0.22,0,'plate'],['cyl',0.08,0.08,0.14,0,0,0,'plate2','x',12],['cyl',0.03,0.03,0.16,0,0,0,'glow','x',10],
            ['box',0.12,0.05,0.13,0,-0.3,0,'glow'],['box',0.12,0.05,0.13,0,-0.38,0,'violet'],['box',0.13,0.08,0.15,0,-0.46,0,'boot']]});
}

// ---- the rider: goggles, bandana, chevron poncho, quiver, violet bow. Pivots as RIDER_RIG. ----
const RIDER=[
 {n:'pelvis',p:'barrel',at:[0,0.42,0.05],rot:[0,0,0],mass:14,c:[0,0.1,0],r:0.2,pri:10,hp:1, hit:[[0.36,0.2,0.3,0,0.1,0]],
  pieces:[['box',0.36,0.2,0.3,0,0.1,0,'coat'],['box',0.37,0.05,0.31,0,0.17,0,'hatband']]},
 {n:'torso',p:'pelvis',at:[0,0.2,0],rot:[0,0,0],mass:30,c:[0,0.3,0],r:0.4,pri:11,hp:2, hit:[[0.6,0.6,0.44,0,0.3,0]],
  pieces:(function(){ const p=[['box',0.6,0.6,0.44,0,0.3,0,'chevron']];
    for(let x=-0.27;x<=0.271;x+=0.06){ p.push(['box',0.035,0.1,0.015,x,-0.05,-0.22,'violet']); p.push(['box',0.035,0.1,0.015,x,-0.05,0.22,'violet']); }
    for(let z=-0.2;z<=0.201;z+=0.08){ p.push(['box',0.015,0.1,0.035,-0.3,-0.05,z,'violet']); p.push(['box',0.015,0.1,0.035,0.3,-0.05,z,'violet']); }
    p.push(['cyl',0.055,0.055,0.5,0.17,0.42,0.2,'black','y',8]); // quiver on the back, slung right
    for(let i=0;i<4;i++){ const x=0.14+i*0.025, z=0.17+(i%2)*0.04; p.push(['cyl',0.007,0.007,0.34,x,0.78,z,'shaft','y',4]); p.push(['box',0.02,0.07,0.03,x,0.9,z,'fletch']); }
    return p; })()},
 {n:'neck',p:'torso',at:[0,0.6,0],rot:[0,0,0],mass:2,c:[0,0.06,0],r:0.12,pri:2,hp:1, hit:[[0.12,0.12,0.12,0,0.05,0]],
  pieces:[['box',0.12,0.12,0.12,0,0.05,0,'bandana']]},
 {n:'head',p:'neck',at:[0,0.12,0],rot:[0,0,0],mass:5,c:[0,0.1,0],r:0.16,pri:1,hp:1, hit:[[0.24,0.26,0.24,0,0.1,0],[0.28,0.15,0.28,0,0.04,0]],
  pieces:[['box',0.24,0.26,0.24,0,0.1,0,'void'],['box',0.28,0.15,0.28,0,0.04,0,'bandana'],['box',0.1,0.18,0.06,0,-0.05,0.14,'bandana'],
          ['box',0.26,0.05,0.26,0,0.15,0,'black'],
          ['cyl',0.06,0.06,0.035,-0.065,0.15,-0.125,'plate2','z',12],['cyl',0.06,0.06,0.035,0.065,0.15,-0.125,'plate2','z',12],
          ['cyl',0.045,0.045,0.04,-0.065,0.15,-0.13,'eye','z',12],['cyl',0.045,0.045,0.04,0.065,0.15,-0.13,'eye','z',12]]},
 {n:'hat',p:'head',at:[0,0.22,0],rot:[-0.3,0,0],mass:0.5,c:[0,0.12,0],r:0.14,pri:0,hp:1, hit:[[0.4,0.28,0.4,0,0.18,0]],
  pieces:[['cyl',0.46,0.46,0.04,0,0,0,'black','y',14],['cyl',0.2,0.24,0.3,0,0.17,0,'black','y',12],['cyl',0.245,0.245,0.06,0,0.06,0,'hatband','y',12]]},
 {n:'upperArmL',p:'torso',at:[-0.3,0.5,0],rot:[-1.3,0,0.3],mass:4,c:[0,-0.15,0],r:0.12,pri:6,hp:1,arm:true, hit:[[0.1,0.3,0.1,0,-0.15,0]],
  pieces:[['box',0.1,0.3,0.1,0,-0.15,0,'chevron']]},
 {n:'lowerArmL',p:'upperArmL',at:[0,-0.3,0],rot:[0.2,0,0],mass:3,c:[0,-0.15,0],r:0.11,pri:6,hp:1,arm:true,bow:true, hit:[[0.09,0.3,0.09,0,-0.15,0]],
  pieces:[['box',0.09,0.3,0.09,0,-0.15,0,'coat'],['box',0.1,0.08,0.1,0,-0.3,0,'black'],['box',0.105,0.03,0.105,0,-0.25,0,'glow']]},
 {n:'upperArmR',p:'torso',at:[0.3,0.5,0],rot:[-1.0,0,-0.7],mass:4,c:[0,-0.15,0],r:0.12,pri:6,hp:1,arm:true, hit:[[0.1,0.3,0.1,0,-0.15,0]],
  pieces:[['box',0.1,0.3,0.1,0,-0.15,0,'chevron']]},
 {n:'lowerArmR',p:'upperArmR',at:[0,-0.3,0],rot:[-1.2,0,0],mass:3,c:[0,-0.15,0],r:0.11,pri:6,hp:1,arm:true, hit:[[0.09,0.3,0.09,0,-0.15,0]],
  pieces:[['box',0.09,0.3,0.09,0,-0.15,0,'coat'],['box',0.1,0.08,0.1,0,-0.3,0,'black'],['box',0.105,0.03,0.105,0,-0.25,0,'glow']]},
 {n:'upperLegL',p:'pelvis',at:[-0.18,0,0],rot:[-1.2,0,0.3],mass:10,c:[0,-0.2,0],r:0.14,pri:7,hp:1,rleg:true, hit:[[0.13,0.4,0.13,0,-0.2,0]],
  pieces:[['box',0.13,0.4,0.13,0,-0.2,0,'coat']]},
 {n:'lowerLegL',p:'upperLegL',at:[0,-0.4,0],rot:[1.5,0,0],mass:5,c:[0,-0.2,0],r:0.12,pri:7,hp:1,rleg:true, hit:[[0.11,0.4,0.11,0,-0.2,0],[0.12,0.1,0.2,0,-0.42,-0.03]],
  pieces:[['box',0.11,0.4,0.11,0,-0.2,0,'coat'],['box',0.115,0.05,0.115,0,-0.3,0,'glow'],['box',0.12,0.1,0.2,0,-0.42,-0.03,'boot']]},
 {n:'upperLegR',p:'pelvis',at:[0.18,0,0],rot:[-1.2,0,-0.3],mass:10,c:[0,-0.2,0],r:0.14,pri:7,hp:1,rleg:true, hit:[[0.13,0.4,0.13,0,-0.2,0]],
  pieces:[['box',0.13,0.4,0.13,0,-0.2,0,'coat']]},
 {n:'lowerLegR',p:'upperLegR',at:[0,-0.4,0],rot:[1.5,0,0],mass:5,c:[0,-0.2,0],r:0.12,pri:7,hp:1,rleg:true, hit:[[0.11,0.4,0.11,0,-0.2,0],[0.12,0.1,0.2,0,-0.42,-0.03]],
  pieces:[['box',0.11,0.4,0.11,0,-0.2,0,'coat'],['box',0.115,0.05,0.115,0,-0.3,0,'glow'],['box',0.12,0.1,0.2,0,-0.42,-0.03,'boot']]},
];
const GALLOP={FL:0.5,FR:0.62,BL:0.0,BR:0.12};

function addPiece(THREE,M,g,pc){
  let geo, m;
  if(pc[0]==='box'){ geo=new THREE.BoxGeometry(pc[1],pc[2],pc[3]); m=new THREE.Mesh(geo,M[pc[7]]); m.position.set(pc[4],pc[5],pc[6]); }
  else if(pc[0]==='cyl'){ geo=new THREE.CylinderGeometry(pc[1],pc[2],pc[3],pc[9]||12); m=new THREE.Mesh(geo,M[pc[7]]); m.position.set(pc[4],pc[5],pc[6]);
    if(pc[8]==='x') m.rotation.z=PI/2; else if(pc[8]==='z') m.rotation.x=PI/2; }
  else if(pc[0]==='sph'){ geo=new THREE.SphereGeometry(pc[1],10,8); m=new THREE.Mesh(geo,M[pc[5]]); m.position.set(pc[2],pc[3],pc[4]); }
  else if(pc[0]==='torus'){ geo=new THREE.TorusGeometry(pc[1],pc[2],6,16,pc[7]||PI*2); m=new THREE.Mesh(geo,M[pc[6]]); m.position.set(pc[3],pc[4],pc[5]); }
  g.add(m); return m;
}
function buildRig(THREE,M,defs,parts){
  for(const d of defs){
    const g=new THREE.Group(); g.position.set(d.at[0],d.at[1],d.at[2]); g.rotation.set(d.rot[0],d.rot[1],d.rot[2]);
    for(const pc of d.pieces) addPiece(THREE,M,g,pc);
    parts[d.n]={def:d,g,hp:d.hp,on:true,name:d.n};
    if(d.p&&parts[d.p]) parts[d.p].g.add(g);
  }
}
// returns {root, horse, rider, parts, hat, cape, bow, animate}
function build(THREE,opts){
  opts=opts||{}; const M=opts.materials||makeMaterials(THREE);
  const root=new THREE.Group(); const horse=new THREE.Group(); horse.position.y=1.15; root.add(horse);
  const parts={}; buildRig(THREE,M,HORSE,parts); horse.add(parts.barrel.g);
  buildRig(THREE,M,RIDER,parts);
  // cape off the shoulders, the bow in the left hand (a violet recurve with lightning marks)
  const cape=new THREE.Group(); cape.position.set(0,0.58,0.2); parts.torso.g.add(cape); addPiece(THREE,M,cape,['box',0.56,0.02,0.75,0,0,0.375,'chevron']);
  const bowG=new THREE.Group(); bowG.position.set(0,-0.32,0); parts.lowerArmL.g.add(bowG);
  const bow=addPiece(THREE,M,bowG,['torus',0.42,0.025,0,0,0,'violet',PI]); bow.rotation.set(PI/2,0,0);
  addPiece(THREE,M,bowG,['box',0.06,0.12,0.05,0,0,-0.42,'black']);
  for(const s of [-1,1]){ const z=addPiece(THREE,M,bowG,['box',0.02,0.014,0.09,s*0.3,0,-0.29,'glow']); z.rotation.y=s*0.5; addPiece(THREE,M,bowG,['box',0.02,0.014,0.07,s*0.22,0,-0.34,'glow']); }
  const str=addPiece(THREE,M,bowG,['cyl',0.004,0.004,0.84,0,0,0,'string','y',3]); str.rotation.x=PI/2;
  if(opts.side>0) root.scale.x=-1;
  // the gallop (same beats as the game) and the rider rocking with it
  function animate(ph,spd,dt,time){
    const P=parts;
    for(const L of ['FL','FR','BL','BR']){ const o=ph+GALLOP[L]*2*PI, front=L[0]==='F'; const up=P['upper'+L], lo=P['lower'+L];
      if(up.on) up.g.rotation.x=Math.sin(o)*(front?0.75:0.85)*Math.min(1,spd/3);
      if(lo.on){ const fold=Math.max(0,Math.sin(o+1.0))*Math.min(1,spd/3); lo.g.rotation.x=front?-fold*1.1:fold*0.9; } }
    const a=Math.min(1,spd/3);
    horse.position.y=1.15+(0.09*Math.sin(2*ph+0.5)+0.04)*a; horse.rotation.x=0.07*Math.sin(ph+1.0)*a;
    if(P.neck1.on) P.neck1.g.rotation.x=0.55+0.08*Math.sin(ph)*a; if(P.tail.on) P.tail.g.rotation.x=-0.5+0.25*Math.sin(ph*0.5)*a;
    cape.rotation.x=1.35-Math.min(0.95,spd*0.045)+0.12*Math.sin((time||0)*7+ph)+0.06*Math.sin((time||0)*11.3);
  }
  return {root,horse,rider:parts.pelvis.g,parts,hat:parts.hat.g,cape,bow:bowG,animate,materials:M};
}
root.VioletChevron={HORSE,RIDER,GALLOP,COL,build,makeMaterials,chevronTexture};
})(typeof module!=='undefined'&&module.exports?module.exports:window);
