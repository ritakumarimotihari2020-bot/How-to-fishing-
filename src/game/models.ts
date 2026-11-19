import * as THREE from 'three';
import { BoatId, FishSpecies } from './types';
import { ProceduralTextureSet } from './textures';

export interface BoatRig {
  group: THREE.Group;
  hullMeshes: THREE.Mesh[];
  propellers: THREE.Object3D[];
  playerSeatOffset: THREE.Vector3;
  fishingStandOffset: THREE.Vector3;
}

/**
 * Composite 3-12 part procedural fishing boat builder with distinct silhouettes
 * across Small Fishing Skiff, Marlin GT Speed Boat, and Sovereign 42 Luxury Yacht.
 */
export function createBoatModel(
  boatId: BoatId,
  hullColorHex: string,
  textures: ProceduralTextureSet,
): BoatRig {
  const group = new THREE.Group();
  const hullMeshes: THREE.Mesh[] = [];
  const propellers: THREE.Object3D[] = [];

  const hullMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hullColorHex),
    roughness: 0.24,
    metalness: 0.14,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1e2c3a,
    roughness: 0.55,
    metalness: 0.2,
  });
  const deckWoodMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.woodMap,
    bumpMap: textures.woodBump,
    bumpScale: 0.03,
    roughness: 0.72,
    metalness: 0.04,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdbe5ec,
    roughness: 0.18,
    metalness: 0.88,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x112a3d,
    roughness: 0.08,
    metalness: 0.65,
    transparent: true,
    opacity: 0.78,
  });
  const cushionMat = new THREE.MeshStandardMaterial({
    color: 0xe6dfd1,
    roughness: 0.82,
    metalness: 0.02,
  });
  const motorMat = new THREE.MeshStandardMaterial({
    color: 0x222930,
    roughness: 0.35,
    metalness: 0.62,
  });

  if (boatId === 'small_skiff') {
    // 1. Primary V-Hull extruded profile
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 2.75); // pointed bow (+Z forward in local space)
    hullShape.quadraticCurveTo(1.12, 1.5, 1.04, -2.4);
    hullShape.lineTo(-1.04, -2.4);
    hullShape.quadraticCurveTo(-1.12, 1.5, 0, 2.75);

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.08,
      bevelSegments: 2,
    });
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.56;
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);
    hullMeshes.push(hull);

    // 2. Dark waterline stripe / keel accent
    const keel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 4.4), trimMat);
    keel.position.set(0, -0.18, 0.05);
    group.add(keel);

    // 3. Recessed timber floorboards
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.1, 3.9), deckWoodMat);
    deck.position.set(0, 0.58, -0.2);
    deck.receiveShadow = true;
    group.add(deck);

    // 4. Three timber bench seats
    for (const bz of [-1.55, -0.1, 1.25]) {
      const w = bz > 1 ? 1.35 : 1.78;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.42), deckWoodMat);
      bench.position.set(0, 0.78, bz);
      bench.castShadow = true;
      group.add(bench);
    }

    // 5. Gunwale rim bumpers (left/right)
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 4.2), trimMat);
      rail.position.set(side * 0.98, 0.72, -0.15);
      group.add(rail);

      // Rod holder tubes at stern
      const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), chromeMat);
      holder.position.set(side * 0.85, 0.92, -1.9);
      holder.rotation.x = -0.25;
      group.add(holder);
    }

    // 6. Rear outboard motor + spinning propeller
    const outboard = new THREE.Group();
    outboard.position.set(0, 0.65, -2.58);
    const cowling = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.52, 0.56), motorMat);
    cowling.position.y = 0.25;
    cowling.castShadow = true;
    outboard.add(cowling);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.85, 8), motorMat);
    shaft.position.y = -0.35;
    outboard.add(shaft);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), chromeMat);
    prop.position.set(0, -0.68, -0.12);
    outboard.add(prop);
    propellers.push(prop);
    group.add(outboard);

    // 7. Bow navigation lantern
    const navPost = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), chromeMat);
    navPost.position.set(0, 0.82, 2.35);
    group.add(navPost);
    const navLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffe4a0, emissive: 0xffb830, emissiveIntensity: 1.4 }),
    );
    navLight.position.set(0, 1.0, 2.35);
    group.add(navLight);

    return {
      group,
      hullMeshes,
      propellers,
      playerSeatOffset: new THREE.Vector3(0, 0.86, -1.15),
      fishingStandOffset: new THREE.Vector3(0, 0.72, 0.75),
    };
  }

  if (boatId === 'speed_boat') {
    // 1. Sleek tapered sport hull
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 3.85);
    hullShape.quadraticCurveTo(1.42, 1.8, 1.32, -3.3);
    hullShape.lineTo(-1.32, -3.3);
    hullShape.quadraticCurveTo(-1.42, 1.8, 0, 3.85);

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.92,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.1,
      bevelSegments: 2,
    });
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.72;
    hull.castShadow = true;
    hull.receiveShadow = true;
    group.add(hull);
    hullMeshes.push(hull);

    // 2. White sporty deck inlay
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(2.25, 0.14, 5.4),
      new THREE.MeshStandardMaterial({ color: 0xeaf0f4, roughness: 0.42, metalness: 0.06 }),
    );
    deck.position.set(0, 0.76, -0.35);
    deck.receiveShadow = true;
    group.add(deck);

    // 3. Center console + helm steering wheel
    const consoleBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 1.05, 1.0),
      new THREE.MeshStandardMaterial({ color: 0xf4f7f9, roughness: 0.32, metalness: 0.08 }),
    );
    consoleBody.position.set(0, 1.3, 0.35);
    consoleBody.castShadow = true;
    group.add(consoleBody);

    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.032, 8, 16), chromeMat);
    wheel.position.set(0, 1.48, -0.2);
    wheel.rotation.x = 0.35;
    group.add(wheel);

    // 4. Swept tinted sport windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.56, 0.1), glassMat);
    windshield.position.set(0, 1.72, 0.85);
    windshield.rotation.x = -0.42;
    group.add(windshield);

    // 5. Dual sport captain chairs
    for (const sx of [-0.55, 0.55]) {
      const seatBase = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.45, 8), chromeMat);
      seatBase.position.set(sx, 1.0, -0.95);
      group.add(seatBase);
      const seatCushion = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.16, 0.56), cushionMat);
      seatCushion.position.set(sx, 1.24, -0.95);
      group.add(seatCushion);
      const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.65, 0.14), cushionMat);
      seatBack.position.set(sx, 1.56, -1.2);
      group.add(seatBack);
    }

    // 6. T-Top bimini sport arch
    for (const sx of [-0.95, 0.95]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.65, 8), chromeMat);
      strut.position.set(sx, 1.62, -0.35);
      strut.rotation.x = -0.18;
      group.add(strut);
    }
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.1, 1.85), trimMat);
    canopy.position.set(0, 2.48, -0.15);
    canopy.castShadow = true;
    group.add(canopy);

    // 7. Twin high-output outboards
    for (const ox of [-0.46, 0.46]) {
      const motor = new THREE.Group();
      motor.position.set(ox, 0.75, -3.55);
      const cowl = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.65, 0.62), motorMat);
      cowl.position.y = 0.32;
      cowl.castShadow = true;
      motor.add(cowl);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.9, 8), motorMat);
      shaft.position.y = -0.32;
      motor.add(shaft);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.09, 0.09), chromeMat);
      prop.position.set(0, -0.7, -0.15);
      motor.add(prop);
      propellers.push(prop);
      group.add(motor);
    }

    return {
      group,
      hullMeshes,
      propellers,
      playerSeatOffset: new THREE.Vector3(0, 1.05, -0.65),
      fishingStandOffset: new THREE.Vector3(0, 0.9, -2.05),
    };
  }

  // 'luxury_yacht' — Sovereign 42 Sportfishing Yacht
  const hullShape = new THREE.Shape();
  hullShape.moveTo(0, 6.2);
  hullShape.quadraticCurveTo(2.15, 3.1, 2.02, -5.6);
  hullShape.lineTo(-2.02, -5.6);
  hullShape.quadraticCurveTo(-2.15, 3.1, 0, 6.2);

  const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
    depth: 1.55,
    bevelEnabled: true,
    bevelThickness: 0.22,
    bevelSize: 0.15,
    bevelSegments: 2,
  });
  hullGeo.rotateX(Math.PI / 2);
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.y = 1.25;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);
  hullMeshes.push(hull);

  // Dark waterline band
  const bootStripe = new THREE.Mesh(new THREE.BoxGeometry(4.12, 0.25, 10.2), trimMat);
  bootStripe.position.set(0, 0.25, -0.35);
  group.add(bootStripe);

  // Teak aft fishing cockpit deck
  const teakDeck = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.14, 4.4), deckWoodMat);
  teakDeck.position.set(0, 1.32, -3.35);
  teakDeck.receiveShadow = true;
  group.add(teakDeck);

  // Main enclosed salon cabin
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0xf4f7fa, roughness: 0.28, metalness: 0.08 });
  const salon = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.65, 4.5), cabinMat);
  salon.position.set(0, 2.1, 0.65);
  salon.castShadow = true;
  group.add(salon);

  // Panoramic wrap-around dark salon windows
  const sideWin = new THREE.Mesh(new THREE.BoxGeometry(3.38, 0.72, 3.6), glassMat);
  sideWin.position.set(0, 2.28, 0.75);
  group.add(sideWin);
  const frontWin = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.75, 0.16), glassMat);
  frontWin.position.set(0, 2.28, 2.95);
  frontWin.rotation.x = -0.32;
  group.add(frontWin);

  // Flybridge upper deck & helm console
  const flyDeck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 2.9), cabinMat);
  flyDeck.position.set(0, 3.12, 0.15);
  flyDeck.castShadow = true;
  group.add(flyDeck);

  const flyHelm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.62, 0.75), trimMat);
  flyHelm.position.set(0, 3.56, 0.95);
  group.add(flyHelm);

  // Radar arch & glowing beacon
  const radarArch = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 0.55), cabinMat);
  radarArch.position.set(0, 4.48, -0.55);
  group.add(radarArch);
  for (const sx of [-1.32, 1.32]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.45, 0.45), cabinMat);
    pillar.position.set(sx, 3.78, -0.55);
    group.add(pillar);
  }
  const radarDome = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.24, 14), cabinMat);
  radarDome.position.set(0, 4.68, -0.55);
  group.add(radarDome);

  // Aft fighting chair
  const chairPedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.65, 10), chromeMat);
  chairPedestal.position.set(0, 1.65, -3.55);
  group.add(chairPedestal);
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.72), cushionMat);
  chairSeat.position.set(0, 2.0, -3.55);
  group.add(chairSeat);
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.65, 0.16), cushionMat);
  chairBack.position.set(0, 2.34, -3.22);
  group.add(chairBack);

  // Twin sportfishing outriggers
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 5.2, 8), chromeMat);
    pole.position.set(side * 2.5, 4.2, -1.6);
    pole.rotation.z = side * -0.55;
    pole.rotation.x = -0.35;
    group.add(pole);

    // Stainless bow railings
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.4, 6), chromeMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * 1.42, 1.85, 3.7);
    group.add(rail);
  }

  // Twin submerged bronze propellers at stern
  for (const px of [-0.75, 0.75]) {
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.12), chromeMat);
    prop.position.set(px, -0.15, -5.2);
    group.add(prop);
    propellers.push(prop);
  }

  return {
    group,
    hullMeshes,
    propellers,
    playerSeatOffset: new THREE.Vector3(0, 3.45, 0.15),
    fishingStandOffset: new THREE.Vector3(0, 1.4, -4.3),
  };
}

