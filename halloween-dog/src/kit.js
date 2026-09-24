import * as THREE from 'three';

export const COLORS = {
  void: 0x050505,
  ground: 0x4b4a32,
  groundDark: 0x353a29,
  dirt: 0x67503a,
  dirtLight: 0x846a48,
  stone: 0x51585a,
  stoneLight: 0x737977,
  stoneDark: 0x303537,
  wood: 0x55382a,
  woodLight: 0x815a39,
  woodDark: 0x2d211d,
  burgundy: 0x672e3a,
  red: 0x913f38,
  leaf: 0x7d3540,
  leafLight: 0xa34d45,
  olive: 0x536044,
  oliveLight: 0x697253,
  crop: 0xb18b3f,
  cropLight: 0xd0a24e,
  orange: 0xd36b2b,
  orangeLight: 0xf19a39,
  bone: 0xd8d0b7,
  boneLight: 0xf0e7cb,
  ghost: 0xe9e8d9,
  black: 0x101112,
  green: 0x48f28a,
  greenDark: 0x123b2b,
  purple: 0x6b446e,
  apple: 0xa9382f,
};

export const UP = new THREE.Vector3(0, 1, 0);
export const fireSystems = [];
export const lanternSystems = [];
export const embers = [];
export const leaves = [];

let seed = 1776;
export function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function easeInOut(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function standardMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0,
    flatShading: true,
    ...options,
  });
}

export function glowMaterial(color, opacity = 0.8, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

export function invisibleMaterial() {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export const materials = {
  ground: standardMaterial(COLORS.ground, { roughness: 1 }),
  groundDark: standardMaterial(COLORS.groundDark, { roughness: 1 }),
  dirt: standardMaterial(COLORS.dirt, { roughness: 1 }),
  dirtLight: standardMaterial(COLORS.dirtLight, { roughness: 1 }),
  stone: standardMaterial(COLORS.stone, { roughness: 0.95 }),
  stoneLight: standardMaterial(COLORS.stoneLight, { roughness: 0.92 }),
  stoneDark: standardMaterial(COLORS.stoneDark, { roughness: 1 }),
  wood: standardMaterial(COLORS.wood, { roughness: 0.95 }),
  woodLight: standardMaterial(COLORS.woodLight, { roughness: 0.92 }),
  woodDark: standardMaterial(COLORS.woodDark, { roughness: 1 }),
  burgundy: standardMaterial(COLORS.burgundy, { roughness: 0.96 }),
  red: standardMaterial(COLORS.red, { roughness: 0.94 }),
  leaf: standardMaterial(COLORS.leaf, { roughness: 0.98 }),
  leafLight: standardMaterial(COLORS.leafLight, { roughness: 0.96 }),
  olive: standardMaterial(COLORS.olive, { roughness: 1 }),
  oliveLight: standardMaterial(COLORS.oliveLight, { roughness: 1 }),
  crop: standardMaterial(COLORS.crop, { roughness: 0.98 }),
  cropLight: standardMaterial(COLORS.cropLight, { roughness: 0.96 }),
  orange: standardMaterial(COLORS.orange, { roughness: 0.78 }),
  orangeLight: standardMaterial(COLORS.orangeLight, { roughness: 0.72 }),
  bone: standardMaterial(COLORS.bone, { roughness: 0.92 }),
  boneLight: standardMaterial(COLORS.boneLight, { roughness: 0.88 }),
  ghost: standardMaterial(COLORS.ghost, { roughness: 0.82, emissive: 0x4c5a55, emissiveIntensity: 0.16 }),
  black: standardMaterial(COLORS.black, { roughness: 1 }),
  green: standardMaterial(COLORS.green, { roughness: 0.4, emissive: COLORS.green, emissiveIntensity: 3.2 }),
  greenDark: standardMaterial(COLORS.greenDark, { roughness: 0.7, emissive: 0x1b6a3f, emissiveIntensity: 0.7 }),
  purple: standardMaterial(COLORS.purple, { roughness: 0.9 }),
  apple: standardMaterial(COLORS.apple, { roughness: 0.62 }),
  window: glowMaterial(0xf0a347, 0.5),
  greenGlow: glowMaterial(COLORS.green, 0.62),
  orangeGlow: glowMaterial(COLORS.orangeLight, 0.75),
  fire: glowMaterial(COLORS.orangeLight, 0.92),
  fireCore: glowMaterial(0xffe19a, 0.96),
  invisible: invisibleMaterial(),
};

export const geometry = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 8),
  sphere: new THREE.SphereGeometry(1, 18, 12),
  ico: new THREE.IcosahedronGeometry(1, 1),
  lowSphere: new THREE.SphereGeometry(1, 10, 7),
  plane: new THREE.PlaneGeometry(1, 1),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 20),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 8),
};

