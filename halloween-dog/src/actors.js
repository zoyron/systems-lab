import * as THREE from 'three';
import {
  addBox,
  addCone,
  addCylinder,
  addCylinderBetween,
  addGlowSphere,
  addPointLight,
  addSphere,
  materials,
  standardMaterial,
} from './kit.js';

export function createBoneSegment(parent, mat, a, b, radius) {
  return addCylinderBetween(parent, mat, a, b, radius);
}

export function createSkeleton(options = {}) {
  const group = new THREE.Group();
  const scale = options.scale || 1;
  group.scale.setScalar(scale);
  const bone = materials.bone;
  const boneLight = materials.boneLight;
  const body = new THREE.Group();
  group.add(body);
  createBoneSegment(body, bone, [0, 0.82, 0], [0, 1.83, 0], 0.075);
  addBox(body, boneLight, 0, 0.72, 0, 0.43, 0.22, 0.22, 0, 0, 0.04);
  for (let i = 0; i < 5; i += 1) {
    const y = 1.04 + i * 0.15;
    const width = 0.29 - Math.abs(i - 2) * 0.025;
    createBoneSegment(body, boneLight, [-width, y, 0], [width, y, 0], 0.042);
    createBoneSegment(body, boneLight, [-width * 0.65, y + 0.02, 0.02], [width * 0.65, y + 0.02, -0.02], 0.026);
  }
  const head = new THREE.Group();
  head.position.set(0, 2.08, 0);
  body.add(head);
  addSphere(head, boneLight, 0, 0, 0, 0.29, 0.32, 0.27);
  addBox(head, bone, 0, -0.22, 0.18, 0.34, 0.12, 0.13);
  addSphere(head, materials.black, -0.1, 0.02, 0.255, 0.055, 0.075, 0.025);
  addSphere(head, materials.black, 0.1, 0.02, 0.255, 0.055, 0.075, 0.025);
  addSphere(head, materials.black, 0, -0.11, 0.27, 0.035, 0.055, 0.02);
  createBoneSegment(body, bone, [0, 1.86, 0], [0, 2.0, 0], 0.055);
  createBoneSegment(body, bone, [-0.12, 1.52, 0], [-0.48, 1.05, 0.04], 0.045);
  createBoneSegment(body, bone, [-0.48, 1.05, 0.04], [-0.68, 0.72, 0.05], 0.04);
  createBoneSegment(body, bone, [0.12, 1.52, 0], [0.48, 1.08, 0.04], 0.045);
  createBoneSegment(body, bone, [0.48, 1.08, 0.04], [0.7, 0.76, 0.02], 0.04);
  createBoneSegment(body, bone, [-0.12, 0.7, 0], [-0.24, 0.22, 0.03], 0.06);
  createBoneSegment(body, bone, [-0.24, 0.22, 0.03], [-0.3, -0.02, 0.04], 0.05);
  createBoneSegment(body, bone, [0.12, 0.7, 0], [0.24, 0.22, 0.03], 0.06);
  createBoneSegment(body, bone, [0.24, 0.22, 0.03], [0.3, -0.02, 0.04], 0.05);
  group.userData.head = head;
  group.userData.body = body;
  return group;
}

export function createDog() {
  const group = new THREE.Group();
  const fur = standardMaterial(0xf5f0dc, { roughness: 1 });
  const furShade = standardMaterial(0xd9d1bd, { roughness: 1 });
  const body = addSphere(group, fur, 0, 0.46, 0, 0.46, 0.38, 0.68);
  const head = new THREE.Group();
  head.position.set(0, 0.7, 0.5);
  group.add(head);
  addSphere(head, fur, 0, 0, 0, 0.35, 0.33, 0.34);
  addSphere(head, furShade, 0, -0.08, 0.25, 0.19, 0.15, 0.16);
  addSphere(head, materials.black, -0.12, 0.04, 0.29, 0.045, 0.05, 0.025);
  addSphere(head, materials.black, 0.12, 0.04, 0.29, 0.045, 0.05, 0.025);
  addSphere(head, materials.black, 0, -0.06, 0.4, 0.055, 0.04, 0.025);
  const earLeft = addCone(head, furShade, -0.25, 0.13, 0.02, 0.13, 0.35, 0, 0, -0.22);
  const earRight = addCone(head, furShade, 0.25, 0.13, 0.02, 0.13, 0.35, 0, 0, 0.22);
  const legs = [];
  for (let i = 0; i < 4; i += 1) {
    const leg = new THREE.Group();
    leg.position.set(i % 2 ? 0.22 : -0.22, 0.25, i < 2 ? 0.36 : -0.34);
    group.add(leg);
    addCylinder(leg, furShade, 0, -0.12, 0, 0.07, 0.34);
    addSphere(leg, fur, 0, -0.3, 0.04, 0.1, 0.08, 0.14);
    legs.push(leg);
  }
  const tail = addCylinderBetween(group, fur, [0, 0.55, -0.5], [0.1, 0.86, -0.72], 0.07);
  addSphere(group, furShade, -0.25, 0.55, -0.05, 0.24, 0.25, 0.25);
  addSphere(group, furShade, 0.24, 0.57, 0.06, 0.23, 0.24, 0.24);
  group.userData.body = body;
  group.userData.head = head;
  group.userData.ears = [earLeft, earRight];
  group.userData.legs = legs;
  group.userData.tail = tail;
  return group;
}

