import * as THREE from 'three';
import {
  COLORS,
  addBox,
  addIco,
  addSphere,
  buildBench,
  buildChapel,
  buildCrate,
  buildFire,
  buildHedge,
  buildJackOLantern,
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
} from './kit.js';
import { createDog, createPumpkinFigure, createSkeleton } from './actors.js';

function ribbonPoints(points, width, closed = false) {
  const source = closed ? [...points, points[0]] : points;
  const left = [];
  const right = [];
  const half = width * 0.5;
  for (let i = 0; i < source.length; i += 1) {
    const previous = source[Math.max(0, i - 1)];
    const next = source[Math.min(source.length - 1, i + 1)];
    let dx = next[0] - previous[0];
    let dz = next[1] - previous[1];
    const length = Math.hypot(dx, dz) || 1;
    dx /= length;
    dz /= length;
    const normalX = -dz * half;
    const normalZ = dx * half;
    left.push([source[i][0] + normalX, source[i][1] + normalZ]);
    right.push([source[i][0] - normalX, source[i][1] - normalZ]);
  }
  return left.concat(right.reverse());
}

function addPath(group, points, width, closed = false, cobbleStep = 0.72) {
  flatPolygon(group, ribbonPoints(points, width, closed), materials.dirt, 0.045);
  flatPolygon(group, ribbonPoints(points, Math.max(0.7, width - 0.42), closed), materials.dirtLight, 0.054);
  for (let i = 0; i < points.length; i += 1) {
    const start = points[i];
    const end = points[closed ? (i + 1) % points.length : Math.min(i + 1, points.length - 1)];
    if (closed && i === points.length - 1) continue;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    const count = Math.max(1, Math.floor(length / cobbleStep));
    for (let j = 0; j < count; j += 1) {
      const t = (j + 0.5) / count;
      const x = start[0] + dx * t;
      const z = start[1] + dz * t;
      addIco(group, j % 3 === 0 ? materials.stone : materials.stoneLight, x, 0.098, z, 0.29 + random() * 0.1, 0.085, 0.24 + random() * 0.1, 0, random() * Math.PI, 0);
    }
  }
}

function addLawnPatch(group, material, x, z, width, depth, rotation = 0) {
  const patch = new THREE.Mesh(new THREE.CircleGeometry(1, 14), material);
  patch.scale.set(width, depth, 1);
  patch.rotation.x = -Math.PI * 0.5;
  patch.rotation.z = rotation;
  patch.position.set(x, 0.026, z);
  group.add(patch);
  return patch;
}

function addGrass(group) {
  const grassGeometry = new THREE.ConeGeometry(0.075, 0.38, 3);
  for (let layer = 0; layer < 3; layer += 1) {
    const grass = new THREE.InstancedMesh(grassGeometry, layer === 1 ? materials.oliveLight : materials.olive, 72);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 72; i += 1) {
      dummy.position.set(-10.5 + random() * 21, 0.2, -7.8 + random() * 15.6);
      dummy.rotation.y = random() * Math.PI * 2;
      dummy.rotation.z = (random() - 0.5) * 0.18;
      dummy.scale.set(0.72 + random() * 0.55, 0.68 + random() * 0.72, 0.72 + random() * 0.55);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
    }
    grass.instanceMatrix.needsUpdate = true;
    group.add(grass);
  }
}

function addRock(group, x, z, scale = 1) {
  return addIco(group, materials.stone, x, 0.26 * scale, z, 0.48 * scale, 0.28 * scale, 0.38 * scale, 0, random() * 1.2, 0);
}

function addStandingStone(group, x, z, rotation = 0, scale = 1) {
  const stone = addBox(group, materials.stoneLight, x, 0.72 * scale, z, 0.78 * scale, 1.44 * scale, 0.5 * scale, 0, rotation, (random() - 0.5) * 0.1);
  addBox(group, materials.stoneDark, x, 0.12 * scale, z + 0.03, 1.04 * scale, 0.18 * scale, 0.68 * scale, 0, rotation, 0);
  addIco(group, materials.stone, x - 0.12 * scale, 1.3 * scale, z, 0.22 * scale, 0.18 * scale, 0.18 * scale, 0, rotation, 0);
  return stone;
}

function addObstacle(obstacles, x, z, r) {
  obstacles.push({ x, z, r });
}

