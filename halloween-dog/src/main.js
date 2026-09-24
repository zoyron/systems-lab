import * as THREE from 'three';
import './styles.css';
import {
  COLORS,
  damp,
  easeInOut,
  embers,
  geometry,
  lanternSystems,
  leaves,
  materials,
} from './kit.js';
import { createGhost } from './actors.js';
import { buildGraveyard } from './outdoor.js';
import { buildCrypt } from './indoor.js';

const canvas = document.getElementById('viewport');
const uiRoot = document.getElementById('ui-root');
const loading = document.getElementById('loading');
const placeLabel = document.getElementById('place-label');
const sequenceProgress = document.getElementById('sequence-progress');
const sequenceLabel = document.getElementById('sequence-label');
const pauseButton = document.getElementById('pause-button');
const pauseLabel = document.getElementById('pause-label');
const replayButton = document.getElementById('replay-button');
const toolsButton = document.getElementById('tools-button');
const toolsPanel = document.getElementById('tools-panel');
const toast = document.getElementById('toast');
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
const autoPosition = new THREE.Vector3();
const clickTarget = new THREE.Vector3();
const nameWorld = new THREE.Vector3();
const nameScreen = new THREE.Vector3();
const tempA = new THREE.Vector3();
const tempB = new THREE.Vector3();
let renderer;
let scene;
let camera;
let graveyard;
let crypt;
let ghost;
let collider;
let phase = 0;
let sequenceTime = 0;
let visualTime = 0;
let paused = false;
let modalOpen = false;
let freeExplore = false;
let manualInput = false;
let clickMoving = false;
let toastTimer = 0;
let cameraHeight = 14.4;
let desiredCameraHeight = 14.4;
let lastFrameTime = performance.now();
let currentAspect = 1;

function activeLocation() {
  return phase === 1 ? crypt : graveyard;
}

function addLabel(text, object, location, offsetY, radius, kind) {
  const element = document.createElement('div');
  element.className = 'nameplate';
  const mark = document.createElement('span');
  mark.className = 'nameplate__mark';
  const label = document.createElement('span');
  label.textContent = text;
  element.append(mark, label);
  uiRoot.appendChild(element);
  nameplates.push({ element, object, location, offsetY, radius, kind, opacity: 0 });
}

function addHit(location, hit, type, label, radius, action) {
  const item = { location, hit, type, label, radius, action };
  interactables.push(item);
  return item;
}

function setupWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.void);
  const ambient = new THREE.HemisphereLight(0x6e7a8d, 0x20140e, 0.68);
  scene.add(ambient);
  const moon = new THREE.DirectionalLight(0x8191b3, 1.3);
  moon.position.set(-7, 14, 8);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1536, 1536);
  moon.shadow.camera.left = -11;
  moon.shadow.camera.right = 11;
  moon.shadow.camera.top = 11;
  moon.shadow.camera.bottom = -11;
  moon.shadow.camera.near = 1;
  moon.shadow.camera.far = 35;
  moon.shadow.bias = -0.0005;
  scene.add(moon);
  scene.add(new THREE.AmbientLight(0x3c2419, 0.32));
  graveyard = buildGraveyard(scene);
  crypt = buildCrypt(scene);
  const graveHit = addHit(graveyard.group, graveyard.graveHit, 'grave', "Zozo's grave", 2.35, openGraveModal);
  addLabel("Zozo's grave", graveHit.hit, graveyard.group, 1.9, 2.35, 'grave');
  addLabel('Zozo', graveyard.dog, graveyard.group, 1.28, 2.2, 'dog');
  const dogHit = new THREE.Mesh(geometry.box, materials.invisible);
  dogHit.position.set(0.2, 0.5, 0.95);
  dogHit.scale.set(0.95, 0.95, 1.45);
  dogHit.userData.noShadow = true;
  graveyard.group.add(dogHit);
  addHit(graveyard.group, dogHit, 'dog', 'Zozo', 1.8, () => showToast('Zozo is off in a cloud of white paws.'));
  addLabel('Lutin', crypt.lutin, crypt.group, 1.55, 3.2, 'lutin');
  addHit(crypt.group, crypt.lutinHit, 'lutin', 'Lutin', 2.8, () => showToast('Lutin keeps a small orange light beneath the desk.'));
  addLabel('Green portal', crypt.portal.group, crypt.group, 3.35, 3.1, 'portal');
  addHit(crypt.group, crypt.portal.hit, 'portal', 'Green portal', 3.1, () => showToast('The green light hums like a held breath.'));
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
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(COLORS.void, 1);
}

