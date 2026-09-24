import * as THREE from 'three';
import './styles.css';
import {
  COLORS,
  damp,
  embers,
  lanternSystems,
  leaves,
  random,
} from './kit.js';
import { createGhost } from './actors.js';
import { buildGraveyard } from './outdoor.js';
import { buildCrypt } from './indoor.js';

const canvas = document.getElementById('viewport');
const uiRoot = document.getElementById('ui-root');
const loading = document.getElementById('loading');
const placeLabel = document.getElementById('place-label');
const chapterLabel = document.getElementById('chapter-label');
const pauseButton = document.getElementById('pause-button');
const pauseLabel = document.getElementById('pause-label');
const replayButton = document.getElementById('replay-button');
const toolsButton = document.getElementById('tools-button');
const toolsPanel = document.getElementById('tools-panel');
const toast = document.getElementById('toast');
const interactionPrompt = document.getElementById('interaction-prompt');
const interactionText = document.getElementById('interaction-text');
const modal = document.getElementById('grave-modal');
const modalClose = document.getElementById('modal-close');
const keys = Object.create(null);
const nameplates = [];
const interactables = [];
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
const clickPoint = new THREE.Vector3();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08);
const cameraTarget = new THREE.Vector3();
const desiredCameraTarget = new THREE.Vector3();
const cameraScratch = new THREE.Vector3();
const cameraLook = new THREE.Vector3();
const playerVelocity = new THREE.Vector3();
const desiredVelocity = new THREE.Vector3();
const movementInput = new THREE.Vector3();
const clickTarget = new THREE.Vector3();
const nameWorld = new THREE.Vector3();
const nameScreen = new THREE.Vector3();
const tempA = new THREE.Vector3();
let renderer;
let scene;
let camera;
let graveyard;
let crypt;
let ghost;
let collider;
let location = 'graveyard';
let visualTime = 0;
let paused = false;
let modalOpen = false;
let clickMoving = false;
let pendingInteraction = null;
let toastTimer = 0;
let cameraHeight = 20.5;
let lastFrameTime = performance.now();
let currentAspect = 1;

function activeData() {
  return location === 'crypt' ? crypt : graveyard;
}

function addLabel(text, object, locationGroup, offsetY, radius, kind) {
  const element = document.createElement('div');
  element.className = 'nameplate';
  const mark = document.createElement('span');
  mark.className = 'nameplate__mark';
  const label = document.createElement('span');
  label.textContent = text;
  element.append(mark, label);
  uiRoot.appendChild(element);
  nameplates.push({ element, object, location: locationGroup, offsetY, radius, kind, opacity: 0 });
}

function addHit(locationGroup, hit, type, label, radius, action, prompt) {
  const item = { location: locationGroup, hit, type, label, radius, action, prompt };
  interactables.push(item);
  return item;
}

function setupWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.void);
  scene.fog = new THREE.Fog(0x171b1e, 36, 64);
  const skyFill = new THREE.HemisphereLight(0xa7bdd1, 0x4b3025, 1.45);
  scene.add(skyFill);
  const moon = new THREE.DirectionalLight(0xb6c8e1, 2.25);
  moon.position.set(-12, 24, 11);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -18;
  moon.shadow.camera.right = 18;
  moon.shadow.camera.top = 18;
  moon.shadow.camera.bottom = -18;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 62;
  moon.shadow.bias = -0.00035;
  moon.target.position.set(0, 0, 0);
  scene.add(moon);
  scene.add(moon.target);
  const coolFill = new THREE.DirectionalLight(0x7288aa, 0.38);
  coolFill.position.set(12, 9, -14);
  coolFill.target.position.set(0, 0, 0);
  scene.add(coolFill);
  scene.add(new THREE.AmbientLight(0x563526, 0.62));
  graveyard = buildGraveyard(scene);
  crypt = buildCrypt(scene);
  addHit(graveyard.group, graveyard.graveHit, 'grave', "Zozo's grave", 2.5, openGraveModal, "READ ZOZO'S GRAVE");
  addLabel("Zozo's grave", graveyard.grave, graveyard.group, 2.0, 2.5, 'grave');
  addHit(graveyard.group, graveyard.dogHit, 'dog', 'Zozo', 1.9, petZozo, 'PET ZOZO');
  addLabel('Zozo', graveyard.dog, graveyard.group, 1.34, 2.0, 'dog');
  addHit(graveyard.group, graveyard.skeletonHit, 'skeleton', 'The fireside skeleton', 1.65, inspectSkeleton, 'INSPECT THE SKELETON');
  addLabel('The fireside skeleton', graveyard.skeleton, graveyard.group, 2.4, 1.7, 'skeleton');
  addHit(graveyard.group, graveyard.fireHit, 'fire', 'The little fire', 2.2, inspectFire, 'INSPECT THE FIRE');
  addLabel('The little fire', graveyard.fire.group, graveyard.group, 2.15, 2.2, 'fire');
  addHit(graveyard.group, graveyard.house.doorHit, 'door', 'The house', 2.45, enterCrypt, 'ENTER THE HOUSE');
  addLabel('The house', graveyard.house.doorHit, graveyard.group, 2.7, 2.45, 'door');
  addHit(crypt.group, crypt.lutinHit, 'lutin', 'Lutin', 2.8, inspectLutin, 'GREET LUTIN');
  addLabel('Lutin', crypt.lutin, crypt.group, 1.7, 2.8, 'lutin');
  addHit(crypt.group, crypt.portal.hit, 'portal', 'Green portal', 3.1, inspectPortal, 'TOUCH THE GREEN PORTAL');
  addLabel('Green portal', crypt.portal.group, crypt.group, 3.4, 3.1, 'portal');
  addHit(crypt.group, crypt.exit.hit, 'exit', 'Graveyard door', 2.2, leaveCrypt, 'LEAVE THE CRYPT');
  addLabel('Graveyard door', crypt.exit.frame, crypt.group, 3.3, 2.2, 'exit');
  ghost = createGhost();
  scene.add(ghost.root);
  collider = ghost.collider;
  graveyard.group.visible = true;
  crypt.group.visible = false;
}

function createRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(COLORS.void, 1);
}

function cameraOffset() {
  if (location === 'crypt') return tempA.set(9.5, 21, 13);
  return tempA.set(9.5, 25, 13);
}

function desiredCameraHeight() {
  return location === 'crypt' ? 13.2 : 20.5;
}

function updateFrustum() {
  const width = Math.max(1, renderer.domElement.clientWidth || window.innerWidth || 1);
  const height = Math.max(1, renderer.domElement.clientHeight || window.innerHeight || 1);
  currentAspect = width / height;
  const baseHeight = location === 'crypt' ? 11.8 : 20.5;
  const baseWidth = location === 'crypt' ? 16.5 : 30;
  const portraitHeight = Math.min(baseWidth / Math.max(0.45, currentAspect), 24);
  const viewHeight = Math.max(baseHeight, portraitHeight, cameraHeight);
  camera.left = -viewHeight * currentAspect * 0.5;
  camera.right = viewHeight * currentAspect * 0.5;
  camera.top = viewHeight * 0.5;
  camera.bottom = -viewHeight * 0.5;
  camera.updateProjectionMatrix();
}