export function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.rotation.set(rx, ry, rz);
  parent.add(mesh);
  return mesh;
}

export function addBox(parent, mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  return addMesh(parent, geometry.box, mat, x, y, z, sx, sy, sz, rx, ry, rz);
}

export function addCylinder(parent, mat, x, y, z, radius, height, rx = 0, ry = 0, rz = 0) {
  return addMesh(parent, geometry.cylinder, mat, x, y, z, radius, height, radius, rx, ry, rz);
}

export function addCone(parent, mat, x, y, z, radius, height, rx = 0, ry = 0, rz = 0) {
  return addMesh(parent, geometry.cone, mat, x, y, z, radius, height, radius, rx, ry, rz);
}

export function addSphere(parent, mat, x, y, z, sx, sy = sx, sz = sx) {
  return addMesh(parent, geometry.sphere, mat, x, y, z, sx, sy, sz);
}

export function addIco(parent, mat, x, y, z, sx, sy = sx, sz = sx) {
  return addMesh(parent, geometry.ico, mat, x, y, z, sx, sy, sz);
}

export function addTorus(parent, mat, x, y, z, radius, tube, rx = 0, ry = 0, rz = 0) {
  return addMesh(parent, geometry.torus, mat, x, y, z, radius, tube, radius, rx, ry, rz);
}

export function addGlowSphere(parent, mat, x, y, z, radius) {
  return addSphere(parent, mat, x, y, z, radius, radius, radius);
}

export function addCylinderBetween(parent, mat, a, b, radius) {
  const start = new THREE.Vector3(a[0], a[1], a[2]);
  const end = new THREE.Vector3(b[0], b[1], b[2]);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const mesh = addCylinder(parent, mat, (a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5, radius, length);
  direction.normalize();
  mesh.quaternion.setFromUnitVectors(UP, direction);
  return mesh;
}

export function polygonShape(points) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i][0], points[i][1]);
  shape.closePath();
  return shape;
}

export function flatPolygon(parent, points, material, y) {
  const geo = new THREE.ShapeGeometry(polygonShape(points));
  geo.rotateX(-Math.PI * 0.5);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  parent.add(mesh);
  return mesh;
}

