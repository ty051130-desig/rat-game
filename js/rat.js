import * as THREE from 'three';
import { CELL_SIZE, RAT_CONTACT_DISTANCE, RAT_SPEED } from './config.js?v=11.2';
import { DIR_DELTA, directionFromStep, findPath } from './pathfinding.js?v=11.2';

export class Rat {
  constructor(scene, stage, spawnCellName, facing) {
    this.scene = scene;
    this.stage = stage;
    this.cell = stage.parseCell(spawnCellName);
    this.facing = facing;
    this.speed = RAT_SPEED;
    this.dead = false;
    this.mesh = createPrototypeRat();
    const p = stage.cellToWorld(this.cell);
    this.mesh.position.set(p.x, 0, p.z);
    this.mesh.rotation.y = facingYaw(facing);
    scene.add(this.mesh);

    this.from = p.clone();
    this.to = p.clone();
    this.targetCell = null;
    this.targetFacing = facing;
    this.progress = 0;
  }

  update(dt, player) {
    if (this.dead) return;

    // Move at a constant world-space speed. Any distance left after reaching a
    // cell center is immediately carried into the next cell, so there is no
    // artificial pause or re-acceleration at every grid cell.
    let remainingDistance = this.speed * dt;
    let safety = 0;

    while (remainingDistance > 0.00001 && safety++ < 6) {
      if (!this.targetCell) this.chooseNext(player);
      if (!this.targetCell) break;

      const remainingInSegment = CELL_SIZE * (1 - this.progress);
      const travel = Math.min(remainingDistance, remainingInSegment);
      this.progress += travel / CELL_SIZE;
      remainingDistance -= travel;

      const t = Math.min(this.progress, 1);
      this.mesh.position.lerpVectors(this.from, this.to, t);

      if (this.progress >= 0.999999) {
        this.mesh.position.copy(this.to);
        this.cell = { ...this.targetCell };
        this.facing = this.targetFacing;
        this.targetCell = null;
        this.progress = 0;
        this.from.copy(this.mesh.position);

        // Recalculate immediately at the cell center using the player's newest
        // position. This keeps the AI responsive without visually stopping.
        this.chooseNext(player);
      }
    }

    this.mesh.rotation.y = rotateTowards(
      this.mesh.rotation.y,
      facingYaw(this.targetFacing || this.facing),
      dt * 8.5
    );
  }

  chooseNext(player) {
    const goal = this.stage.worldToCell(player.position.x, player.position.z);
    if (!goal) return;

    const path = findPath(this.stage, this.cell, this.facing, goal);
    if (path.length < 2) return;

    const next = path[1];
    const nextFacing = directionFromStep(this.cell, next);
    if (!nextFacing) return;

    this.targetCell = { ...next };
    this.targetFacing = nextFacing;
    this.from.copy(this.mesh.position);
    this.to.copy(this.stage.cellToWorld(next));
    this.progress = 0;
  }

  contactResult(player) {
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > RAT_CONTACT_DISTANCE * RAT_CONTACT_DISTANCE) return null;

    const heading = headingVector(this.targetFacing || this.facing);
    const dot = dx * heading.x + dz * heading.z;
    return dot >= 0 ? 'player-caught' : 'rat-caught';
  }

  destroy() {
    this.dead = true;
    this.scene.remove(this.mesh);
    this.mesh.traverse((o) => {
      o.geometry?.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
}

function headingVector(dir) {
  const d = DIR_DELTA[dir];
  return { x: d.dc, z: d.dr };
}

function facingYaw(dir) {
  if (dir === 'N') return 0;
  if (dir === 'E') return -Math.PI / 2;
  if (dir === 'S') return Math.PI;
  return Math.PI / 2;
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

  for (const m of [body, head, nose, earL, earR]) { m.castShadow = true; group.add(m); }
  return group;
}