export interface FishModelRig {
  group: THREE.Group;
  tailPivot: THREE.Group;
  bodyMesh: THREE.Mesh;
}

/**
 * Articulated multi-part 3D fish builder with species-distinct silhouettes
 * (shark dorsal, marlin bill, catfish barbels, deep/slim bodies, animated wagging tail).
 */
export function createFishModel(species: FishSpecies, scale = 1.0): FishModelRig {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(species.bodyColor),
    roughness: 0.28,
    metalness: 0.24,
  });
  const bellyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(species.bellyColor),
    roughness: 0.35,
    metalness: 0.18,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(species.finColor),
    roughness: 0.48,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(species.accentColor),
    roughness: 0.3,
    metalness: 0.25,
  });

  // Proportions by body shape (fish faces +Z locally)
  let sx = 0.24;
  let sy = 0.32;
  let sz = 0.95;
  if (species.bodyShape === 'slim') {
    sx = 0.18;
    sy = 0.24;
    sz = 1.05;
  } else if (species.bodyShape === 'deep') {
    sx = 0.26;
    sy = 0.44;
    sz = 0.85;
  } else if (species.bodyShape === 'shark') {
    sx = 0.32;
    sy = 0.35;
    sz = 1.35;
  } else if (species.bodyShape === 'marlin') {
    sx = 0.22;
    sy = 0.32;
    sz = 1.25;
  } else if (species.bodyShape === 'catfish') {
    sx = 0.32;
    sy = 0.24;
    sz = 1.0;
  }

  // 1. Primary fusiform body
  const bodyGeo = new THREE.SphereGeometry(0.5, 14, 10);
  bodyGeo.scale(sx, sy, sz);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // 2. Pale counter-shaded belly
  const bellyGeo = new THREE.SphereGeometry(0.46, 10, 8);
  bellyGeo.scale(sx * 0.92, sy * 0.72, sz * 0.86);
  const bellyMesh = new THREE.Mesh(bellyGeo, bellyMat);
  bellyMesh.position.y = -sy * 0.14;
  group.add(bellyMesh);

  // 3. Dorsal fin
  const dorsalShape = new THREE.Shape();
  if (species.bodyShape === 'shark') {
    dorsalShape.moveTo(0, 0);
    dorsalShape.lineTo(-0.34, 0);
    dorsalShape.lineTo(-0.18, 0.38);
    dorsalShape.closePath();
  } else if (species.bodyShape === 'marlin') {
    dorsalShape.moveTo(0.28, 0);
    dorsalShape.lineTo(-0.36, 0);
    dorsalShape.lineTo(-0.1, 0.34);
    dorsalShape.lineTo(0.18, 0.42);
    dorsalShape.closePath();
  } else {
    dorsalShape.moveTo(0.18, 0);
    dorsalShape.lineTo(-0.24, 0);
    dorsalShape.lineTo(-0.12, 0.22);
    dorsalShape.lineTo(0.08, 0.2);
    dorsalShape.closePath();
  }
  const dorsalGeo = new THREE.ExtrudeGeometry(dorsalShape, { depth: 0.025, bevelEnabled: false });
  dorsalGeo.rotateY(Math.PI / 2);
  const dorsal = new THREE.Mesh(dorsalGeo, finMat);
  dorsal.position.set(-0.012, sy * 0.42, 0.04);
  group.add(dorsal);

  // 4. Lateral stripe / species accent band
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.98, sy * 0.16, sz * 0.65), accentMat);
  stripe.position.set(0, sy * 0.05, 0.02);
  group.add(stripe);

  // 5. Pectoral fins (left/right)
  for (const side of [-1, 1]) {
    const pec = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 4), finMat);
    pec.position.set(side * sx * 0.42, -sy * 0.12, sz * 0.14);
    pec.rotation.z = side * 1.15;
    pec.rotation.x = -0.35;
    group.add(pec);

    // Eyes
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.036, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x0b1015, roughness: 0.1 }),
    );
    eye.position.set(side * sx * 0.34, sy * 0.14, sz * 0.34);
    group.add(eye);
  }

  // 6. Species-specific head details
  if (species.bodyShape === 'marlin') {
    const bill = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.72, 6), accentMat);
    bill.rotation.x = Math.PI / 2;
    bill.position.set(0, 0.02, sz * 0.5 + 0.3);
    group.add(bill);
  } else if (species.bodyShape === 'catfish') {
    for (const side of [-1, 1]) {
      const whisker = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.004, 0.38, 5), finMat);
      whisker.position.set(side * 0.14, -0.04, sz * 0.45);
      whisker.rotation.z = side * 1.1;
      whisker.rotation.x = 0.5;
      group.add(whisker);
    }
  }

  // 7. Articulated Caudal Tail Pivot (for animated swimming undulation)
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0, -sz * 0.46);
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(-0.32, 0.28);
  tailShape.lineTo(-0.18, 0);
  tailShape.lineTo(-0.32, -0.26);
  tailShape.closePath();
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: 0.02, bevelEnabled: false });
  tailGeo.rotateY(Math.PI / 2);
  const tailMesh = new THREE.Mesh(tailGeo, finMat);
  tailMesh.position.x = -0.01;
  tailPivot.add(tailMesh);
  group.add(tailPivot);

  group.scale.setScalar(scale);

  return { group, tailPivot, bodyMesh };
}

