import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const DEFAULT_YAW_OFFSET = Math.PI;
const ANIMATED_TARGET_HEIGHT = 1.78;
const FLOATING_FACE_TARGET_HEIGHT = 2.2;

export class CharacterAvatar {
  constructor(scene, gltf = null, characterConfig = {}) {
    this.scene = scene;
    this.characterConfig = characterConfig ?? {};
    this.characterType = this.characterConfig.type ?? 'animated';
    this.yawOffset = Number.isFinite(this.characterConfig.yawOffset)
      ? this.characterConfig.yawOffset
      : DEFAULT_YAW_OFFSET;

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.visual = null;
    this.mixer = null;
    this.actions = new Map();
    this.currentAction = null;
    this.currentAnimationName = null;
    this.targetPosition = new THREE.Vector3();
    this.targetYaw = 0;

    if (gltf) {
      this.installFromGLTF(gltf);
    } else {
      this.visual = createFallbackCharacter(this.characterType);
      this.root.add(this.visual);
    }
  }

  installFromGLTF(gltf) {
    const model = SkeletonUtils.clone(gltf.scene);
    model.name = this.characterConfig.modelName ?? 'CharacterAvatar';
    model.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });

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

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;

    this.visual = model;
    this.root.add(model);

    if (this.characterType === 'animated' && gltf.animations?.length) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const wantedName of ['Idle', 'Run']) {
        const clip = findAnimationClip(gltf.animations, wantedName);
        if (!clip) continue;
        const action = this.mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        this.actions.set(wantedName, action);
      }
      this.setAnimation(this.actions.has('Idle') ? 'Idle' : 'Run', 0);
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

  applyState(state, snap = false) {
    if (!state) return;
    this.targetPosition.set(state.x, 0, state.z);
    this.targetYaw = Number.isFinite(state.yaw) ? state.yaw : 0;
    if (snap) {
      this.root.position.copy(this.targetPosition);
      this.root.rotation.y = this.targetYaw;
    }
    this.setAnimation(state.moving ? 'Run' : 'Idle');
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    this.root.position.lerp(this.targetPosition, 1 - Math.exp(-dt * 12));
    this.root.rotation.y = rotateTowards(this.root.rotation.y, this.targetYaw, dt * 14);
  }

  destroy() {
    this.scene.remove(this.root);
  }
}

function findAnimationClip(clips, wantedName) {
  const wanted = wantedName.toLowerCase();
  return clips.find((clip) => clip.name.toLowerCase() === wanted)
    ?? clips.find((clip) => clip.name.toLowerCase().includes(wanted))
    ?? null;
}

function rotateTowards(current, target, maxStep) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function createFallbackCharacter(type) {
  const group = new THREE.Group();
  const color = type === 'floatingFace' ? 0x9d6f5a : 0x4f82c9;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.36, 0.72, 5, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
  );
  body.position.y = 0.83;
  body.castShadow = true;
  group.add(body);
  return group;
}