function setLocation(nextLocation, snap = false) {
  const previousLocation = location;
  location = nextLocation === 1 || nextLocation === 'crypt' ? 'crypt' : 'graveyard';
  graveyard.group.visible = location === 'graveyard';
  crypt.group.visible = location === 'crypt';
  placeLabel.textContent = location === 'crypt' ? 'CRYPT' : 'GRAVEYARD';
  chapterLabel.textContent = 'A FIRESIDE INTRODUCTION';
  clickMoving = false;
  pendingInteraction = null;
  desiredVelocity.set(0, 0, 0);
  playerVelocity.set(0, 0, 0);
  if (location === 'crypt') {
    ghost.root.position.set(0, 0, 2.25);
    ghost.root.rotation.y = Math.PI;
  } else if (previousLocation === 'crypt') {
    ghost.root.position.set(8.2, 0, -2.82);
    ghost.root.rotation.y = 0;
  } else {
    ghost.root.position.set(0, 0, 4.9);
    ghost.root.rotation.y = 0;
  }
  if (snap) {
    cameraHeight = desiredCameraHeight();
    cameraTarget.copy(location === 'crypt' ? tempA.set(0, 0.9, 0) : tempA.set(ghost.root.position.x, 0.5, ghost.root.position.z));
    camera.position.copy(cameraTarget).add(cameraOffset());
    camera.lookAt(cameraTarget);
    updateFrustum();
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = 3.1;
}

function updateToast(dt) {
  if (toastTimer <= 0) return;
  toastTimer -= dt;
  if (toastTimer <= 0) toast.classList.remove('is-visible');
}

function openGraveModal() {
  if (modalOpen || location !== 'graveyard') return;
  modalOpen = true;
  modal.hidden = false;
  interactionPrompt.hidden = true;
  modalClose.focus();
}

function closeGraveModal() {
  if (!modalOpen) return;
  modalOpen = false;
  modal.hidden = true;
  canvas.focus();
}

function petZozo() {
  showToast('Zozo leans into your hand. The gas is affectionate.');
}

function inspectSkeleton() {
  showToast('The skeleton says hello. The fire says nothing, but it is listening.');
}

function inspectFire() {
  showToast('A warm pocket of light, with room for one more ghost.');
}

function enterCrypt() {
  if (location !== 'graveyard') return;
  closeGraveModal();
  closeTools();
  setLocation('crypt');
  showToast('The house opens into a quiet stone room.');
}

function leaveCrypt() {
  if (location !== 'crypt') return;
  closeGraveModal();
  closeTools();
  setLocation('graveyard');
  showToast('Back beneath the moon. The little fire is still burning.');
}

function inspectLutin() {
  showToast('Lutin keeps a small orange light beneath the desk.');
}

function inspectPortal() {
  showToast('The green light hums like a held breath.');
}

function setPaused(value) {
  paused = value;
  pauseLabel.textContent = paused ? 'Resume the scene' : 'Pause the scene';
}

function closeTools() {
  toolsPanel.hidden = true;
  toolsButton.setAttribute('aria-expanded', 'false');
}

function resetPosition() {
  closeGraveModal();
  closeTools();
  setPaused(false);
  if (location === 'crypt') ghost.root.position.set(0, 0, 2.25);
  else ghost.root.position.set(0, 0, 4.9);
  clickMoving = false;
  pendingInteraction = null;
  playerVelocity.set(0, 0, 0);
  desiredVelocity.set(0, 0, 0);
  showToast('A small reset. The park keeps its shape.');
}

function enterFreePlace(place) {
  if (place === 'crypt') enterCrypt();
  else {
    closeGraveModal();
    closeTools();
    if (location !== 'graveyard') setLocation('graveyard');
    ghost.root.position.set(0, 0, 4.9);
    showToast('The graveyard is yours to wander.');
  }
}

function updateCamera(dt) {
  if (location === 'crypt') desiredCameraTarget.set(0, 0.85, -0.05);
  else desiredCameraTarget.set(ghost.root.position.x, 0.52, ghost.root.position.z - 0.05);
  cameraTarget.lerp(desiredCameraTarget, 1 - Math.exp(-3.1 * dt));
  cameraScratch.copy(cameraTarget).add(cameraOffset());
  camera.position.lerp(cameraScratch, 1 - Math.exp(-3.2 * dt));
  cameraLook.copy(cameraTarget);
  camera.lookAt(cameraLook);
  const nextHeight = desiredCameraHeight();
  if (Math.abs(cameraHeight - nextHeight) > 0.01) {
    cameraHeight = damp(cameraHeight, nextHeight, 2.8, dt);
    updateFrustum();
  }
}

function resolvePlayerCollision() {
  const data = activeData();
  const radius = 0.56;
  for (const obstacle of data.obstacles) {
    const dx = ghost.root.position.x - obstacle.x;
    const dz = ghost.root.position.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = radius + obstacle.r;
    if (distance < minDistance) {
      if (distance < 0.0001) {
        ghost.root.position.x += minDistance;
      } else {
        const push = (minDistance - distance) / distance;
        ghost.root.position.x += dx * push;
        ghost.root.position.z += dz * push;
      }
    }
  }
  ghost.root.position.x = Math.max(data.bounds.minX, Math.min(data.bounds.maxX, ghost.root.position.x));
  ghost.root.position.z = Math.max(data.bounds.minZ, Math.min(data.bounds.maxZ, ghost.root.position.z));
}

function finishPendingInteraction() {
  if (!pendingInteraction) return;
  const item = pendingInteraction;
  item.hit.getWorldPosition(tempA);
  if (Math.hypot(tempA.x - ghost.root.position.x, tempA.z - ghost.root.position.z) <= item.radius + 0.42) {
    pendingInteraction = null;
    clickMoving = false;
    interactWith(item);
  }
}

function updatePlayer(dt) {
  if (modalOpen) return;
  const inputX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const inputZ = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  movementInput.set(inputX, 0, inputZ);
  if (movementInput.lengthSq() > 0) {
    clickMoving = false;
    pendingInteraction = null;
    movementInput.normalize();
    desiredVelocity.copy(movementInput).multiplyScalar(4.1);
  } else if (!clickMoving) {
    desiredVelocity.set(0, 0, 0);
  }
  if (clickMoving) {
    const dx = clickTarget.x - ghost.root.position.x;
    const dz = clickTarget.z - ghost.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) {
      clickMoving = false;
      desiredVelocity.set(0, 0, 0);
      finishPendingInteraction();
    } else {
      desiredVelocity.set(dx / distance, 0, dz / distance).multiplyScalar(Math.min(4.1, 1.3 + distance * 1.7));
    }
  }
  playerVelocity.lerp(desiredVelocity, 1 - Math.exp(-10 * dt));
  ghost.root.position.addScaledVector(playerVelocity, dt);
  if (playerVelocity.lengthSq() > 0.025) {
    ghost.root.rotation.y = damp(ghost.root.rotation.y, Math.atan2(playerVelocity.x, playerVelocity.z), 8, dt);
  }
  resolvePlayerCollision();
  finishPendingInteraction();
  collider.position.y = 0.9;
  const bob = Math.sin(visualTime * 2.35) * 0.075;
  ghost.visual.position.y = 0.15 + bob;
  ghost.visual.rotation.z = Math.sin(visualTime * 1.3) * 0.018;
  ghost.visual.scale.y = 1 + Math.sin(visualTime * 2.35) * 0.018;
}