export function roundedShape(width, height, radius) {
  const shape = new THREE.Shape();
  const w = width * 0.5;
  const h = height * 0.5;
  const r = Math.min(radius, w, h);
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

export function roundedBoxGeometry(width, height, depth, radius = 0.12) {
  const geo = new THREE.ExtrudeGeometry(roundedShape(width, height, radius), {
    depth,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(radius * 0.32, 0.06),
    bevelThickness: Math.min(radius * 0.32, 0.06),
    curveSegments: 4,
  });
  geo.translate(0, 0, -depth * 0.5);
  return geo;
}

export function setShadowFlags(root) {
  root.traverse((object) => {
    if (!object.isMesh || object.userData.noShadow) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

export function addPointLight(parent, color, intensity, distance, x, y, z) {
  const light = new THREE.PointLight(color, intensity, distance, 2);
  light.position.set(x, y, z);
  parent.add(light);
  return light;
}

export function addGroundPlane(parent, width, depth, y) {
  const plane = new THREE.Mesh(geometry.plane, materials.invisible);
  plane.scale.set(width, depth, 1);
  plane.rotation.x = -Math.PI * 0.5;
  plane.position.y = y;
  plane.userData.ground = true;
  plane.userData.noShadow = true;
  parent.add(plane);
  return plane;
}

export function createSmokeTexture() {
  const smokeCanvas = document.createElement('canvas');
  smokeCanvas.width = 64;
  smokeCanvas.height = 64;
  const context = smokeCanvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(255,255,255,0.65)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.25)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(smokeCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildStoneLantern(parent, x, z, scale = 1, warm = true) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  parent.add(group);
  addBox(group, materials.stoneDark, 0, 0.12, 0, 0.7, 0.24, 0.7, 0, 0.08, 0);
  addBox(group, materials.stone, 0, 0.48, 0, 0.42, 0.5, 0.42, 0, 0.12, 0);
  addBox(group, materials.stoneLight, 0, 0.82, 0, 0.62, 0.15, 0.62, 0, -0.12, 0);
  addBox(group, materials.stoneDark, 0, 1.08, 0, 0.48, 0.4, 0.48, 0, 0.08, 0);
  addBox(group, materials.stoneLight, 0, 1.36, 0, 0.72, 0.16, 0.72, 0, -0.08, 0);
  addCone(group, materials.stoneDark, 0, 1.56, 0, 0.42, 0.35, 0, Math.PI, 0);
  const core = addGlowSphere(group, warm ? materials.orangeGlow : materials.greenGlow, 0, 0.83, 0, 0.22);
  core.userData.noShadow = true;
  const light = warm ? addPointLight(group, 0xffa24d, 5.2, 7, 0, 0.9, 0) : addPointLight(group, COLORS.green, 4.5, 6, 0, 0.9, 0);
  light.userData.baseIntensity = light.intensity;
  light.userData.phase = random() * 6.28;
  lanternSystems.push(light);
  return { group, light, core };
}

export function buildHedge(parent, x, z, width = 2.6, depth = 0.9, height = 0.75, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  parent.add(group);
  const count = Math.max(3, Math.round(width * 2.1));
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    addIco(group, i % 3 === 0 ? materials.oliveLight : materials.olive, (t - 0.5) * width, height * (0.47 + random() * 0.16), (random() - 0.5) * depth, width / count * 0.85, height * 0.65, depth * 0.78);
  }
  return group;
}

export function buildTree(parent, x, z, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = options.rotation || random() * 0.4;
  group.scale.setScalar(options.scale || 1);
  parent.add(group);
  const trunkMat = options.dead ? materials.woodDark : materials.wood;
  addCylinder(group, trunkMat, 0, 1.65, 0, 0.18, 3.3, 0, 0, options.lean || 0);
  addCylinderBetween(group, trunkMat, [0, 2.2, 0], [0.8, 3.35, 0.05], 0.1);
  addCylinderBetween(group, trunkMat, [0, 2.55, 0], [-0.75, 3.55, 0.04], 0.09);
  addCylinderBetween(group, trunkMat, [0.2, 2.75, 0], [0.25, 4.1, 0], 0.07);
  if (!options.dead) {
    const foliage = options.burgundy ? materials.burgundy : materials.leaf;
    const foliageLight = options.burgundy ? materials.red : materials.leafLight;
    const clusters = [[0.2, 3.35, 0, 1.15, 0.9, 0.95], [-0.8, 3.25, 0.05, 0.9, 0.72, 0.8], [0.85, 3.65, 0.02, 0.95, 0.78, 0.86], [0.2, 4.0, 0.12, 0.8, 0.72, 0.74], [-0.3, 3.7, -0.25, 0.9, 0.75, 0.75]];
    clusters.forEach((cluster, index) => addIco(group, index % 2 ? foliageLight : foliage, ...cluster));
  } else {
    addCylinderBetween(group, trunkMat, [0.8, 3.35, 0.05], [1.4, 3.85, 0.08], 0.05);
    addCylinderBetween(group, trunkMat, [-0.75, 3.55, 0.04], [-1.25, 4.0, 0.04], 0.045);
  }
  return group;
}

export function buildTombstone(parent, x, z, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = options.rotation || 0;
  group.scale.setScalar(options.scale || 1);
  parent.add(group);
  const width = options.width || 0.78;
  const height = options.height || 1.25;
  const shape = new THREE.Shape();
  shape.moveTo(-width * 0.5, 0);
  shape.lineTo(width * 0.5, 0);
  shape.lineTo(width * 0.5, height * 0.67);
  shape.quadraticCurveTo(width * 0.48, height * 0.95, 0, height);
  shape.quadraticCurveTo(-width * 0.48, height * 0.95, -width * 0.5, height * 0.67);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.035, curveSegments: 5 });
  geo.translate(0, 0, -0.11);
  const stone = new THREE.Mesh(geo, options.material || materials.stoneLight);
  group.add(stone);
  if (options.cross !== false) {
    addBox(group, materials.stoneDark, 0, height * 0.55, 0.125, 0.12, 0.5, 0.035);
    addBox(group, materials.stoneDark, 0, height * 0.58, 0.13, 0.38, 0.1, 0.035);
  }
  if (options.flower) {
    addSphere(group, materials.red, -0.22, 0.11, 0.15, 0.12, 0.1, 0.08);
    addSphere(group, materials.orangeLight, -0.08, 0.1, 0.15, 0.09, 0.08, 0.07);
  }
  return group;
}

export function buildWoodFence(parent, x, z, length, rotation = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  parent.add(group);
  const posts = Math.max(2, Math.round(length / 1.15));
  for (let i = 0; i < posts; i += 1) {
    const px = (i / (posts - 1) - 0.5) * length;
    addBox(group, materials.wood, px, 0.65, 0, 0.14, 1.3, 0.14, 0, 0, (random() - 0.5) * 0.06);
  }
  addBox(group, materials.woodLight, 0, 0.55, 0.02, length, 0.12, 0.12);
  addBox(group, materials.woodLight, 0, 1.0, 0.02, length, 0.12, 0.12);
  return group;
}

export function buildCrate(parent, x, y, z, scale = 1, produce = null) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  addBox(group, materials.woodDark, 0, 0.42, 0, 1.25, 0.84, 0.95);
  addBox(group, materials.wood, 0, 0.42, 0.49, 1.34, 0.12, 0.1);
  addBox(group, materials.wood, 0, 0.42, -0.49, 1.34, 0.12, 0.1);
  addBox(group, materials.woodLight, -0.62, 0.42, 0, 0.1, 0.9, 1.02);
  addBox(group, materials.woodLight, 0.62, 0.42, 0, 0.1, 0.9, 1.02);
  addBox(group, materials.woodLight, 0, 0.83, 0, 1.34, 0.1, 1.02);
  if (produce === 'apples') {
    for (let i = 0; i < 9; i += 1) addSphere(group, materials.apple, (random() - 0.5) * 0.82, 0.92 + random() * 0.14, (random() - 0.5) * 0.56, 0.12, 0.12, 0.12);
  } else if (produce === 'pumpkins') {
    for (let i = 0; i < 4; i += 1) addSphere(group, i % 2 ? materials.orange : materials.orangeLight, (i - 1.5) * 0.28, 0.93, (random() - 0.5) * 0.35, 0.25, 0.22, 0.25);
  }
  return group;
}