function addLeafField(group) {
  const leafMaterial = new THREE.MeshBasicMaterial({ color: COLORS.leafLight, side: THREE.DoubleSide, transparent: true, opacity: 0.72 });
  for (let i = 0; i < 24; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.26), leafMaterial);
    leaf.position.set(-9.2 + random() * 18.4, 1.1 + random() * 4.5, -7.0 + random() * 14.0);
    leaf.rotation.set(random() * 2, random() * 6, random() * 2);
    leaf.userData.phase = random() * 10;
    leaf.userData.speed = 0.18 + random() * 0.22;
    leaf.userData.noShadow = true;
    group.add(leaf);
    leaves.push(leaf);
  }
}

export function buildGraveyard(scene) {
  const group = new THREE.Group();
  group.name = 'Graveyard';
  scene.add(group);
  const bounds = { minX: -11.15, maxX: 11.15, minZ: -8.2, maxZ: 8.35 };
  const obstacles = [];
  const slabPoints = [
    [-11.55, -6.2], [-10.35, -7.45], [-8.4, -8.35], [-6.0, -7.9], [-3.9, -8.55], [-1.6, -8.05],
    [0.9, -8.65], [3.2, -8.15], [5.7, -8.6], [8.0, -7.75], [10.15, -8.05], [11.35, -6.55],
    [11.75, -4.1], [11.25, -1.7], [11.65, 0.8], [11.1, 3.1], [11.4, 5.35], [10.1, 7.0],
    [8.2, 8.15], [6.0, 8.75], [3.55, 8.35], [1.2, 8.9], [-1.1, 8.35], [-3.4, 8.8],
    [-5.8, 8.2], [-7.8, 8.55], [-9.65, 7.0], [-10.95, 5.15], [-11.35, 2.55], [-10.9, 0.2],
    [-11.5, -2.1], [-10.95, -4.25],
  ];
  const slabGeo = new THREE.ExtrudeGeometry(polygonShape(slabPoints), { depth: 0.92, bevelEnabled: false });
  slabGeo.rotateX(-Math.PI * 0.5);
  const slab = new THREE.Mesh(slabGeo, [materials.ground, materials.groundDark]);
  slab.position.y = -0.92;
  group.add(slab);
  flatPolygon(group, slabPoints.map(([x, z]) => [x * 0.997, z * 0.997]), materials.ground, 0.015);
  const edgePoints = slabPoints.map(([x, z]) => new THREE.Vector3(x, 0.07, z));
  const edge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(edgePoints.concat([edgePoints[0].clone()])), new THREE.LineBasicMaterial({ color: 0xb4a66a, transparent: true, opacity: 0.58 }));
  group.add(edge);

  addLawnPatch(group, materials.groundDark, -7.7, -4.8, 3.5, 2.3, 0.18);
  addLawnPatch(group, materials.ground, -3.9, 5.4, 3.2, 1.6, -0.16);
  addLawnPatch(group, materials.groundDark, 3.7, 3.7, 3.5, 1.7, 0.2);
  addLawnPatch(group, materials.ground, 7.7, 2.1, 2.1, 3.2, -0.2);
  addLawnPatch(group, materials.groundDark, 0.1, -5.5, 3.2, 1.4, 0.12);
  addLawnPatch(group, materials.ground, -1.6, 4.8, 2.2, 1.1, -0.28);
  addLawnPatch(group, materials.groundDark, 5.1, 5.5, 2.2, 1.2, 0.25);

  addPath(group, [[-1.1, 8.45], [-0.7, 7.2], [0.1, 5.7], [0.7, 4.2], [0.6, 2.7], [0.25, 1.2], [0.2, 0.1]], 2.55);
  addPath(group, [[0.2, 0.1], [2.1, 0.4], [3.9, 0.3], [5.3, -0.4], [6.7, -1.1], [7.9, -2.5], [8.15, -3.75]], 2.2, false, 0.9);
  addPath(group, [[0.2, 0.1], [-1.7, 1.1], [-3.8, 2.1], [-5.8, 2.5], [-7.7, 1.7]], 2.0, false, 0.95);
  addPath(group, [[0.2, 0.1], [-1.2, -1.8], [-2.8, -2.2], [-3.8, -0.8], [-3.5, 1], [-1.7, 2.7], [0.2, 2.8], [2.2, 1.5], [2.4, -1.4]], 1.55, true, 1.15);
  addPath(group, [[0.2, 0.1], [1.8, 2.2], [2.7, 4.2], [4.2, 5.7], [6.4, 6.6], [7.8, 7.2]], 1.85, false, 0.95);
  addPath(group, [[6.7, -1.1], [8.35, -1.9], [8.3, -3.5], [8.2, -4.35]], 1.7, false, 0.95);
  addPath(group, [[8.5, -2.1], [9.8, -3.0], [10.15, -5.2]], 1.55, false, 0.95);
  addPath(group, [[-7.7, 1.7], [-8.9, 0.2], [-9.3, -1.6]], 1.45, false, 1.0);
  addGrass(group);

  buildStoneLantern(group, -2.55, 7.4, 0.78);
  buildStoneLantern(group, 2.45, 7.35, 0.78);
  buildStoneLantern(group, -5.75, 4.15, 0.9);
  buildStoneLantern(group, -9.05, 2.55, 0.82);
  buildStoneLantern(group, -6.25, -2.8, 0.78);
  buildStoneLantern(group, 5.15, 1.05, 0.84);
  buildStoneLantern(group, 7.45, 6.15, 0.72);
  addObstacle(obstacles, -2.55, 7.4, 0.48);
  addObstacle(obstacles, 2.45, 7.35, 0.48);
  addObstacle(obstacles, -5.75, 4.15, 0.52);
  addObstacle(obstacles, -9.05, 2.55, 0.48);
  addObstacle(obstacles, -6.25, -2.8, 0.46);
  addObstacle(obstacles, 5.15, 1.05, 0.48);
  addObstacle(obstacles, 7.45, 6.15, 0.42);

  const treeSpecs = [
    [-8.8, 4.45, 1.06, true], [-9.45, 0.65, 0.94, true], [-7.55, -1.65, 1.02, true], [-9.0, -4.1, 0.88, true],
    [-4.85, 6.55, 0.88, true], [3.55, 6.55, 0.86, true], [9.25, 5.9, 0.98, true], [-4.15, -6.8, 0.86, true],
    [-0.7, -7.35, 0.78, true], [3.0, -7.05, 0.9, true], [6.0, -7.0, 0.82, true], [10.25, 1.8, 0.72, true],
  ];
  treeSpecs.forEach(([x, z, scale, burgundy], index) => {
    buildTree(group, x, z, { burgundy, scale, rotation: (random() - 0.5) * 0.5 + index * 0.07 });
    addObstacle(obstacles, x, z, 0.64 * scale);
  });

  const pumpkinSpots = [[-6.45, 3.25, 0.72], [-7.65, 1.15, 0.66], [-8.55, -0.72, 0.62], [-5.95, -0.32, 0.58], [-9.35, -2.7, 0.55]];
  pumpkinSpots.forEach(([x, z, scale], index) => {
    const pumpkin = buildJackOLantern(group, x, 0, z, scale);
    pumpkin.group.rotation.y = index % 2 ? 0.15 : -0.2;
    addObstacle(obstacles, x, z, 0.34 * scale);
  });
  buildHedge(group, -7.35, 2.75, 1.8, 0.62, 0.62, -0.12);
  buildHedge(group, -8.25, -1.35, 1.7, 0.65, 0.68, 0.18);
  buildHedge(group, -6.45, -2.15, 1.55, 0.6, 0.58, -0.25);
  buildHedge(group, 3.9, 4.15, 2.3, 0.7, 0.62, 0.06);
  buildHedge(group, 7.45, 3.7, 1.6, 0.62, 0.58, -0.12);

  const graveSpots = [
    [-3.2, 5.35, 0.7, 0.1], [-2.75, 0.75, 0.82, -0.2], [-2.05, -2.15, 0.74, 0.18], [1.9, -2.15, 0.78, -0.12],
    [3.0, 0.85, 0.8, 0.16], [-1.2, 2.85, 0.7, -0.08], [2.25, 2.55, 0.75, 0.12],
  ];
  graveSpots.forEach(([x, z, scale, rotation], index) => {
    buildTombstone(group, x, z, { rotation, scale, material: index % 2 ? materials.stone : materials.stoneLight });
    addObstacle(obstacles, x, z, 0.42 * scale);
  });
  const zozoGrave = new THREE.Group();
  zozoGrave.position.set(0.1, 0, 0.05);
  group.add(zozoGrave);
  buildTombstone(zozoGrave, 0, 0, { rotation: 0.02, scale: 1.18, width: 1.0, height: 1.58, material: materials.stoneLight, flower: true });
  addSphere(zozoGrave, materials.boneLight, -0.18, 0.16, 0.46, 0.13, 0.07, 0.055);
  addSphere(zozoGrave, materials.boneLight, 0.12, 0.16, 0.46, 0.13, 0.07, 0.055);
  addSphere(zozoGrave, materials.boneLight, -0.03, 0.15, 0.4, 0.09, 0.055, 0.05);
  addBox(zozoGrave, materials.burgundy, 0, 0.92, 0.16, 0.42, 0.06, 0.03, 0, 0, 0.02);
  const graveHit = new THREE.Mesh(geometry.box, materials.invisible);
  graveHit.position.set(0, 0.72, 0.35);
  graveHit.scale.set(1.55, 1.55, 0.62);
  graveHit.userData.noShadow = true;
  zozoGrave.add(graveHit);
  addObstacle(obstacles, 0.1, 0.05, 0.72);

  addStandingStone(group, -4.2, 0.2, 0.12, 1.05);
  addStandingStone(group, 4.05, 1.15, -0.18, 0.95);
  addStandingStone(group, -4.05, -1.55, 0.05, 0.86);
  addObstacle(obstacles, -4.2, 0.2, 0.52);
  addObstacle(obstacles, 4.05, 1.15, 0.5);
  addObstacle(obstacles, -4.05, -1.55, 0.48);
  [[-5.15, -3.75], [-3.45, -4.5], [3.45, -3.0], [4.3, -4.0], [5.7, 2.65], [-6.7, 5.0]].forEach(([x, z], index) => {
    addRock(group, x, z, 0.7 + (index % 3) * 0.12);
    addObstacle(obstacles, x, z, 0.35 + (index % 3) * 0.06);
  });

  const fire = buildFire(group, 6.5, -0.9);
  const fireHit = new THREE.Mesh(geometry.box, materials.invisible);
  fireHit.position.set(0, 0.82, 0);
  fireHit.scale.set(2.45, 1.65, 2.45);
  fireHit.userData.noShadow = true;
  fire.group.add(fireHit);
  addObstacle(obstacles, 6.5, -0.9, 1.18);

  const skeleton = createSkeleton({ scale: 0.82 });
  skeleton.position.set(5.35, 0.02, -1.72);
  skeleton.rotation.y = 0.85;
  group.add(skeleton);
  const skeletonHit = new THREE.Mesh(geometry.box, materials.invisible);
  skeletonHit.position.set(0, 1.05, 0);
  skeletonHit.scale.set(1.0, 2.35, 0.85);
  skeletonHit.userData.noShadow = true;
  skeleton.add(skeletonHit);
  addObstacle(obstacles, 5.35, -1.72, 0.58);

  buildBench(group, 8.15, -1.8);
  addObstacle(obstacles, 8.15, -1.8, 0.86);
  buildCrate(group, 4.65, 0, -2.9, 0.72, 'pumpkins');
  addObstacle(obstacles, 4.65, -2.9, 0.55);
  const house = buildChapel(group, 8.2, -5.3, 0);
  addObstacle(obstacles, 8.2, -5.3, 2.0);

  const pumpkinFigure = createPumpkinFigure();
  pumpkinFigure.position.set(-9.25, 0.02, -3.25);
  pumpkinFigure.rotation.y = 0.35;
  group.add(pumpkinFigure);
  addObstacle(obstacles, -9.25, -3.25, 0.55);

  const orchardFenceA = buildWoodFence(group, 2.35, 7.55, 3.2, 0);
  const orchardFenceB = buildWoodFence(group, 6.85, 7.6, 2.8, 0);
  addObstacle(obstacles, 2.35, 7.55, 0.6);
  addObstacle(obstacles, 6.85, 7.6, 0.58);
  buildCrate(group, 5.05, 0, 6.75, 0.82, 'apples');
  addObstacle(obstacles, 5.05, 6.75, 0.62);

  const dog = createDog();
  dog.position.set(1.5, 0.02, 1.35);
  dog.rotation.y = -0.5;
  group.add(dog);
  const dogHit = new THREE.Mesh(geometry.box, materials.invisible);
  dogHit.position.set(0, 0.58, 0.15);
  dogHit.scale.set(1.05, 1.25, 1.55);
  dogHit.userData.noShadow = true;
  dog.add(dogHit);

  const ground = new THREE.Mesh(geometry.plane, materials.invisible);
  ground.scale.set(24.2, 19.2, 1);
  ground.rotation.x = -Math.PI * 0.5;
  ground.position.y = 0.08;
  ground.userData.ground = true;
  ground.userData.noShadow = true;
  group.add(ground);
  addLeafField(group);
  setShadowFlags(group);
  return {
    group,
    ground,
    bounds,
    obstacles,
    fire,
    fireHit,
    skeleton,
    skeletonHit,
    dog,
    dogHit,
    graveHit,
    hit: { location: group, radius: 2.5, type: 'grave', label: "Zozo's grave" },
    grave: zozoGrave,
    house,
    orchardFenceA,
    orchardFenceB,
    pumpkinFigure,
  };
}
