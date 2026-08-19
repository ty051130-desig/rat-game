import * as THREE from 'three';
import { PLAYER_RADIUS, PLAYER_SPEED } from './config.js';

const MODEL_TARGET_HEIGHT = 1.78;
const MODEL_YAW_OFFSET = Math.PI;

export class Player {
  constructor(scene, stage, startCellName, gltf = null) {
    this.stage = stage;
    this.speed = PLAYER_SPEED;
    this.radius = PLAYER_RADIUS;
    this.keys = new Set();
    this.touchInput = { x: 0, z: 0 };
    this.lastMove = new THREE.Vector3(0, 0, -1);

    // Movement/collision uses this root. The Blender model is only a visual child.
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
      this.visual = createPrototypePlayer();
      this.root.add(this.visual);
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
    model.name = 'MainCharacter';

    // Enable shadows for every mesh exported from Blender.
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

    // Automatically resize the Blender model to match the prototype's gameplay size.
    model.updateMatrixWorld(true);
    const rawBox = new THREE.Box3().setFromObject(model);
    const rawHeight = Math.max(rawBox.max.y - rawBox.min.y, 0.001);
    const uniformScale = MODEL_TARGET_HEIGHT / rawHeight;
    model.scale.setScalar(uniformScale);
    model.updateMatrixWorld(true);

    // Put the feet on y=0 and center the model horizontally around the gameplay root.
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;

    this.visual = model;
    this.root.add(model);

    if (gltf.animations?.length) {
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

      if (!idleClip) console.warn('main_character.glb に Idle アニメーションが見つかりません。', gltf.animations.map((a) => a.name));
      if (!runClip) console.warn('main_character.glb に Run アニメーションが見つかりません。', gltf.animations.map((a) => a.name));

      this.setAnimation(this.actions.has('Idle') ? 'Idle' : 'Run', 0);
    } else {
      console.warn('main_character.glb にアニメーションが含まれていません。');
    }
  }

  setAnimation(name, fadeDuration = 0.16) {
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
    // Animation keeps progressing even while the player is standing still.
    if (this.mixer) this.mixer.update(dt);

    let dx = this.touchInput.x;
    let dz = this.touchInput.z;
    if (this.keys.has('w') || this.keys.has('arrowup')) dz -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dz += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    let len = Math.hypot(dx, dz);
    if (len < 0.001) {
      this.setAnimation('Idle');
      return;
    }

    // Keyboard is full speed. A virtual stick can also express slower movement.
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

    const moved = Math.hypot(this.position.x - beforeX, this.position.z - beforeZ) > 0.0001;
    this.setAnimation(moved ? 'Run' : 'Idle');

    // The Blender character was modeled facing Blender -Y, which exports as local -Z.
    const targetYaw = Math.atan2(-dx, -dz) + MODEL_YAW_OFFSET;
    this.root.rotation.y = rotateTowards(this.root.rotation.y, targetYaw, dt * 10);
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

function rotateTowards(current, target, maxStep) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}
