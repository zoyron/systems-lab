import * as THREE from 'three';
import {
  COLORS,
  addBox,
  addCone,
  addCylinder,
  addGroundPlane,
  addIco,
  addSphere,
  addTorus,
  buildBench,
  buildChapel,
  buildCrate,
  buildFire,
  buildHedge,
  buildLanternFruit,
  buildStoneLantern,
  buildTombstone,
  buildTree,
  buildWoodFence,
  flatPolygon,
  geometry,
  leaves,
  materials,
  polygonShape,
  random,
  setShadowFlags,
  standardMaterial,
} from './kit.js';
import { createDog, createSkeleton } from './actors.js';

export function buildGraveyard(scene) {
  const group = new THREE.Group();
  group.name = 'Graveyard';
  scene.add(group);
  const slabPoints = [
    [-7.75, -5.9], [-7.25, -6.35], [-5.7, -6.2], [-4.2, -6.45], [-2.4, -6.22], [-0.7, -6.38],
    [1.15, -6.1], [3.1, -6.28], [5.0, -6.0], [6.55, -5.72], [7.55, -4.65], [7.75, -2.8],
    [7.55, -0.8], [7.82, 1.1], [7.35, 3.1], [6.55, 4.5], [4.8, 5.35], [2.85, 5.55],
    [0.8, 5.35], [-1.1, 5.62], [-3.0, 5.35], [-4.75, 5.55], [-6.25, 4.85], [-7.35, 3.4],
    [-7.7, 1.6], [-7.48, -0.4], [-7.78, -2.5],
  ];
  const slabGeo = new THREE.ExtrudeGeometry(polygonShape(slabPoints), { depth: 0.9, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI * 0.5);
  const slab = new THREE.Mesh(slabGeo, [materials.ground, materials.stoneDark]);
  slab.position.y = -0.9;
  group.add(slab);
  flatPolygon(group, slabPoints.map(([x, z]) => [x * 0.995, z * 0.995]), materials.ground, 0.015);
  const edgePoints = slabPoints.map(([x, z]) => new THREE.Vector3(x, 0.06, z));
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints.concat([edgePoints[0].clone()])), new THREE.LineBasicMaterial({ color: 0x77704a, transparent: true, opacity: 0.45 }));
  group.add(edge);
  const patchA = standardMaterial(0x3b472f, { roughness: 1 });
  const patchB = standardMaterial(0x5b5635, { roughness: 1 });
  const patches = [[-5.9, -3.5, 2.3, 1.2, 0.2], [-4.6, 2.8, 2.6, 1.4, -0.3], [-2.1, -4.2, 2.6, 1.15, 0.4], [1.8, 3.7, 3.1, 1.5, -0.15], [5.7, 2.1, 1.7, 2.2, 0.2], [5.2, -1.5, 1.7, 1.8, -0.4], [0.4, -4.7, 2.3, 0.75, 0.1]];
  patches.forEach(([x, z, sx, sz, rotation], index) => {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 12), index % 2 ? patchA : patchB);
    patch.scale.set(sx, sz, 1);
    patch.rotation.x = -Math.PI * 0.5;
    patch.rotation.z = rotation;
    patch.position.set(x, 0.025, z);
    group.add(patch);
  });
  const pathPoints = [[-3.55, 3.65], [-2.25, 3.35], [-1.45, 2.4], [-0.75, 1.45], [-0.3, 0.45], [0.35, -0.4], [0.6, -1.25], [1.55, -2.25], [2.25, -3.4], [3.15, -4.35], [3.95, -4.45], [4.55, -4.1], [3.6, -3.75], [2.75, -2.75], [2.0, -1.6], [1.35, -0.55], [0.95, 0.45], [0.45, 1.5], [-0.35, 2.55], [-1.1, 3.25], [-2.1, 4.05], [-3.0, 4.0]];
  flatPolygon(group, pathPoints, materials.dirt, 0.045);
  flatPolygon(group, pathPoints.map(([x, z]) => [x * 0.94, z * 0.94]), materials.dirtLight, 0.052);
  const cobblePositions = [[-2.2, 3.1], [-1.7, 2.75], [-1.2, 2.25], [-0.82, 1.6], [-0.42, 0.92], [-0.05, 0.28], [0.25, -0.35], [0.52, -0.96], [0.92, -1.55], [1.42, -2.1], [1.98, -2.8], [2.55, -3.55], [3.1, -4.05], [3.8, -4.3], [0.7, 0.5], [-0.3, 1.2], [-1.0, 1.9], [0.4, -0.2]];
  cobblePositions.forEach(([x, z], index) => addIco(group, index % 3 ? materials.stoneLight : materials.stone, x, 0.095, z, 0.33 + random() * 0.12, 0.09, 0.27 + random() * 0.1, 0, random() * 2, 0));
  const grassGeometry = new THREE.ConeGeometry(0.075, 0.38, 3);
  for (let layer = 0; layer < 3; layer += 1) {
    const grass = new THREE.InstancedMesh(grassGeometry, layer === 1 ? materials.oliveLight : materials.olive, 48);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 48; i += 1) {
      dummy.position.set(-6.9 + random() * 13.8, 0.2, -5.35 + random() * 10.6);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.rotation.z = (random() - 0.5) * 0.18;
      dummy.scale.set(0.75 + random() * 0.5, 0.7 + random() * 0.65, 0.75 + random() * 0.5);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    group.add(grass);
  }
  for (let i = 0; i < 6; i += 1) {
    const z = -5.0 + i * 1.8;
    addBox(group, materials.stoneDark, -7.0, 0.65, z, 0.52, 1.3, 1.58);
    addBox(group, materials.stone, -6.7, 1.2, z, 0.12, 0.18, 1.75);
    if (i % 2 === 0) addIco(group, materials.stoneLight, -7.0, 1.35, z, 0.34, 0.2, 0.55);
  }
  for (let i = 0; i < 4; i += 1) {
    const z = -4.8 + i * 2.5;
    addBox(group, materials.stone, -6.68, 1.0, z, 0.55, 2.0, 0.42);
    addTorus(group, materials.stoneLight, -6.68, 1.92, z, 0.64, 0.14, 0, Math.PI * 0.5, 0);
  }
  buildHedge(group, -5.8, -1.8, 3.1, 0.8, 0.85, 0.1);
  buildHedge(group, -5.8, 1.0, 3.0, 0.8, 0.8, -0.08);
  buildHedge(group, 3.2, 3.95, 3.0, 0.8, 0.7, -0.12);
  buildTree(group, -5.7, 3.65, { burgundy: true, scale: 1.08, rotation: 0.4 });
  buildTree(group, -6.0, -3.5, { dead: true, scale: 0.95, lean: -0.08, rotation: -0.5 });
  buildTree(group, 5.9, 3.6, { burgundy: true, scale: 0.9, rotation: -0.5 });
  buildTree(group, 6.5, -0.7, { dead: true, scale: 0.78, rotation: 0.8, lean: 0.08 });
  buildTree(group, 1.8, -5.1, { burgundy: true, scale: 0.72, rotation: 0.2 });
  buildChapel(group);
  for (let i = 0; i < 5; i += 1) {
    addCylinder(group, materials.crop, 3.0 + i * 0.22, 0.45, -1.9 - (i % 2) * 0.28, 0.045, 0.8, 0, 0, (i - 2) * 0.06);
    addCone(group, i % 2 ? materials.cropLight : materials.crop, 3.0 + i * 0.22, 0.94, -1.9 - (i % 2) * 0.28, 0.12, 0.25);
  }
  for (let i = 0; i < 3; i += 1) addCylinder(group, materials.cropLight, 4.0 + i * 0.18, 0.6, 1.9, 0.035, 1.05, 0, 0, (i - 1) * 0.12);
  buildStoneLantern(group, -4.8, 2.35, 0.9);
  buildStoneLantern(group, -3.2, -2.7, 0.78);
  buildStoneLantern(group, 5.75, 0.6, 0.85);
  buildStoneLantern(group, 3.35, -3.5, 0.72);
  buildWoodFence(group, -4.8, -5.05, 3.1, 0);
  buildWoodFence(group, 5.85, 4.4, 2.5, -0.12);
  buildCrate(group, 2.15, 0, 2.65, 0.72, 'pumpkins');
  buildCrate(group, 4.85, 0, 3.9, 0.62, 'pumpkins');
  buildLanternFruit(group, -2.65, 0.02, 1.28, 0.62);
  buildLanternFruit(group, -3.55, 0.02, -1.55, 0.54);
  buildLanternFruit(group, 3.0, 0.02, 3.8, 0.48);
  buildLanternFruit(group, 6.2, 0.02, 1.15, 0.52);
  const graveLocations = [[-4.7, -0.9], [-3.1, 0.1], [2.8, 1.0], [4.1, -0.1], [5.25, 1.2], [-1.1, 3.6], [1.2, -3.8]];
  graveLocations.forEach(([x, z], index) => buildTombstone(group, x, z, { rotation: (random() - 0.5) * 0.25, scale: 0.72 + random() * 0.2, material: index % 2 ? materials.stone : materials.stoneLight }));
  buildTombstone(group, -1.65, 0.35, { rotation: 0.08, scale: 1.2, width: 0.9, height: 1.5, material: materials.stoneLight, flower: true });
  addSphere(group, materials.boneLight, -1.8, 0.16, 0.65, 0.12, 0.07, 0.05);
  addSphere(group, materials.boneLight, -1.48, 0.16, 0.65, 0.12, 0.07, 0.05);
  addSphere(group, materials.boneLight, -1.64, 0.15, 0.53, 0.08, 0.05, 0.05);
  const graveHit = new THREE.Mesh(geometry.box, materials.invisible);
  graveHit.position.set(-1.65, 0.65, 0.48);
  graveHit.scale.set(1.35, 1.35, 0.55);
  graveHit.userData.noShadow = true;
  group.add(graveHit);
  const fire = buildFire(group, 4.6, -2.15);
  const skeleton = createSkeleton({ scale: 0.78 });
  skeleton.position.set(3.55, 0.02, -2.55);
  skeleton.rotation.y = 0.55;
  group.add(skeleton);
  const dog = createDog();
  dog.position.set(0.2, 0.02, 0.95);
  dog.rotation.y = -0.5;
  group.add(dog);
  buildBench(group, -4.1, 0.15);
  const ground = addGroundPlane(group, 15.6, 12.4, 0.075);
  const leafMaterial = new THREE.MeshBasicMaterial({ color: COLORS.leafLight, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  for (let i = 0; i < 18; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), leafMaterial);
    leaf.position.set(-6.3 + random() * 12.2, 1.1 + random() * 4.1, -5.1 + random() * 10.3);
    leaf.rotation.set(random() * 2, random() * 6, random() * 2);
    leaf.userData.phase = random() * 10;
    leaf.userData.speed = 0.18 + random() * 0.22;
    group.add(leaf);
    leaves.push(leaf);
  }
  setShadowFlags(group);
  return { group, ground, fire, skeleton, dog, graveHit, hit: { location: group, radius: 2.35, type: 'grave', label: "Zozo's grave" }, obstacles: [{ x: -1.65, z: 0.45, r: 0.62 }, { x: 4.6, z: -2.15, r: 1.1 }, { x: 4.45, z: -4.35, r: 2.2 }] };
}
