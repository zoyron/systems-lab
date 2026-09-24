import * as THREE from 'three';
import {
  COLORS,
  addBox,
  addCone,
  addCylinder,
  addGroundPlane,
  addPointLight,
  addSphere,
  addTorus,
  buildCrate,
  geometry,
  materials,
  random,
  setShadowFlags,
  standardMaterial,
} from './kit.js';
import { createLutin, createSkeleton } from './actors.js';

function buildWall(parent, x, z, width, depth, height) {
  addBox(parent, materials.stoneDark, x, height * 0.5, z, width, height, depth);
  const blockCount = Math.max(2, Math.round(width / 0.62));
  for (let i = 0; i < blockCount; i += 1) {
    const px = x - width * 0.5 + (i + 0.5) * (width / blockCount);
    addBox(parent, i % 2 ? materials.stone : materials.stoneLight, px, height * 0.52, z + depth * 0.5 + 0.012, width / blockCount * 0.86, height * 0.35, 0.035);
  }
  addBox(parent, materials.stoneLight, x, height + 0.08, z, width + 0.12, 0.16, depth + 0.16);
}

function buildPortal(parent) {
  const group = new THREE.Group();
  group.position.set(1.15, 0, -3.55);
  parent.add(group);
  addBox(group, materials.stoneDark, 0, 1.65, 0.08, 2.05, 3.3, 0.35);
  addBox(group, materials.greenDark, 0, 1.55, 0.28, 1.45, 2.5, 0.08);
  const portal = new THREE.Mesh(geometry.plane, materials.greenGlow);
  portal.position.set(0, 1.58, 0.34);
  portal.scale.set(1.28, 2.28, 1);
  portal.userData.noShadow = true;
  group.add(portal);
  addBox(group, materials.stoneLight, -0.78, 1.58, 0.42, 0.12, 2.55, 0.12);
  addBox(group, materials.stoneLight, 0.78, 1.58, 0.42, 0.12, 2.55, 0.12);
  addBox(group, materials.stoneLight, 0, 2.86, 0.42, 1.72, 0.13, 0.12);
  addBox(group, materials.stoneLight, 0, 0.3, 0.42, 1.72, 0.14, 0.12);
  addBox(group, materials.green, 0, 1.58, 0.4, 0.07, 2.25, 0.04);
  const halo = addSphere(group, materials.greenGlow, 0, 1.58, 0.12, 0.88, 1.25, 0.08);
  halo.userData.noShadow = true;
  const light = addPointLight(group, 0x45ed87, 9, 8, 0, 1.5, 0.7);
  light.userData.baseIntensity = 9;
  const hit = new THREE.Mesh(geometry.box, materials.invisible);
  hit.position.set(1.15, 1.5, -3.1);
  hit.scale.set(1.8, 2.5, 0.35);
  hit.userData.noShadow = true;
  parent.add(hit);
  return { group, portal, halo, light, hit };
}

function buildTorch(parent, x, y, z, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  parent.add(group);
  addCylinder(group, materials.woodDark, 0, 0, 0.1, 0.055, 0.55, Math.PI * 0.5);
  addBox(group, materials.stoneDark, 0, 0.03, 0.3, 0.22, 0.22, 0.12);
  addBox(group, materials.wood, 0, 0.12, 0.3, 0.28, 0.08, 0.26);
  const flame = addCone(group, materials.fire, 0, 0.4, 0.31, 0.16, 0.48);
  flame.scale.z = 0.65;
  const core = addCone(group, materials.fireCore, 0, 0.29, 0.32, 0.08, 0.28);
  core.scale.z = 0.55;
  const light = addPointLight(group, 0xff9a42, 6.5, 7.5, 0, 0.55, 0.42);
  light.userData.baseIntensity = 6.5;
  light.userData.phase = random() * 6.28;
  return { group, flame, core, light };
}

