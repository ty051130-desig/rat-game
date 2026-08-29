import * as THREE from 'three';
import { PLAYER_RADIUS, PLAYER_SPEED } from './config.js?v=10.2';

const ANIMATED_TARGET_HEIGHT = 1.78;
const FLOATING_FACE_TARGET_HEIGHT = 2.20;

// The original blue character and the Monster Mash face were both authored
// facing Blender -Y. Keep the v4+ yaw correction for both models.
const DEFAULT_YAW_OFFSET = Math.PI;

const FLOAT_HEIGHT = 0.34;
const FLOAT_AMPLITUDE = 0.065;
const FLOAT_SPEED = 2.4;
const TURN_SPEED = 10;

export class Player {
  constructor(scene, stage, startCellName, gltf = null, characterConfig = {}) {
    this.stage = stage;
    this.speed = PLAYER_SPEED;
    this.radius = PLAYER_RADIUS;
    this.keys = new Set();
    this.touchInput = { x: 0, z: 0 };
    this.lastMove = new THREE.Vector3(0, 0, -1);

    this.characterConfig = characterConfig ?? {};
    this.characterType = this.characterConfig.type ?? 'animated';
    this.yawOffset = Number.isFinite(this.characterConfig.yawOffset)
      ? this.characterConfig.yawOffset
      : DEFAULT_YAW_OFFSET;

    this.floatTime = 0;
    this.visualBaseY = 0;

    // Movement/collision uses this root. The Blender model is a visual child.
    this.root = new THREE.Group();
    const start = stage.cellToWorld(startCellName);
    this.root.position.set(start.x, 0, start.z);
    scene.add(this.root);

    this.visual = null;
    this.mixer = null;
    this.actions = new Map();
    this.currentAction = null;
    this.currentAnimationName = null;

    if (gltf) {
      this.installBlenderCharacter(gltf);
    } else {
      this.visual = this.characterType === 'floatingFace'
        ? createPrototypeFloatingFace()
        : createPrototypePlayer();
      this.root.add(this.visual);
      this.visualBaseY = this.visual.position.y;
    }

    this.onKeyDown = (e) => this.keys.add(e.key.toLowerCase());
    this.onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  get position() {
    return this.root.position;
  }

  setTouchInput(x, z) {
    this.touchInput.x = Number.isFinite(x) ? x : 0;
    this.touchInput.z = Number.isFinite(z) ? z : 0;
  }

  installBlenderCharacter(gltf) {
    const model = gltf.scene;
    model.name = this.characterConfig.modelName ?? (this.characterType === 'floatingFace'
      ? 'FloatingCharacter'
      : 'AnimatedCharacter');

    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // Auto-scale both characters independently so the source Blender scale
    // does not affect gameplay.
    model.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(model);
    const rawHeight = Math.max(rawBox.max.y - rawBox.min.y, 0.001);
    const defaultTargetHeight = this.characterType === 'floatingFace'
      ? FLOATING_FACE_TARGET_HEIGHT
      : ANIMATED_TARGET_HEIGHT;
    const targetHeight = Number.isFinite(this.characterConfig.targetHeight)
      ? this.characterConfig.targetHeight
      : defaultTargetHeight;
    model.scale.setScalar(targetHeight / rawHeight);
    model.updateMatrixWorld(true);

    // Center around the gameplay root and put the model's lower edge at y=0.
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;

    this.visual = model;
    this.visualBaseY = model.position.y;
    this.root.add(model);

    // Animated characters use their embedded Idle / Run clips.
    if (this.characterType === 'animated') {
      this.installAnimations(gltf, model);
    }
  }

  installAnimations(gltf, model) {
    if (!gltf.animations?.length) {
      console.warn('キャラクターGLBにアニメーションがありません。');
      return;
    }

    this.mixer = new THREE.AnimationMixer(model);

    const idleClip = findAnimationClip(gltf.animations, 'Idle');
    const runClip = findAnimationClip(gltf.animations, 'Run');

    if (idleClip) {
      const action = this.mixer.clipAction(idleClip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set('Idle', action);
    }

    if (runClip) {
      const action = this.mixer.clipAction(runClip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions.set('Run', action);
    }

    if (!idleClip) console.warn('キャラクターGLBに Idle が見つかりません。');
    if (!runClip) console.warn('キャラクターGLBに Run が見つかりません。');

    this.setAnimation(this.actions.has('Idle') ? 'Idle' : 'Run', 0);
  }

  setAnimation(name, fadeDuration = 0.16) {
    if (this.characterType !== 'animated') return;

    const next = this.actions.get(name);
    if (!next || this.currentAnimationName === name) return;

    if (this.currentAction) {
      if (fadeDuration > 0) this.currentAction.fadeOut(fadeDuration);
      else this.currentAction.stop();
    }

    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.setEffectiveTimeScale(1);
    if (fadeDuration > 0) next.fadeIn(fadeDuration);
    next.play();

    this.currentAction = next;
    this.currentAnimationName = name;
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);

    // Floating-character mode: bob continuously while standing still.
    if (this.characterType === 'floatingFace' && this.visual) {
      this.floatTime += dt;
      const bob = Math.sin(this.floatTime * FLOAT_SPEED) * FLOAT_AMPLITUDE;
      this.visual.position.y = this.visualBaseY + FLOAT_HEIGHT + bob;
    }

    let dx = this.touchInput.x;
    let dz = this.touchInput.z;
    if (this.keys.has('w') || this.keys.has('arrowup')) dz -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dz += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    const len = Math.hypot(dx, dz);
    if (len < 0.001) {
      this.setAnimation('Idle');
      return;
    }

    // Keyboard is full speed. The mobile stick can express slower movement.
    const inputStrength = Math.min(1, len);
    dx /= len;
    dz /= len;
    this.lastMove.set(dx, 0, dz);

    const beforeX = this.position.x;
    const beforeZ = this.position.z;
    const amount = this.speed * inputStrength * dt;

    const nextX = this.position.x + dx * amount;
    if (this.stage.canOccupy(nextX, this.position.z, this.radius)) {
      this.position.x = nextX;
    }

    const nextZ = this.position.z + dz * amount;
    if (this.stage.canOccupy(this.position.x, nextZ, this.radius)) {
      this.position.z = nextZ;
    }

    const moved = Math.hypot(
      this.position.x - beforeX,
      this.position.z - beforeZ
    ) > 0.0001;
    this.setAnimation(moved ? 'Run' : 'Idle');

    // Rotate the character root toward the input direction.
    const targetYaw = Math.atan2(-dx, -dz) + this.yawOffset;
    this.root.rotation.y = rotateTowards(
      this.root.rotation.y,
      targetYaw,
      dt * TURN_SPEED
    );
  }
}

function findAnimationClip(clips, wantedName) {
  const wanted = wantedName.toLowerCase();
  return (
    clips.find((clip) => clip.name.toLowerCase() === wanted) ??
    clips.find((clip) => clip.name.toLowerCase().includes(wanted)) ??
    null
  );
}

function createPrototypePlayer() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4f82c9, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9b18d, roughness: 0.78 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x23313c, roughness: 0.8 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.72, 5, 10), bodyMat);
  body.position.y = 0.83;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10), skinMat);
  head.position.set(0, 1.55, -0.03);
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.06), darkMat);
  face.position.set(0, 1.55, -0.285);
  for (const m of [body, head, face]) {
    m.castShadow = true;
    group.add(m);
  }
  return group;
}

function createPrototypeFloatingFace() {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x9d6f5a, roughness: 0.76 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.85 });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 16), skin);
  head.scale.set(0.88, 1.0, 0.72);
  head.position.y = 0.72;
  head.castShadow = true;
  group.add(head);

  // Simple fallback face so Stage 2 remains playable when the user's GLB has
  // not yet been copied into assets/models.
  for (const x of [-0.18, 0.18]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
    eye.position.set(x, 0.82, -0.42);
    group.add(eye);
  }
  return group;
}

function rotateTowards(current, target, maxStep) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}