export interface AnglerRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  rodGroup: THREE.Group;
  rodSegments: THREE.Group[];
  rodTipMarker: THREE.Object3D;
  reelCrank: THREE.Object3D;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rodBlankMats: THREE.MeshStandardMaterial[];
}

/**
 * Articulated 3D Angler avatar + bendable multi-segment fishing rod with spinning reel.
 * Pivot is at bottom-center (feet at y = 0).
 */
export function createAnglerModel(rodColorHex: string, textures: ProceduralTextureSet): AnglerRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  // Soft radial contact shadow under feet
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x3b4a59, roughness: 0.85 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0x6f684e, roughness: 0.82 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2f5f7c, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xdfb28b, roughness: 0.65 });
  const hatMat = new THREE.MeshStandardMaterial({ color: 0xb99d72, roughness: 0.88 });
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x2c241d, roughness: 0.72 });

  // Legs
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), pantsMat);
  leftLeg.position.set(-0.14, 0.42, 0);
  leftLeg.castShadow = true;
  bodyGroup.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), pantsMat);
  rightLeg.position.set(0.14, 0.42, 0);
  rightLeg.castShadow = true;
  bodyGroup.add(rightLeg);

  // Boots
  for (const lx of [-0.14, 0.14]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.3), bootMat);
    boot.position.set(lx, 0.09, 0.04);
    bodyGroup.add(boot);
  }

  // Torso + multi-pocket angling vest
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), shirtMat);
  torso.position.set(0, 1.12, 0);
  torso.castShadow = true;
  bodyGroup.add(torso);

  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.33), vestMat);
  vest.position.set(0, 1.1, 0);
  bodyGroup.add(vest);

  // Arms angled forward holding the rod
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), shirtMat);
  leftArm.position.set(-0.34, 1.16, 0.16);
  leftArm.rotation.x = -0.75;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.18), shirtMat);
  rightArm.position.set(0.34, 1.16, 0.22);
  rightArm.rotation.x = -0.95;
  bodyGroup.add(rightArm);

  // Head + angler sun hat
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMat);
  head.position.set(0, 1.62, 0);
  head.castShadow = true;
  bodyGroup.add(head);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 14), hatMat);
  hatBrim.position.set(0, 1.75, 0.02);
  bodyGroup.add(hatBrim);
  const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.16, 12), hatMat);
  hatCrown.position.set(0, 1.84, 0);
  bodyGroup.add(hatCrown);

  // Fishing Rod Group attached to angler hands (faces +Z local)
  const rodGroup = new THREE.Group();
  rodGroup.position.set(0.22, 1.12, 0.38);
  group.add(rodGroup);

  const corkMat = new THREE.MeshStandardMaterial({ color: 0xb68a5a, roughness: 0.9 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xcfdbe3, roughness: 0.22, metalness: 0.85 });
  const rodBlankMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(rodColorHex),
    roughness: 0.25,
    metalness: 0.4,
  });

  // Cork handle + reel seat
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.52, 8), corkMat);
  handle.rotation.x = Math.PI / 2;
  handle.position.z = 0.05;
  rodGroup.add(handle);

  // Spinning reel body + animated crank
  const reelHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 10), metalMat);
  reelHousing.position.set(0, -0.07, 0.18);
  rodGroup.add(reelHousing);

  const reelCrank = new THREE.Group();
  reelCrank.position.set(0.065, -0.07, 0.18);
  const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.02), metalMat);
  crankArm.position.y = 0.04;
  reelCrank.add(crankArm);
  rodGroup.add(reelCrank);

  // 4 Articulated Flexible Rod Blank Segments (bend realistically under fish tension!)
  const rodSegments: THREE.Group[] = [];
  let parentNode: THREE.Object3D = rodGroup;
  const segLen = 0.62;
  for (let i = 0; i < 4; i++) {
    const segGroup = new THREE.Group();
    segGroup.position.set(0, 0, i === 0 ? 0.3 : segLen);
    const rBottom = 0.022 * (1 - i * 0.2);
    const rTop = 0.022 * (1 - (i + 1) * 0.2);
    const blank = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(0.004, rTop), Math.max(0.005, rBottom), segLen, 8),
      rodBlankMat,
    );
    blank.rotation.x = Math.PI / 2;
    blank.position.z = segLen * 0.5;
    segGroup.add(blank);

    // Line guide ring
    const guide = new THREE.Mesh(new THREE.TorusGeometry(0.018 - i * 0.002, 0.004, 6, 10), metalMat);
    guide.position.set(0, -0.025, segLen * 0.92);
    segGroup.add(guide);

    parentNode.add(segGroup);
    rodSegments.push(segGroup);
    parentNode = segGroup;
  }

  const rodTipMarker = new THREE.Object3D();
  rodTipMarker.position.set(0, -0.015, segLen);
  parentNode.add(rodTipMarker);

  return {
    group,
    bodyGroup,
    rodGroup,
    rodSegments,
    rodTipMarker,
    reelCrank,
    leftLeg,
    rightLeg,
    rodBlankMats: [rodBlankMat],
  };
}

