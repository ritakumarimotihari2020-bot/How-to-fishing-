import * as THREE from 'three';

export interface ProceduralTextureSet {
  woodMap: THREE.CanvasTexture;
  woodBump: THREE.CanvasTexture;
  sandMap: THREE.CanvasTexture;
  rockMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Weathered marine timber plank diffuse + bump map
  const [woodCanvas, wctx] = makeCanvas(256, 256);
  const [woodBumpCanvas, wbctx] = makeCanvas(256, 256);
  wctx.fillStyle = '#8b6848';
  wctx.fillRect(0, 0, 256, 256);
  wbctx.fillStyle = '#909090';
  wbctx.fillRect(0, 0, 256, 256);

  const planks = 6;
  const plankH = 256 / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * plankH;
    const tone = 118 + ((p * 17) % 24);
    wctx.fillStyle = `rgb(${tone + 18}, ${tone - 8}, ${tone - 36})`;
    wctx.fillRect(0, y0 + 2, 256, plankH - 3);
    // Plank seam
    wctx.fillStyle = '#3b2819';
    wctx.fillRect(0, y0, 256, 3);
    wbctx.fillStyle = '#202020';
    wbctx.fillRect(0, y0, 256, 3);
    // Wood grain streaks
    for (let g = 0; g < 18; g++) {
      const gy = y0 + 4 + Math.random() * (plankH - 8);
      wctx.fillStyle = g % 2 === 0 ? 'rgba(55, 36, 22, 0.22)' : 'rgba(210, 175, 130, 0.14)';
      wctx.fillRect(0, gy, 256, 1.5);
      wbctx.fillStyle = g % 2 === 0 ? 'rgba(60,60,60,0.28)' : 'rgba(180,180,180,0.2)';
      wbctx.fillRect(0, gy, 256, 1.5);
    }
  }
  const woodMap = new THREE.CanvasTexture(woodCanvas);
  woodMap.colorSpace = THREE.SRGBColorSpace;
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  woodMap.anisotropy = aniso;

  const woodBump = new THREE.CanvasTexture(woodBumpCanvas);
  woodBump.wrapS = woodBump.wrapT = THREE.RepeatWrapping;
  woodBump.anisotropy = aniso;

  // 2. Coastal sand & pebble speckle texture
  const [sandCanvas, sctx] = makeCanvas(256, 256);
  sctx.fillStyle = '#d4c19a';
  sctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const r = 1 + Math.random() * 2.2;
    const shade = Math.random();
    sctx.fillStyle =
      shade < 0.35
        ? 'rgba(165, 145, 108, 0.35)'
        : shade < 0.7
          ? 'rgba(235, 221, 188, 0.35)'
          : 'rgba(125, 112, 88, 0.28)';
    sctx.fillRect(x, y, r, r);
  }
  const sandMap = new THREE.CanvasTexture(sandCanvas);
  sandMap.colorSpace = THREE.SRGBColorSpace;
  sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping;
  sandMap.repeat.set(14, 14);
  sandMap.anisotropy = aniso;

  // 3. Granite cliff / boulder texture
  const [rockCanvas, rctx] = makeCanvas(256, 256);
  rctx.fillStyle = '#6c7378';
  rctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 6 + Math.random() * 28;
    const h = 3 + Math.random() * 14;
    const v = 78 + Math.floor(Math.random() * 64);
    rctx.fillStyle = `rgba(${v}, ${v + 4}, ${v + 8}, 0.36)`;
    rctx.fillRect(x, y, w, h);
  }
  const rockMap = new THREE.CanvasTexture(rockCanvas);
  rockMap.colorSpace = THREE.SRGBColorSpace;
  rockMap.wrapS = rockMap.wrapT = THREE.RepeatWrapping;
  rockMap.anisotropy = aniso;

  // 4. Radial soft contact shadow disc
  const [shadowCanvas, shctx] = makeCanvas(128, 128);
  const grad = shctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  grad.addColorStop(0, 'rgba(5, 12, 20, 0.65)');
  grad.addColorStop(0.6, 'rgba(5, 12, 20, 0.28)');
  grad.addColorStop(1, 'rgba(5, 12, 20, 0)');
  shctx.fillStyle = grad;
  shctx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);

  return {
    woodMap,
    woodBump,
    sandMap,
    rockMap,
    contactShadowMap,
    dispose: () => {
      woodMap.dispose();
      woodBump.dispose();
      sandMap.dispose();
      rockMap.dispose();
      contactShadowMap.dispose();
    },
  };
}