function buildDesk(parent) {
  const desk = new THREE.Group();
  desk.position.set(-3.1, 0, 0.15);
  parent.add(desk);
  addBox(desk, materials.woodDark, 0, 1.05, 0, 1.75, 0.18, 0.86);
  addBox(desk, materials.wood, 0, 0.53, 0, 1.5, 0.95, 0.68);
  addBox(desk, materials.woodLight, 0, 0.88, 0.35, 1.32, 0.18, 0.04);
  addBox(desk, materials.woodDark, 0, 0.6, 0.36, 0.5, 0.05, 0.04);
  for (let i = 0; i < 4; i += 1) addBox(desk, i % 2 ? materials.red : materials.burgundy, -0.55 + i * 0.33, 1.18, -0.08, 0.22, 0.13, 0.46, 0, 0, (i - 1.5) * 0.05);
  addSphere(desk, materials.boneLight, 0.42, 1.29, 0.1, 0.19, 0.2, 0.18);
  addSphere(desk, materials.black, 0.36, 1.32, 0.27, 0.035, 0.05, 0.018);
  addSphere(desk, materials.black, 0.48, 1.32, 0.27, 0.035, 0.05, 0.018);
  for (let i = 0; i < 3; i += 1) {
    const bottle = addCylinder(desk, i === 1 ? materials.greenDark : materials.purple, -0.45 + i * 0.22, 1.28, 0.2, 0.08, 0.34);
    bottle.scale.z = 0.8;
    addCylinder(desk, materials.woodDark, -0.45 + i * 0.22, 1.49, 0.2, 0.045, 0.1);
  }
  for (let i = 0; i < 2; i += 1) {
    addCylinder(desk, materials.boneLight, 0.15 + i * 0.16, 1.28, 0.23, 0.045, 0.26);
    addCone(desk, materials.fire, 0.15 + i * 0.16, 1.48, 0.23, 0.07, 0.16);
  }
  addTorus(desk, materials.woodLight, -0.55, 1.17, 0.12, 0.18, 0.025, Math.PI * 0.5, 0, 0);
  addTorus(desk, materials.woodLight, -0.55, 1.17, 0.12, 0.12, 0.018, Math.PI * 0.5, 0, 0);
  return desk;
}

function buildShelves(parent) {
  const shelf = new THREE.Group();
  shelf.position.set(-3.85, 0, -1.85);
  parent.add(shelf);
  addBox(shelf, materials.woodDark, 0, 2.15, 0, 0.28, 2.7, 2.8);
  for (let i = 0; i < 3; i += 1) {
    const y = 0.8 + i * 0.85;
    addBox(shelf, materials.woodLight, 0.2, y, 0, 0.52, 0.1, 2.45);
    for (let j = 0; j < 5; j += 1) {
      const jar = addCylinder(shelf, j % 2 ? materials.greenDark : materials.purple, 0.28, y + 0.22, -0.85 + j * 0.42, 0.11, 0.28);
      jar.scale.z = 0.8;
      addCylinder(shelf, materials.woodDark, 0.28, y + 0.4, -0.85 + j * 0.42, 0.08, 0.06);
    }
  }
  return shelf;
}

function buildCoffin(parent) {
  const group = new THREE.Group();
  group.position.set(2.55, 0, 0.15);
  parent.add(group);
  addBox(group, materials.stoneDark, 0, 0.28, 0, 2.25, 0.5, 3.9);
  addBox(group, materials.stone, 0, 0.57, 0, 2.05, 0.14, 3.7);
  const shape = new THREE.Shape();
  shape.moveTo(-0.78, -1.55);
  shape.lineTo(0.78, -1.55);
  shape.quadraticCurveTo(0.95, -0.6, 0.7, 1.25);
  shape.quadraticCurveTo(0.55, 1.65, 0, 1.85);
  shape.quadraticCurveTo(-0.55, 1.65, -0.7, 1.25);
  shape.quadraticCurveTo(-0.95, -0.6, -0.78, -1.55);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.06, bevelThickness: 0.05, curveSegments: 5 });
  geo.rotateX(-Math.PI * 0.5);
  const coffin = new THREE.Mesh(geo, materials.wood);
  coffin.position.y = 0.86;
  group.add(coffin);
  addBox(group, materials.woodDark, 0, 1.1, 0, 1.24, 0.08, 2.9);
  addBox(group, materials.boneLight, 0, 1.16, 1.18, 0.72, 0.12, 0.42, 0, 0, 0.03);
  const lid = new THREE.Group();
  lid.position.set(0, 1.3, -1.18);
  lid.rotation.x = -0.82;
  group.add(lid);
  const lidGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.04, bevelThickness: 0.03, curveSegments: 5 });
  lidGeo.rotateX(-Math.PI * 0.5);
  const lidMesh = new THREE.Mesh(lidGeo, materials.woodLight);
  lidMesh.position.y = 0.1;
  lid.add(lidMesh);
  addBox(lid, materials.woodDark, 0, 0.2, 0, 0.1, 0.04, 2.8);
  const skeleton = createSkeleton({ scale: 0.76 });
  skeleton.rotation.x = Math.PI * 0.5;
  skeleton.position.set(0, 1.48, -0.75);
  group.add(skeleton);
  addSphere(group, materials.boneLight, -0.08, 1.7, 0.94, 0.23, 0.26, 0.22);
  addBox(group, materials.bone, -0.08, 1.51, 1.1, 0.27, 0.1, 0.12);
  addSphere(group, materials.black, -0.16, 1.74, 1.14, 0.045, 0.06, 0.02);
  addSphere(group, materials.black, 0.01, 1.74, 1.14, 0.045, 0.06, 0.02);
  addBox(group, materials.burgundy, 0, 1.22, -0.88, 1.1, 0.06, 0.65, 0, 0, 0.03);
  return { group, skeleton, lid };
}