export function buildLanternFruit(parent, x, y, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  parent.add(group);
  addSphere(group, materials.orange, 0, 0.22, 0, 0.48, 0.43, 0.48);
  addCylinder(group, materials.woodDark, 0, 0.69, 0, 0.08, 0.22);
  addSphere(group, materials.black, -0.16, 0.3, 0.43, 0.08, 0.12, 0.035);
  addSphere(group, materials.black, 0.16, 0.3, 0.43, 0.08, 0.12, 0.035);
  addSphere(group, materials.black, 0, 0.1, 0.45, 0.18, 0.08, 0.035);
  return group;
}

export function buildFire(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  parent.add(group);
  addTorus(group, materials.stoneDark, 0, 0.22, 0, 0.86, 0.16, Math.PI * 0.5);
  for (let i = 0; i < 11; i += 1) {
    const angle = (i / 11) * Math.PI * 2;
    addIco(group, i % 2 ? materials.stone : materials.stoneLight, Math.cos(angle) * 0.87, 0.27, Math.sin(angle) * 0.87, 0.25, 0.22, 0.25, 0, angle, 0);
  }
  addCylinderBetween(group, materials.woodDark, [-0.5, 0.35, -0.18], [0.48, 0.37, 0.18], 0.12);
  addCylinderBetween(group, materials.wood, [-0.46, 0.42, 0.22], [0.46, 0.4, -0.22], 0.11);
  const flameGroup = new THREE.Group();
  flameGroup.position.y = 0.35;
  group.add(flameGroup);
  const flameBase = addCone(flameGroup, materials.fire, 0, 0.65, 0, 0.52, 1.45);
  flameBase.scale.z = 0.72;
  const flameMid = addCone(flameGroup, materials.orangeGlow, -0.12, 0.46, 0.05, 0.34, 1.1, 0, 0, -0.08);
  flameMid.scale.z = 0.66;
  const flameCore = addCone(flameGroup, materials.fireCore, 0.04, 0.3, 0.02, 0.2, 0.76);
  flameCore.scale.z = 0.6;
  const light = addPointLight(group, 0xff8c38, 14, 10, 0, 1.1, 0);
  light.userData.baseIntensity = 14;
  light.userData.phase = 0.7;
  const smoke = [];
  const smokeTexture = createSmokeTexture();
  for (let i = 0; i < 13; i += 1) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture, color: 0x24211f, transparent: true, opacity: 0.22, depthWrite: false }));
    sprite.position.set((random() - 0.5) * 0.5, 1.3 + random() * 4.6, (random() - 0.5) * 0.5);
    sprite.scale.setScalar(0.5 + random() * 0.55);
    sprite.userData.phase = random() * 5.2;
    sprite.userData.speed = 0.22 + random() * 0.16;
    sprite.userData.drift = (random() - 0.5) * 0.8;
    group.add(sprite);
    smoke.push(sprite);
  }
  for (let i = 0; i < 15; i += 1) {
    const ember = addSphere(group, i % 3 ? materials.fire : materials.orangeGlow, 0, 1, 0, 0.035);
    ember.userData.phase = random() * 4.2;
    ember.userData.speed = 0.55 + random() * 0.42;
    ember.userData.radius = 0.12 + random() * 0.42;
    ember.userData.noShadow = true;
    embers.push(ember);
  }
  const system = { group, flameGroup, flameBase, flameMid, flameCore, light, smoke };
  fireSystems.push(system);
  return system;
}