function updateFire(system) {
  const flicker = 0.86 + Math.sin(visualTime * 7.1 + system.light.userData.phase) * 0.08 + Math.sin(visualTime * 13.7 + 1.3) * 0.045;
  system.light.intensity = system.light.userData.baseIntensity * flicker;
  system.flameBase.scale.x = 0.5 + flicker * 0.08;
  system.flameBase.scale.y = 1.34 + flicker * 0.24;
  system.flameMid.rotation.z = Math.sin(visualTime * 5.4 + 1.2) * 0.06;
  system.flameCore.scale.y = 0.7 + Math.sin(visualTime * 9.2) * 0.11;
  for (let i = 0; i < system.smoke.length; i += 1) {
    const puff = system.smoke[i];
    const cycle = (visualTime * puff.userData.speed + puff.userData.phase) % 5.2;
    const normalized = cycle / 5.2;
    puff.position.x = puff.userData.drift * normalized + Math.sin(visualTime * 0.8 + i) * 0.14;
    puff.position.y = 1.18 + cycle;
    puff.position.z = Math.sin(visualTime * 0.6 + i * 1.7) * 0.16;
    const size = 0.32 + normalized * 0.9;
    puff.scale.set(size, size * 0.82, 1);
    puff.material.opacity = 0.2 * (1 - normalized) * (0.65 + flicker * 0.35);
  }
}

const dogWanderPoints = [
  [1.5, 1.35], [-1.8, 1.5], [-2.7, -1.45], [0.2, -1.9], [2.5, 0.8], [-3.4, 2.2], [1.1, 2.5], [2.9, -1.25],
];

function chooseDogTarget(data) {
  data.wanderIndex = (data.wanderIndex + 1) % dogWanderPoints.length;
  data.targetX = dogWanderPoints[data.wanderIndex][0];
  data.targetZ = dogWanderPoints[data.wanderIndex][1];
}