function cameraOffset() {
  if (phase === 1) return tempA.set(10.5, 16, 13);
  return tempA.set(14, 20, 16);
}

function updateFrustum() {
  const width = Math.max(1, renderer.domElement.clientWidth || window.innerWidth || 1);
  const height = Math.max(1, renderer.domElement.clientHeight || window.innerHeight || 1);
  currentAspect = width / height;
  const baseWidth = phase === 1 ? 11.2 : 16.8;
  const minimumHeight = phase === 1 ? 9.4 : 13.2;
  const portraitHeight = baseWidth / Math.max(0.45, currentAspect);
  const finalHeight = Math.max(minimumHeight, portraitHeight, cameraHeight);
  camera.left = -finalHeight * currentAspect * 0.5;
  camera.right = finalHeight * currentAspect * 0.5;
  camera.top = finalHeight * 0.5;
  camera.bottom = -finalHeight * 0.5;
  camera.updateProjectionMatrix();
}

function cutCamera() {
  const targetY = phase === 1 ? 0.85 : 0.62;
  cameraTarget.set(phase === 1 ? 0.15 : ghost.root.position.x - 0.12, targetY, phase === 1 ? -0.05 : ghost.root.position.z - 0.2);
  camera.position.copy(cameraTarget).add(cameraOffset());
  camera.lookAt(cameraTarget);
  cameraHeight = desiredCameraHeight;
  updateFrustum();
}

function setLocation(nextPhase, free = false) {
  phase = nextPhase;
  freeExplore = free;
  graveyard.group.visible = phase !== 1;
  crypt.group.visible = phase === 1;
  placeLabel.textContent = phase === 1 ? 'Crypt' : 'Graveyard';
  sequenceLabel.textContent = phase === 1 ? 'A room between breaths' : phase === 2 ? 'The little dog returns' : 'A fireside introduction';
  clickMoving = false;
  manualInput = false;
  if (phase === 0) {
    ghost.root.position.set(0, 0, 3.35);
    desiredCameraHeight = 14.4;
  } else if (phase === 1) {
    ghost.root.position.set(0, 0, 0.2);
    ghost.root.rotation.y = 0;
    desiredCameraHeight = 10.5;
  } else {
    ghost.root.position.set(3.25, 0, 2.85);
    ghost.root.rotation.y = 0;
    desiredCameraHeight = 16.4;
  }
  cutCamera();
  updateSequenceUI();
}

function updateSequenceUI() {
  const progress = freeExplore ? 1 : Math.max(0, Math.min(1, sequenceTime / 14.5));
  sequenceProgress.style.width = `${(progress * 100).toFixed(2)}%`;
  if (!freeExplore) {
    if (sequenceTime < 6.8) sequenceLabel.textContent = 'A fireside introduction';
    else if (sequenceTime < 12.1) sequenceLabel.textContent = 'A room between breaths';
    else sequenceLabel.textContent = 'The little dog returns';
  } else {
    sequenceLabel.textContent = phase === 1 ? 'A room between breaths' : 'A fireside introduction';
  }
}

function updateSequence(dt) {
  if (freeExplore || modalOpen || paused) return;
  sequenceTime += dt;
  if (sequenceTime >= 6.8 && phase === 0) {
    setLocation(1, false);
    showToast('A green door waits in the dark.');
  }
  if (sequenceTime >= 12.1 && phase === 1) {
    setLocation(2, false);
    showToast('Back outside. Zozo has found the lawn.');
  }
  if (sequenceTime >= 14.5 && !freeExplore) {
    freeExplore = true;
    manualInput = true;
    showToast('The little fire keeps burning.');
  }
  updateSequenceUI();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = 2.7;
}

function updateToast(dt) {
  if (toastTimer <= 0) return;
  toastTimer -= dt;
  if (toastTimer <= 0) toast.classList.remove('is-visible');
}

function openGraveModal() {
  if (modalOpen) return;
  modalOpen = true;
  modal.hidden = false;
  modalClose.focus();
}

function closeGraveModal() {
  if (!modalOpen) return;
  modalOpen = false;
  modal.hidden = true;
  canvas.focus();
}

function setPaused(value) {
  paused = value;
  pauseLabel.textContent = paused ? 'Resume the scene' : 'Pause the scene';
}

function closeTools() {
  toolsPanel.hidden = true;
  toolsButton.setAttribute('aria-expanded', 'false');
}

