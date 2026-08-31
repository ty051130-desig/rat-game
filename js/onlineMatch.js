import * as THREE from 'three';
import { CharacterAvatar } from './avatar.js?v=11.2';
import { Stage } from './stage.js?v=11.2';

export class OnlineMatchClient {
  constructor(scene, stageData, assets = {}) {
    this.scene = scene;
    this.stageData = stageData;
    this.assets = assets;
    this.socket = null;
    this.roomCode = '';
    this.localSlot = null;
    this.connectedPlayers = 0;
    this.state = 'idle';
    this.stage = null;
    this.avatars = new Map();
    this.ratVisuals = new Map();
    this.latestSnapshot = null;
    this.hasSnapshot = false;
    this.sendTimer = 0;
    this.input = { x: 0, z: 0 };

    this.onStatus = () => {};
    this.onRoom = () => {};
    this.onCountdown = () => {};
    this.onMatchStarted = () => {};
    this.onMatchEnded = () => {};
    this.onRematchStatus = () => {};
    this.onRoomClosed = () => {};
  }

  connect(serverUrl) {
    if (this.socket) this.socket.disconnect();
    if (!window.io) throw new Error('Socket.IO client failed to load.');

    this.socket = window.io(serverUrl, { transports: ['websocket', 'polling'] });
    this.onStatus('サーバーに接続中...');

    this.socket.on('connect', () => {
      this.state = 'lobby';
      this.onStatus('接続しました。部屋を作成するか、ルームコードを入力して参加してください。');
    });

    this.socket.on('room_created', (payload) => {
      this.roomCode = payload.code;
      this.localSlot = payload.slot;
      this.connectedPlayers = payload.players;
      this.onRoom({ code: this.roomCode, slot: this.localSlot, players: this.connectedPlayers });
      this.onStatus(`部屋 ${this.roomCode} を作成しました。相手の参加を待っています。`);
    });

    this.socket.on('room_joined', (payload) => {
      this.roomCode = payload.code;
      this.localSlot = payload.slot;
      this.connectedPlayers = payload.players;
      this.onRoom({ code: this.roomCode, slot: this.localSlot, players: this.connectedPlayers });
      this.onStatus(`部屋 ${this.roomCode} に参加しました。`);
    });

    this.socket.on('room_update', (payload) => {
      this.roomCode = payload.code;
      this.connectedPlayers = payload.players;
      this.onRoom({ code: this.roomCode, slot: this.localSlot, players: this.connectedPlayers });
      this.onStatus(`部屋 ${this.roomCode} / 参加人数 ${this.connectedPlayers}/2`);
    });

    this.socket.on('countdown', (payload) => {
      this.state = 'countdown';
      this.ensureStage();
      if (payload.value === 3) this.prepareForCountdown();
      this.onCountdown(payload.value);
    });

    this.socket.on('match_started', (payload) => {
      this.state = 'playing';
      this.ensureStage();
      this.onMatchStarted({ code: payload.code, duration: payload.duration, slot: this.localSlot });
      this.onStatus(`対戦開始！ ルーム ${payload.code}`);
    });

    this.socket.on('state', (snapshot) => {
      this.latestSnapshot = snapshot;
      if (this.state === 'playing') this.applySnapshot(snapshot);
    });

    this.socket.on('match_ended', (payload) => {
      this.state = 'ended';
      this.onMatchEnded(payload);
    });

    this.socket.on('rematch_status', (payload) => {
      this.onRematchStatus(payload);
    });

    this.socket.on('room_closed', (payload) => {
      this.state = 'closed';
      this.onRoomClosed(payload);
    });

    this.socket.on('room_error', (payload) => {
      this.onStatus(payload.message || 'エラーが発生しました。');
    });
  }

  ensureStage() {
    if (this.stage) return;
    this.stage = new Stage(this.scene, this.stageData);
    for (const slot of ['p1', 'p2']) {
      const avatar = new CharacterAvatar(
        this.scene,
        this.assets[slot] ?? null,
        this.stageData.battleCharacters[slot]
      );
      const start = this.stage.cellToWorld(this.stageData.playerStarts[slot]);
      avatar.applyState({ x: start.x, z: start.z, yaw: slot === 'p1' ? 0 : Math.PI, moving: false }, true);
      this.avatars.set(slot, avatar);
    }
  }