export function buildCrypt(scene) {
  const group = new THREE.Group();
  group.name = 'Crypt';
  scene.add(group);
  addBox(group, materials.stoneDark, 0, -0.22, 0, 9.0, 0.44, 7.2);
  const tileMaterials = [standardMaterial(0x737671, { roughness: 0.96 }), standardMaterial(0x666a65, { roughness: 0.98 }), standardMaterial(0x7b7c73, { roughness: 0.94 })];
  for (let x = -3.6; x <= 3.6; x += 0.9) {
    for (let z = -3.0; z <= 3.0; z += 0.9) {
      const tile = addBox(group, tileMaterials[Math.floor(random() * tileMaterials.length)], x, 0.035, z, 0.84, 0.07, 0.84);
      tile.rotation.y = (random() - 0.5) * 0.04;
    }
  }
  buildWall(group, 0, -3.55, 8.6, 0.4, 3.7);
  buildWall(group, -4.3, 0, 0.4, 6.8, 3.7);
  buildWall(group, 4.3, 0, 0.4, 6.8, 3.7);
  addBox(group, materials.stoneLight, 0, 3.72, -3.55, 9.0, 0.22, 0.6);
  addBox(group, materials.stoneLight, -4.3, 3.72, 0, 0.6, 0.22, 7.0);
  addBox(group, materials.stoneLight, 4.3, 3.72, 0, 0.6, 0.22, 7.0);
  const portal = buildPortal(group);
  const torches = [
    buildTorch(group, -4.02, 1.85, -1.8, Math.PI * 0.5),
    buildTorch(group, -4.02, 1.85, 1.2, Math.PI * 0.5),
    buildTorch(group, 4.02, 1.85, -0.9, -Math.PI * 0.5),
    buildTorch(group, -2.2, 1.9, -3.32, 0),
    buildTorch(group, 3.05, 1.9, -3.32, 0),
  ];
  const desk = buildDesk(group);
  const shelves = buildShelves(group);
  buildCrate(group, -2.15, 0, 2.2, 0.76, 'apples');
  const chest = new THREE.Group();
  chest.position.set(-1.45, 0, -1.75);
  group.add(chest);
  addBox(chest, materials.woodDark, 0, 0.48, 0, 1.65, 0.95, 0.85);
  addBox(chest, materials.woodLight, 0, 0.98, 0, 1.78, 0.12, 0.95);
  addBox(chest, materials.wood, 0, 0.52, 0.46, 1.36, 0.1, 0.06);
  addBox(chest, materials.cropLight, 0, 0.52, 0.5, 0.2, 0.26, 0.05);
  const coffin = buildCoffin(group);
  const lutin = createLutin();
  lutin.position.set(-2.35, 0, 0.25);
  group.add(lutin);
  const lutinHit = new THREE.Mesh(geometry.box, materials.invisible);
  lutinHit.position.set(-2.35, 0.7, 0.25);
  lutinHit.scale.set(0.85, 1.4, 0.8);
  lutinHit.userData.noShadow = true;
  group.add(lutinHit);
  const ground = addGroundPlane(group, 8.3, 6.4, 0.11);
  const runeRing = addTorus(group, materials.greenDark, 1.15, 0.13, -1.8, 1.3, 0.025, Math.PI * 0.5);
  runeRing.userData.noShadow = true;
  setShadowFlags(group);
  return { group, ground, portal, desk, shelves, chest, coffin, lutin, lutinHit, torches, obstacles: [{ x: 2.55, z: 0.15, r: 1.45 }, { x: -3.1, z: 0.15, r: 1.1 }, { x: -2.35, z: 0.25, r: 0.55 }] };
}