/**
 * Coastal Lighthouse landmark (tall silhouette visible from initial spawn camera).
 */
export function createLighthouseModel(): { group: THREE.Group; beamGroup: THREE.Group } {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x7a838a, roughness: 0.9 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.55 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xb63832, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e262e, roughness: 0.4, metalness: 0.5 });
  const glassGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff0b3,
    emissive: 0xffc852,
    emissiveIntensity: 1.6,
    roughness: 0.15,
  });

  // 1. Stone foundation pedestal
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.5, 2.8, 14), stoneMat);
  base.position.y = 1.4;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // 2. Striped red-and-white tapered tower sections
  const sections = [
    { y: 4.5, rBot: 3.1, rTop: 2.75, h: 3.5, mat: whiteMat },
    { y: 8.0, rBot: 2.75, rTop: 2.4, h: 3.5, mat: redMat },
    { y: 11.5, rBot: 2.4, rTop: 2.05, h: 3.5, mat: whiteMat },
    { y: 15.0, rBot: 2.05, rTop: 1.75, h: 3.5, mat: redMat },
  ];
  for (const s of sections) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(s.rTop, s.rBot, s.h, 16), s.mat);
    mesh.position.y = s.y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // 3. Observation gallery ring
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 2.25, 0.55, 16), darkMat);
  gallery.position.y = 17.0;
  group.add(gallery);

  // 4. Lantern glass room
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2.1, 14), glassGlowMat);
  lantern.position.y = 18.3;
  group.add(lantern);

  // 5. Conical roof & finial
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 2.2, 14), redMat);
  roof.position.y = 20.4;
  roof.castShadow = true;
  group.add(roof);

  // 6. Rotating lighthouse light beam cone
  const beamGroup = new THREE.Group();
  beamGroup.position.y = 18.3;
  const beamGeo = new THREE.ConeGeometry(4.2, 34, 14, 1, true);
  beamGeo.rotateX(Math.PI / 2);
  beamGeo.translate(0, 0, 17);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffe69c,
    transparent: true,
    opacity: 0.14,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beamA = new THREE.Mesh(beamGeo, beamMat);
  const beamB = new THREE.Mesh(beamGeo, beamMat);
  beamB.rotation.y = Math.PI;
  beamGroup.add(beamA, beamB);
  group.add(beamGroup);

  // 7. Keeper's cottage adjacent to tower
  const cottage = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.2, 4.2), whiteMat);
  cottage.position.set(4.5, 1.6, 0.5);
  cottage.castShadow = true;
  group.add(cottage);
  const cottageRoof = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.1, 4), redMat);
  cottageRoof.rotation.y = Math.PI / 4;
  cottageRoof.position.set(4.5, 4.2, 0.5);
  group.add(cottageRoof);

  return { group, beamGroup };
}