function updateDog(dt) {
  const dog = graveyard.dog;
  const data = dog.userData;
  data.stateTime -= dt;
  if (data.stateTime <= 0) {
    if (data.state === 'idle') {
      data.state = 'sniff';
      data.stateTime = 0.9 + random() * 0.8;
    } else if (data.state === 'sniff') {
      chooseDogTarget(data);
      data.state = data.wanderIndex % 3 === 0 ? 'run' : 'wander';
      data.stateTime = data.state === 'run' ? 1.8 : 2.8;
    } else {
      data.state = 'idle';
      data.stateTime = 0.7 + random() * 0.9;
    }
  }
  const moving = data.state === 'wander' || data.state === 'run';
  if (moving) {
    const dx = data.targetX - dog.position.x;
    const dz = data.targetZ - dog.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.18) {
      data.state = 'idle';
      data.stateTime = 0.5 + random() * 0.7;
    } else {
      const speed = data.state === 'run' ? 1.85 : 0.9;
      dog.position.x += dx / distance * Math.min(speed * dt, distance);
      dog.position.z += dz / distance * Math.min(speed * dt, distance);
      dog.rotation.y = damp(dog.rotation.y, Math.atan2(dx, dz), 8, dt);
      data.gait += dt * (data.state === 'run' ? 12 : 7);
      const gait = data.gait;
      for (let i = 0; i < data.legs.length; i += 1) data.legs[i].rotation.x = Math.sin(gait + (i % 2) * Math.PI + (i < 2 ? 0 : Math.PI)) * (data.state === 'run' ? 0.62 : 0.34);
      data.head.position.y = 0.7 + Math.abs(Math.sin(gait * 0.5)) * 0.035;
      data.body.position.y = 0.46 + Math.abs(Math.sin(gait)) * 0.035;
    }
  } else {
    for (let i = 0; i < data.legs.length; i += 1) data.legs[i].rotation.x = damp(data.legs[i].rotation.x, 0, 8, dt);
    data.head.position.y = damp(data.head.position.y, data.state === 'sniff' ? 0.5 : 0.7, 6, dt);
    data.head.rotation.x = damp(data.head.rotation.x, data.state === 'sniff' ? 0.28 : 0, 6, dt);
    data.body.position.y = damp(data.body.position.y, data.state === 'sniff' ? 0.42 : 0.46, 6, dt);
  }
  data.tail.rotation.z = Math.sin(visualTime * (data.state === 'run' ? 10 : 4)) * (data.state === 'run' ? 0.28 : 0.14);
}

function updateSkeletons(dt) {
  if (graveyard.skeleton) {
    graveyard.skeleton.rotation.z = damp(graveyard.skeleton.rotation.z, Math.sin(visualTime * 1.1) * 0.012, 3, dt);
    graveyard.skeleton.userData.head.rotation.y = damp(graveyard.skeleton.userData.head.rotation.y, Math.sin(visualTime * 0.65) * 0.08, 3, dt);
  }
  if (crypt.coffin?.skeleton) {
    const breath = 1 + Math.sin(visualTime * 1.15) * 0.012;
    crypt.coffin.skeleton.scale.set(0.69 * breath, 0.69, 0.69);
  }
}

function updateLanterns() {
  for (const light of lanternSystems) {
    const flicker = 0.91 + Math.sin(visualTime * 4.1 + light.userData.phase) * 0.055 + Math.sin(visualTime * 9.3 + light.userData.phase * 0.7) * 0.025;
    light.intensity = light.userData.baseIntensity * flicker;
  }
  for (const system of crypt.torches) {
    const flicker = 0.9 + Math.sin(visualTime * 6.2 + system.light.userData.phase) * 0.08;
    system.flame.scale.x = 0.16 * flicker;
    system.flame.scale.y = 0.47 * (0.96 + Math.sin(visualTime * 8.1 + 1) * 0.08);
    system.core.scale.y = 0.27 * (0.96 + Math.sin(visualTime * 10.4) * 0.09);
    system.light.intensity = system.light.userData.baseIntensity * flicker;
  }
}

function updateLeaves() {
  for (let i = 0; i < leaves.length; i += 1) {
    const leaf = leaves[i];
    if (leaf.userData.baseX === undefined) {
      leaf.userData.baseX = leaf.position.x;
      leaf.userData.baseZ = leaf.position.z;
    }
    const cycle = (visualTime * leaf.userData.speed + leaf.userData.phase) % 10;
    leaf.position.y = 5.5 - cycle * 0.52;
    leaf.position.x = leaf.userData.baseX + Math.sin(visualTime * 0.55 + i) * 0.12;
    leaf.position.z = leaf.userData.baseZ + Math.cos(visualTime * 0.48 + i) * 0.1;
    leaf.rotation.x += 0.012;
    leaf.rotation.z += 0.018;
    if (leaf.position.y < 0.16) leaf.position.y = 5.5;
  }
}