function replayIntro() {
  closeGraveModal();
  closeTools();
  sequenceTime = 0;
  visualTime = 0;
  paused = false;
  setPaused(false);
  freeExplore = false;
  setLocation(0, false);
  showToast('The fire is already waiting.');
}

function enterFreePlace(place) {
  closeGraveModal();
  closeTools();
  sequenceTime = 14.5;
  freeExplore = true;
  if (place === 'crypt') setLocation(1, true);
  else {
    setLocation(2, true);
    ghost.root.position.set(1.3, 0, 2.3);
  }
  manualInput = true;
  showToast(place === 'crypt' ? 'The green doorway is still humming.' : 'The graveyard is yours to wander.');
}

function updateCamera(dt) {
  if (phase === 1) desiredCameraTarget.set(0.15, 0.9, -0.05);
  else desiredCameraTarget.set(ghost.root.position.x + (phase === 2 ? 0.35 : -0.12), 0.62, ghost.root.position.z + (phase === 2 ? 0.1 : -0.2));
  const followRate = phase === 1 ? 1.65 : 1.9;
  cameraTarget.lerp(desiredCameraTarget, 1 - Math.exp(-followRate * dt));
  cameraScratch.copy(cameraTarget).add(cameraOffset());
  camera.position.lerp(cameraScratch, 1 - Math.exp(-2.4 * dt));
  cameraLook.copy(cameraTarget);
  camera.lookAt(cameraLook);
  if (Math.abs(cameraHeight - desiredCameraHeight) > 0.01) {
    cameraHeight = damp(cameraHeight, desiredCameraHeight, 2.8, dt);
    updateFrustum();
  }
}

function resolvePlayerCollision() {
  const location = activeLocation();
  const radius = 0.56;
  for (const obstacle of location.obstacles) {
    const dx = ghost.root.position.x - obstacle.x;
    const dz = ghost.root.position.z - obstacle.z;
    const distance = Math.hypot(dx, dz);
    const minDistance = radius + obstacle.r;
    if (distance < minDistance && distance > 0.0001) {
      const push = (minDistance - distance) / distance;
      ghost.root.position.x += dx * push;
      ghost.root.position.z += dz * push;
    }
  }
  if (phase === 1) {
    ghost.root.position.x = Math.max(-3.65, Math.min(3.65, ghost.root.position.x));
    ghost.root.position.z = Math.max(-2.8, Math.min(2.75, ghost.root.position.z));
  } else {
    ghost.root.position.x = Math.max(-6.65, Math.min(6.7, ghost.root.position.x));
    ghost.root.position.z = Math.max(-5.0, Math.min(4.75, ghost.root.position.z));
  }
}

function updatePlayer(dt) {
  const inputX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const inputZ = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
  movementInput.set(inputX, 0, inputZ);
  const hasMovement = movementInput.lengthSq() > 0;
  if (hasMovement) {
    manualInput = true;
    clickMoving = false;
    movementInput.normalize();
    desiredVelocity.copy(movementInput).multiplyScalar(3.4);
  } else {
    desiredVelocity.set(0, 0, 0);
  }
  if (!manualInput && phase === 0 && !freeExplore && !modalOpen) {
    const approach = easeInOut(sequenceTime / 4.8);
    autoPosition.set(0, 0, 3.35).lerp(tempB.set(-1.05, 0, 0.9), approach);
    ghost.root.position.x = damp(ghost.root.position.x, autoPosition.x, 3.4, dt);
    ghost.root.position.z = damp(ghost.root.position.z, autoPosition.z, 3.4, dt);
    playerVelocity.set(0, 0, 0);
    if (approach > 0.02) ghost.root.rotation.y = damp(ghost.root.rotation.y, 0, 2.5, dt);
  } else if (clickMoving) {
    const dx = clickTarget.x - ghost.root.position.x;
    const dz = clickTarget.z - ghost.root.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.12) {
      clickMoving = false;
      playerVelocity.set(0, 0, 0);
    } else {
      desiredVelocity.set(dx / distance, 0, dz / distance).multiplyScalar(Math.min(3.4, 1.3 + distance * 1.8));
      playerVelocity.lerp(desiredVelocity, 1 - Math.exp(-8 * dt));
      ghost.root.position.addScaledVector(playerVelocity, dt);
      ghost.root.rotation.y = damp(ghost.root.rotation.y, Math.atan2(dx, dz), 8, dt);
    }
  } else {
    playerVelocity.lerp(desiredVelocity, 1 - Math.exp(-10 * dt));
    ghost.root.position.addScaledVector(playerVelocity, dt);
    if (playerVelocity.lengthSq() > 0.03) ghost.root.rotation.y = damp(ghost.root.rotation.y, Math.atan2(playerVelocity.x, playerVelocity.z), 8, dt);
  }
  resolvePlayerCollision();
  collider.position.y = 0.9;
  const bob = Math.sin(visualTime * 2.35) * 0.075;
  ghost.visual.position.y = 0.15 + bob;
  ghost.visual.rotation.z = Math.sin(visualTime * 1.3) * 0.018;
  ghost.visual.scale.y = 1 + Math.sin(visualTime * 2.35) * 0.018;
}