export function buildBench(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = 0.12;
  parent.add(group);
  addBox(group, materials.wood, 0, 0.5, 0, 2.1, 0.16, 0.56);
  addBox(group, materials.woodLight, 0, 0.94, -0.22, 2.1, 0.12, 0.12);
  addBox(group, materials.woodDark, -0.82, 0.24, 0, 0.14, 0.5, 0.42);
  addBox(group, materials.woodDark, 0.82, 0.24, 0, 0.14, 0.5, 0.42);
  addCone(group, materials.burgundy, 0, 1.02, 0.04, 0.32, 0.55);
  addSphere(group, materials.orange, 0, 1.42, 0.08, 0.42, 0.38, 0.4);
  addCylinder(group, materials.woodDark, 0, 1.78, 0.08, 0.07, 0.25);
  addSphere(group, materials.black, -0.14, 1.47, 0.45, 0.07, 0.1, 0.025);
  addSphere(group, materials.black, 0.14, 1.47, 0.45, 0.07, 0.1, 0.025);
  addSphere(group, materials.black, 0, 1.28, 0.46, 0.17, 0.08, 0.025);
  addBox(group, materials.woodDark, 0, 0.92, -0.18, 0.08, 0.8, 0.08);
  const light = addPointLight(group, 0xff9b39, 2.8, 4.8, 0, 1.45, 0.5);
  light.userData.baseIntensity = 2.8;
  light.userData.phase = 4.2;
  lanternSystems.push(light);
  return group;
}

export function buildChapel(parent) {
  const group = new THREE.Group();
  group.position.set(4.45, 0, -4.35);
  parent.add(group);
  addBox(group, materials.stoneDark, 0, 1.35, 0, 4.0, 2.7, 1.0);
  addBox(group, materials.stone, -1.35, 1.55, 0.54, 1.2, 2.9, 0.16);
  addBox(group, materials.stone, 1.35, 1.55, 0.54, 1.2, 2.9, 0.16);
  addBox(group, materials.stoneLight, 0, 2.78, 0.1, 4.5, 0.2, 1.4);
  const roof = new THREE.Shape();
  roof.moveTo(-2.45, 0);
  roof.lineTo(0, 1.45);
  roof.lineTo(2.45, 0);
  roof.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roof, { depth: 1.5, bevelEnabled: false });
  roofGeo.translate(0, 0, -0.75);
  const roofMesh = new THREE.Mesh(roofGeo, materials.burgundy);
  roofMesh.position.set(0, 3.0, 0);
  group.add(roofMesh);
  addBox(group, materials.window, 0, 1.85, 0.63, 0.7, 0.95, 0.05);
  addBox(group, materials.woodDark, 0, 1.85, 0.68, 0.08, 0.98, 0.03);
  addBox(group, materials.woodDark, 0, 1.85, 0.69, 0.72, 0.08, 0.03);
  addBox(group, materials.woodDark, 0, 1.18, 0.62, 0.7, 1.8, 0.12);
  addBox(group, materials.woodLight, 0, 1.2, 0.72, 0.08, 1.7, 0.04);
  const light = addPointLight(group, 0xf0a347, 4.5, 7, 0, 2.0, 1.0);
  light.userData.baseIntensity = 4.5;
  light.userData.phase = 3.1;
  lanternSystems.push(light);
  for (let i = 0; i < 3; i += 1) addBox(group, materials.stoneLight, 0, 0.12 + i * 0.18, 1.2 + i * 0.33, 2.3, 0.18, 0.6);
  return group;
}