function updateEmbers() {
  for (let i = 0; i < embers.length; i += 1) {
    const ember = embers[i];
    const cycle = (visualTime * ember.userData.speed + ember.userData.phase) % 3.7;
    ember.position.x = Math.sin(visualTime * 1.7 + i) * ember.userData.radius;
    ember.position.y = 0.65 + cycle;
    ember.position.z = Math.cos(visualTime * 1.1 + i * 2) * ember.userData.radius;
    ember.scale.setScalar(0.025 + (1 - cycle / 3.7) * 0.04);
  }
}

function updatePortal() {
  if (!crypt.portal) return;
  crypt.portal.portal.material.opacity = 0.7 + Math.sin(visualTime * 2.7) * 0.1;
  crypt.portal.halo.material.opacity = 0.42 + Math.sin(visualTime * 2.7) * 0.1;
  const pulse = 9.5 + Math.sin(visualTime * 2.3) * 1.4 + Math.sin(visualTime * 5.1) * 0.45;
  crypt.portal.light.intensity = pulse;
  crypt.portal.halo.scale.set(0.82 + Math.sin(visualTime * 2.3) * 0.08, 1.18 + Math.sin(visualTime * 2.3) * 0.1, 0.08);
}

function updateAnimations(dt) {
  if (graveyard.fire) updateFire(graveyard.fire);
  updateDog(dt);
  updateSkeletons(dt);
  updateLanterns();
  updateLeaves();
  updateEmbers();
  updatePortal();
}

function updateNameplates() {
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  for (const label of nameplates) {
    const locationVisible = label.location.visible;
    label.object.getWorldPosition(nameWorld);
    nameWorld.y += label.offsetY;
    const distance = Math.hypot(nameWorld.x - ghost.root.position.x, nameWorld.z - ghost.root.position.z);
    const proximity = Math.max(0, Math.min(1, 1 - (distance - 0.65) / Math.max(0.1, label.radius)));
    const baseOpacity = label.kind === 'dog' ? 0.14 : label.kind === 'portal' ? 0.16 : 0.1;
    const targetOpacity = locationVisible && distance < label.radius * 2.3 ? Math.max(baseOpacity, proximity) : 0;
    label.opacity = damp(label.opacity, targetOpacity, 10, 0.05);
    nameScreen.copy(nameWorld).project(camera);
    const onScreen = nameScreen.z > -1 && nameScreen.z < 1 && nameScreen.x > -1.08 && nameScreen.x < 1.08 && nameScreen.y > -1.08 && nameScreen.y < 1.08;
    label.element.style.left = `${(nameScreen.x * 0.5 + 0.5) * width}px`;
    label.element.style.top = `${(-nameScreen.y * 0.5 + 0.5) * height}px`;
    label.element.style.opacity = onScreen ? label.opacity.toFixed(3) : '0';
  }
}