function updateFire(system) {
  const flicker = 0.86 + Math.sin(visualTime * 7.1 + system.light.userData.phase) * 0.08 + Math.sin(visualTime * 13.7 + 1.3) * 0.045;
  system.light.intensity = system.light.userData.baseIntensity * flicker;
  system.flameBase.scale.x = 0.48 + flicker * 0.08;
  system.flameBase.scale.y = 1.32 + flicker * 0.22;
  system.flameMid.rotation.z = Math.sin(visualTime * 5.4 + 1.2) * 0.06;
  system.flameCore.scale.y = 0.68 + Math.sin(visualTime * 9.2) * 0.11;
  for (let i = 0; i < system.smoke.length; i += 1) {
    const puff = system.smoke[i];
    const cycle = (visualTime * puff.userData.speed + puff.userData.phase) % 5.2;
    const normalized = cycle / 5.2;
    puff.position.x = puff.userData.drift * normalized + Math.sin(visualTime * 0.8 + i) * 0.14;
    puff.position.y = 1.18 + cycle;
    puff.position.z = Math.sin(visualTime * 0.6 + i * 1.7) * 0.16;
    const size = 0.32 + normalized * 0.9;
    puff.scale.set(size, size * 0.82, 1);
    puff.material.opacity = 0.24 * (1 - normalized) * (0.65 + flicker * 0.35);
  }
}

function updateDog() {
  const data = graveyard.dog.userData;
  if (phase === 2) {
    const travel = (visualTime * 0.38) % 5.2;
    const direction = travel < 2.6 ? 1 : -1;
    const localTravel = travel < 2.6 ? travel : 5.2 - travel;
    graveyard.dog.position.x = 5.05 + localTravel * 0.82;
    graveyard.dog.position.z = 1.5 + Math.sin(visualTime * 0.9) * 0.38;
    graveyard.dog.rotation.y = direction > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
    const gait = visualTime * 10.5;
    for (let i = 0; i < data.legs.length; i += 1) data.legs[i].rotation.x = Math.sin(gait + (i % 2) * Math.PI + (i < 2 ? 0 : Math.PI)) * 0.55;
    data.head.position.y = 0.7 + Math.abs(Math.sin(gait * 0.5)) * 0.035;
    data.body.position.y = 0.46 + Math.abs(Math.sin(gait)) * 0.035;
    data.tail.rotation.z = Math.sin(visualTime * 8) * 0.22;
  } else {
    graveyard.dog.position.set(0.2, 0.02, 0.95);
    graveyard.dog.rotation.y = -0.5;
    for (let i = 0; i < data.legs.length; i += 1) data.legs[i].rotation.x = damp(data.legs[i].rotation.x, 0, 7, 0.016);
    data.head.position.y = 0.7 + Math.sin(visualTime * 2.1) * 0.035;
    data.body.position.y = 0.46 + Math.sin(visualTime * 2.1 + 0.5) * 0.018;
    data.tail.rotation.z = Math.sin(visualTime * 2.2) * 0.14;
  }
}