/**
 * Weathered wooden fishing pier with pilings, cleats, tackle shack, and warm deck lanterns.
 */
export function createPierModel(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  deckY: number,
  textures: ProceduralTextureSet,
): { group: THREE.Group; lanternGlows: THREE.MeshStandardMaterial[] } {
  const group = new THREE.Group();
  const lanternGlows: THREE.MeshStandardMaterial[] = [];

  const width = maxX - minX;
  const length = maxZ - minZ;
  const cx = (minX + maxX) * 0.5;
  const cz = (minZ + maxZ) * 0.5;

  const deckMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.woodMap,
    bumpMap: textures.woodBump,
    bumpScale: 0.04,
    roughness: 0.82,
    metalness: 0.04,
  });
  const pilingMat = new THREE.MeshStandardMaterial({
    color: 0x4b3828,
    roughness: 0.92,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x262e36,
    roughness: 0.45,
    metalness: 0.72,
  });

  // Main timber deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(width, 0.34, length), deckMat);
  deck.position.set(cx, deckY - 0.17, cz);
  deck.receiveShadow = true;
  deck.castShadow = true;
  group.add(deck);

  // Side trim beams
  for (const sx of [minX + 0.18, maxX - 0.18]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, length), pilingMat);
    beam.position.set(sx, deckY + 0.08, cz);
    group.add(beam);
  }

  // Vertical pilings & mooring bollards extending deep into seabed
  const steps = Math.max(3, Math.floor(length / 5.5));
  for (let i = 0; i <= steps; i++) {
    const pz = minZ + 0.7 + (i / steps) * (length - 1.4);
    for (const px of [minX + 0.45, maxX - 0.45]) {
      const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, deckY + 8.5, 10), pilingMat);
      piling.position.set(px, deckY + 0.7 - (deckY + 8.5) * 0.5, pz);
      piling.castShadow = true;
      group.add(piling);

      // Mooring rope ring / bollard cap
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.26, 0.12, 10), ironMat);
      cap.position.set(px, deckY + 0.75, pz);
      group.add(cap);
    }

    // Warm pier post lanterns at front and midpoint
    if (i === 0 || i === Math.floor(steps / 2)) {
      const postX = minX + 0.45;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.3, 8), ironMat);
      pole.position.set(postX, deckY + 1.15, pz);
      group.add(pole);

      const lampMat = new THREE.MeshStandardMaterial({
        color: 0xffdf96,
        emissive: 0xffa838,
        emissiveIntensity: 1.4,
        roughness: 0.2,
      });
      lanternGlows.push(lampMat);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.26), lampMat);
      lamp.position.set(postX, deckY + 2.38, pz);
      group.add(lamp);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.22, 4), ironMat);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(postX, deckY + 2.66, pz);
      group.add(roof);
    }
  }

  // Wooden bait barrel & tackle crate near back of pier
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.92, 10), pilingMat);
  barrel.position.set(minX + 1.1, deckY + 0.46, maxZ - 3.0);
  barrel.castShadow = true;
  group.add(barrel);

  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.65, 0.75), deckMat);
  crate.position.set(maxX - 1.15, deckY + 0.33, maxZ - 3.2);
  crate.castShadow = true;
  group.add(crate);

  return { group, lanternGlows };
}