export function createLutin() {
  const group = new THREE.Group();
  const skin = standardMaterial(0x9b4d38, { roughness: 0.9 });
  const cloth = standardMaterial(0x5c3140, { roughness: 1 });
  addCone(group, cloth, 0, 0.36, 0, 0.36, 0.72);
  addSphere(group, skin, 0, 0.88, 0, 0.28, 0.3, 0.26);
  addCone(group, materials.woodDark, -0.19, 1.18, 0, 0.07, 0.24, 0, 0, -0.3);
  addCone(group, materials.woodDark, 0.19, 1.18, 0, 0.07, 0.24, 0, 0, 0.3);
  addSphere(group, materials.orangeLight, -0.09, 0.91, 0.23, 0.045, 0.06, 0.02);
  addSphere(group, materials.orangeLight, 0.09, 0.91, 0.23, 0.045, 0.06, 0.02);
  addCylinderBetween(group, materials.woodDark, [-0.13, 0.65, 0], [-0.45, 0.2, 0.05], 0.045);
  addCylinderBetween(group, materials.woodDark, [0.13, 0.65, 0], [0.45, 0.25, 0.05], 0.045);
  const glow = addGlowSphere(group, materials.orangeGlow, 0, 0.95, 0.1, 0.36);
  glow.userData.noShadow = true;
  const light = addPointLight(group, 0xff7d36, 3.4, 4.2, 0, 1.0, 0.1);
  light.userData.baseIntensity = 3.4;
  light.userData.phase = 1.4;
  group.userData.glow = glow;
  group.userData.light = light;
  return group;
}

export function createGhost() {
  const root = new THREE.Group();
  root.name = 'Player';
  const visual = new THREE.Group();
  root.add(visual);
  const shape = new THREE.Shape();
  shape.moveTo(-0.83, 0.22);
  shape.quadraticCurveTo(-1.02, 0.55, -0.88, 1.0);
  shape.quadraticCurveTo(-0.7, 1.72, 0, 1.9);
  shape.quadraticCurveTo(0.7, 1.72, 0.88, 1.0);
  shape.quadraticCurveTo(1.02, 0.55, 0.83, 0.22);
  shape.quadraticCurveTo(0.62, 0.02, 0.42, 0.25);
  shape.quadraticCurveTo(0.2, 0.42, 0, 0.18);
  shape.quadraticCurveTo(-0.2, 0.42, -0.42, 0.25);
  shape.quadraticCurveTo(-0.62, 0.02, -0.83, 0.22);
  const ghostGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.38, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.08, bevelThickness: 0.08, curveSegments: 8 });
  ghostGeo.translate(0, 0, -0.19);
  visual.add(new THREE.Mesh(ghostGeo, materials.ghost));
  addSphere(visual, materials.black, -0.28, 1.15, 0.3, 0.105, 0.17, 0.045);
  addSphere(visual, materials.black, 0.28, 1.15, 0.3, 0.105, 0.17, 0.045);
  addSphere(visual, materials.black, 0, 0.88, 0.31, 0.08, 0.035, 0.025);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24), new THREE.MeshBasicMaterial({ color: 0x10130f, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI * 0.5;
  shadow.position.y = 0.045;
  shadow.scale.set(1.25, 0.72, 1);
  root.add(shadow);
  const collider = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.62, 1.8, 12), new THREE.MeshBasicMaterial({ color: 0x9ab2a1, transparent: true, opacity: 0.025, depthWrite: false }));
  collider.position.y = 0.9;
  collider.userData.noShadow = true;
  root.add(collider);
  return { root, visual, collider, shadow };
}