function nearestInteractable() {
  const data = activeData();
  let best = null;
  let bestDistance = Infinity;
  for (const item of interactables) {
    if (item.location !== data.group) continue;
    item.hit.getWorldPosition(tempA);
    const distance = Math.hypot(tempA.x - ghost.root.position.x, tempA.z - ghost.root.position.z);
    if (distance < item.radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

function updateInteractionPrompt() {
  const item = nearestInteractable();
  if (!item || modalOpen || paused) {
    interactionPrompt.hidden = true;
    return;
  }
  interactionPrompt.hidden = false;
  interactionText.textContent = item.prompt;
}

function interactWith(item) {
  if (!item) return;
  if (item.type === 'grave') openGraveModal();
  else if (item.action) item.action();
  else showToast(`You found ${item.label}.`);
}

function handleCanvasClick(event) {
  if (modalOpen) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const data = activeData();
  const activeHits = interactables.filter((item) => item.location === data.group).map((item) => item.hit);
  const hits = raycaster.intersectObjects(activeHits, false);
  if (hits.length > 0) {
    const item = interactables.find((candidate) => candidate.hit === hits[0].object);
    if (item) {
      item.hit.getWorldPosition(tempA);
      const distance = Math.hypot(tempA.x - ghost.root.position.x, tempA.z - ghost.root.position.z);
      if (distance <= item.radius + 0.45) {
        interactWith(item);
      } else {
        pendingInteraction = item;
        clickTarget.set(tempA.x, 0, tempA.z);
        clickTarget.x = Math.max(data.bounds.minX, Math.min(data.bounds.maxX, clickTarget.x));
        clickTarget.z = Math.max(data.bounds.minZ, Math.min(data.bounds.maxZ, clickTarget.z));
        clickMoving = true;
        showToast('Walk closer to take a look.');
      }
      return;
    }
  }
  groundPlane.constant = location === 'crypt' ? -0.11 : -0.08;
  if (raycaster.ray.intersectPlane(groundPlane, clickPoint)) {
    clickTarget.set(clickPoint.x, 0, clickPoint.z);
    clickTarget.x = Math.max(data.bounds.minX, Math.min(data.bounds.maxX, clickTarget.x));
    clickTarget.z = Math.max(data.bounds.minZ, Math.min(data.bounds.maxZ, clickTarget.z));
    pendingInteraction = null;
    clickMoving = true;
  }
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', 'p', 'r', 'escape'].includes(key)) event.preventDefault();
  if (key === 'escape') {
    if (modalOpen) closeGraveModal();
    else closeTools();
    return;
  }
  if (key === 'e') {
    if (!modalOpen) interactWith(nearestInteractable());
    return;
  }
  if (key === 'p') {
    setPaused(!paused);
    return;
  }
  if (key === 'r') {
    resetPosition();
    return;
  }
  if (key === 'arrowup') keys.w = true;
  if (key === 'arrowdown') keys.s = true;
  if (key === 'arrowleft') keys.a = true;
  if (key === 'arrowright') keys.d = true;
  keys[key] = true;
}

function handleKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key === 'arrowup') delete keys.w;
  if (key === 'arrowdown') delete keys.s;
  if (key === 'arrowleft') delete keys.a;
  if (key === 'arrowright') delete keys.d;
  delete keys[key];
}

function setupUI() {
  canvas.tabIndex = 0;
  toolsButton.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = toolsPanel.hidden;
    toolsPanel.hidden = !open;
    toolsButton.setAttribute('aria-expanded', String(open));
  });
  pauseButton.addEventListener('click', () => setPaused(!paused));
  replayButton.addEventListener('click', resetPosition);
  modalClose.addEventListener('click', closeGraveModal);
  modal.addEventListener('click', (event) => {
    if (event.target.dataset.closeModal !== undefined) closeGraveModal();
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.tools')) closeTools();
  });
  canvas.addEventListener('click', handleCanvasClick);
  window.addEventListener('keydown', handleKeyDown, { passive: false });
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', () => {
    for (const key of Object.keys(keys)) delete keys[key];
  });
}

function resize() {
  const width = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
  const height = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(width, height, false);
  updateFrustum();
}

function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastFrameTime) / 1000));
  lastFrameTime = now;
  if (!paused) {
    visualTime += dt;
    updatePlayer(dt);
    updateAnimations(dt);
    updateToast(dt);
    updateCamera(dt);
  }
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  updateNameplates();
  updateInteractionPrompt();
  requestAnimationFrame(frame);
}

function showRendererError() {
  loading.classList.remove('is-ready');
  loading.innerHTML = '<div class="loading__mark">✦</div><div class="loading__title">A little world needs WebGL</div><div class="loading__status">Try a browser with hardware acceleration enabled.</div>';
}

function boot() {
  try {
    createRenderer();
  } catch (error) {
    showRendererError();
    return;
  }
  setupWorld();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
  setupUI();
  setLocation('graveyard', true);
  resize();
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(document.documentElement);
  window.__HALLOWEEN_APP__ = {
    scene,
    camera,
    renderer,
    get phase() { return location === 'crypt' ? 1 : 0; },
    get location() { return location; },
    setLocation,
    resetPosition,
    enterCrypt,
    leaveCrypt,
    replayIntro: resetPosition,
    openGraveModal,
    closeGraveModal,
    tick: frame,
  };
  requestAnimationFrame(frame);
  window.setTimeout(() => loading.classList.add('is-ready'), 320);
}

boot();