function updateSkeletons() {
  if (graveyard.skeleton) {
    graveyard.skeleton.rotation.z = Math.sin(visualTime * 1.1) * 0.012;
    graveyard.skeleton.userData.head.rotation.y = Math.sin(visualTime * 0.65) * 0.08;
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
    const cycle = (visualTime * leaf.userData.speed + leaf.userData.phase) % 10;
    leaf.position.y = 5.5 - cycle * 0.52;
    leaf.position.x += Math.sin(visualTime * 0.55 + i) * 0.0018;
    leaf.position.z += Math.cos(visualTime * 0.48 + i) * 0.0014;
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
  const pulse = 7.4 + Math.sin(visualTime * 2.3) * 1.4 + Math.sin(visualTime * 5.1) * 0.45;
  crypt.portal.light.intensity = pulse;
  crypt.portal.halo.scale.set(0.82 + Math.sin(visualTime * 2.3) * 0.08, 1.18 + Math.sin(visualTime * 2.3) * 0.1, 0.08);
}

function updateAnimations() {
  if (graveyard.fire) updateFire(graveyard.fire);
  updateDog();
  updateSkeletons();
  updateLanterns();
  updateLeaves();
  updateEmbers();
  updatePortal();
}

function updateNameplates() {
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;
  for (const label of nameplates) {
    const locationVisible = label.location === (phase === 1 ? crypt.group : graveyard.group) && label.location.visible;
    label.object.getWorldPosition(nameWorld);
    nameWorld.y += label.offsetY;
    const distance = Math.hypot(nameWorld.x - ghost.root.position.x, nameWorld.z - ghost.root.position.z);
    const proximity = Math.max(0, Math.min(1, 1 - (distance - 0.8) / Math.max(0.1, label.radius)));
    const baseOpacity = label.kind === 'portal' ? 0.3 : 0.12;
    const targetOpacity = locationVisible && distance < label.radius * 2.2 ? Math.max(baseOpacity, proximity) : 0;
    label.opacity = damp(label.opacity, targetOpacity, 10, 0.05);
    nameScreen.copy(nameWorld).project(camera);
    const onScreen = nameScreen.z > -1 && nameScreen.z < 1 && nameScreen.x > -1.08 && nameScreen.x < 1.08 && nameScreen.y > -1.08 && nameScreen.y < 1.08;
    label.element.style.left = `${(nameScreen.x * 0.5 + 0.5) * width}px`;
    label.element.style.top = `${(-nameScreen.y * 0.5 + 0.5) * height}px`;
    label.element.style.opacity = onScreen ? label.opacity.toFixed(3) : '0';
  }
}

function nearestInteractable() {
  const location = activeLocation();
  let best = null;
  let bestDistance = Infinity;
  for (const item of interactables) {
    if (item.location !== location.group) continue;
    item.hit.getWorldPosition(tempA);
    const distance = tempA.distanceTo(ghost.root.position);
    if (distance < item.radius && distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
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
  const location = activeLocation();
  const hits = raycaster.intersectObjects(interactables.filter((item) => item.location === location.group).map((item) => item.hit), false);
  if (hits.length > 0) {
    const item = interactables.find((candidate) => candidate.hit === hits[0].object);
    if (item) {
      interactWith(item);
      return;
    }
  }
  groundPlane.constant = phase === 1 ? -0.11 : -0.08;
  if (raycaster.ray.intersectPlane(groundPlane, clickPoint)) {
    clickTarget.set(phase === 1 ? Math.max(-3.5, Math.min(3.5, clickPoint.x)) : Math.max(-6.4, Math.min(6.4, clickPoint.x)), 0, phase === 1 ? Math.max(-2.65, Math.min(2.6, clickPoint.z)) : Math.max(-4.8, Math.min(4.5, clickPoint.z)));
    clickMoving = true;
    manualInput = true;
    freeExplore = true;
    updateSequenceUI();
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
    interactWith(nearestInteractable());
    return;
  }
  if (key === 'p') {
    setPaused(!paused);
    return;
  }
  if (key === 'r') {
    replayIntro();
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
  replayButton.addEventListener('click', replayIntro);
  modalClose.addEventListener('click', closeGraveModal);
  modal.addEventListener('click', (event) => {
    if (event.target.dataset.closeModal !== undefined) closeGraveModal();
  });
  document.querySelectorAll('[data-place]').forEach((button) => button.addEventListener('click', () => enterFreePlace(button.dataset.place)));
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
    updateSequence(dt);
    updatePlayer(dt);
    updateAnimations();
    updateToast(dt);
    updateCamera(dt);
  }
  camera.updateMatrixWorld();
  renderer.render(scene, camera);
  updateNameplates();
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
  camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
  camera.position.set(14, 20, 16);
  setupUI();
  setLocation(0, false);
  resize();
  window.addEventListener('resize', resize);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(document.documentElement);
  window.__HALLOWEEN_APP__ = { scene, camera, renderer, get phase() { return phase; }, setLocation, replayIntro, openGraveModal, closeGraveModal, tick: frame };
  requestAnimationFrame(frame);
  window.setTimeout(() => loading.classList.add('is-ready'), 320);
}

boot();