  prepareForCountdown() {
    this.hasSnapshot = false;
    this.latestSnapshot = null;
    for (const visual of this.ratVisuals.values()) visual.destroy();
    this.ratVisuals.clear();

    for (const slot of ['p1', 'p2']) {
      const avatar = this.avatars.get(slot);
      if (!avatar || !this.stage) continue;
      const start = this.stage.cellToWorld(this.stageData.playerStarts[slot]);
      avatar.applyState({
        x: start.x,
        z: start.z,
        yaw: slot === 'p1' ? 0 : Math.PI,
        moving: false
      }, true);
    }
  }

  createRoom() {
    this.socket?.emit('create_room');
  }

  joinRoom(code) {
    this.socket?.emit('join_room', { code });
  }

  requestRematch() {
    if (this.state !== 'ended') return;
    this.socket?.emit('rematch_ready');
  }

  leave() {
    this.socket?.emit('leave_room');
    this.socket?.disconnect();
  }

  setInput(x, z) {
    this.input.x = Number.isFinite(x) ? x : 0;
    this.input.z = Number.isFinite(z) ? z : 0;
  }

  update(dt) {
    if (this.state === 'playing') {
      this.sendTimer += dt;
      while (this.sendTimer >= 0.05) {
        this.sendTimer -= 0.05;
        if (this.roomCode) {
          this.socket?.emit('player_input', {
            inputX: this.input.x,
            inputZ: this.input.z
          });
        }
      }
    }

    for (const avatar of this.avatars.values()) avatar.update(dt);
    for (const rat of this.ratVisuals.values()) rat.update(dt);
  }

  applySnapshot(snapshot) {
    const snapPlayers = !this.hasSnapshot;
    for (const slot of ['p1', 'p2']) {
      const avatar = this.avatars.get(slot);
      if (!avatar) continue;
      avatar.applyState(snapshot.players[slot], snapPlayers);
    }
    this.hasSnapshot = true;

    const seen = new Set();
    for (const state of snapshot.rats) {
      let visual = this.ratVisuals.get(state.id);
      if (!visual) {
        visual = new RatVisual(this.scene);
        visual.applyState(state, true);
        this.ratVisuals.set(state.id, visual);
      } else {
        visual.applyState(state, false);
      }
      seen.add(state.id);
    }

    for (const [id, visual] of [...this.ratVisuals.entries()]) {
      if (seen.has(id)) continue;
      visual.destroy();
      this.ratVisuals.delete(id);
    }
  }
}

class RatVisual {
  constructor(scene) {
    this.scene = scene;
    this.root = createPrototypeRat();
    this.scene.add(this.root);
    this.targetPosition = new THREE.Vector3();
    this.targetYaw = 0;
  }

  applyState(state, snap = false) {
    this.targetPosition.set(state.x, 0, state.z);
    this.targetYaw = state.yaw ?? 0;
    if (snap) {
      this.root.position.copy(this.targetPosition);
      this.root.rotation.y = this.targetYaw;
    }
  }

  update(dt) {
    this.root.position.lerp(this.targetPosition, 1 - Math.exp(-dt * 15));
    this.root.rotation.y = rotateTowards(this.root.rotation.y, this.targetYaw, dt * 12);
  }

  destroy() {
    this.scene.remove(this.root);
  }
}

function rotateTowards(current, target, maxStep) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  if (Math.abs(delta) <= maxStep) return target;
  return current + Math.sign(delta) * maxStep;
}

function createPrototypeRat() {
  const group = new THREE.Group();
  const fur = new THREE.MeshStandardMaterial({ color: 0x777068, roughness: 0.92 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb98c83, roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.43, 14, 10), fur);
  body.scale.set(0.85, 0.62, 1.28);
  body.position.y = 0.42;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 9), fur);
  head.scale.set(0.85, 0.78, 1.1);
  head.position.set(0, 0.46, -0.48);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), black);
  nose.position.set(0, 0.43, -0.78);
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), skin);
  const earR = earL.clone();
  earL.position.set(-0.2, 0.67, -0.45);
  earR.position.set(0.2, 0.67, -0.45);

  for (const m of [body, head, nose, earL, earR]) {
    m.castShadow = true;
    group.add(m);
  }
  return group;
}
