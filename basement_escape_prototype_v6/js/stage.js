import * as THREE from 'three';
import { CELL_SIZE } from './config.js';

export class Stage {
  constructor(scene, data) {
    this.scene = scene;
    this.data = data;
    this.width = data.cols * CELL_SIZE;
    this.depth = data.rows * CELL_SIZE;
    this.occupied = new Set(data.occupiedCells);
    this.obstacleRects = [];
    this.pipeVisuals = new Map();
    this.group = new THREE.Group();
    scene.add(this.group);

    this.buildEnvironment();
    this.buildObstacles();
    this.buildPipes();
  }

  parseCell(cellName) {
    const match = /^([a-zA-Z])(\d+)$/.exec(cellName);
    if (!match) throw new Error(`Invalid cell: ${cellName}`);
    return {
      row: match[1].toLowerCase().charCodeAt(0) - 97,
      col: Number(match[2]) - 1
    };
  }

  cellName(row, col) {
    return `${String.fromCharCode(97 + row)}${col + 1}`;
  }

  cellToWorld(cellOrName) {
    const cell = typeof cellOrName === 'string' ? this.parseCell(cellOrName) : cellOrName;
    return new THREE.Vector3(
      -this.width / 2 + CELL_SIZE / 2 + cell.col * CELL_SIZE,
      0,
      -this.depth / 2 + CELL_SIZE / 2 + cell.row * CELL_SIZE
    );
  }

  worldToCell(x, z) {
    const col = Math.floor((x + this.width / 2) / CELL_SIZE);
    const row = Math.floor((z + this.depth / 2) / CELL_SIZE);
    if (row < 0 || row >= this.data.rows || col < 0 || col >= this.data.cols) return null;
    return { row, col };
  }

  isWalkableCell(row, col) {
    if (row < 0 || row >= this.data.rows || col < 0 || col >= this.data.cols) return false;
    return !this.occupied.has(this.cellName(row, col));
  }

  getPipeVisual(pipeId) {
    return this.pipeVisuals.get(pipeId) ?? null;
  }

  canOccupy(x, z, radius) {
    const minX = -this.width / 2 + radius;
    const maxX = this.width / 2 - radius;
    const minZ = -this.depth / 2 + radius;
    const maxZ = this.depth / 2 - radius;
    if (x < minX || x > maxX || z < minZ || z > maxZ) return false;

    for (const rect of this.obstacleRects) {
      const nearestX = Math.max(rect.minX, Math.min(x, rect.maxX));
      const nearestZ = Math.max(rect.minZ, Math.min(z, rect.maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
    return true;
  }

  buildEnvironment() {
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(this.width + 0.5, 0.35, this.depth + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x555955, roughness: 0.96, metalness: 0.03 })
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Thin basement boundary walls. They show the room edge without covering the playfield.
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x343a38, roughness: 0.92 });
    const wallH = 0.65;
    const wallT = 0.35;
    const north = new THREE.Mesh(new THREE.BoxGeometry(this.width + 0.7, wallH, wallT), wallMaterial);
    const south = north.clone();
    north.position.set(0, wallH / 2, -this.depth / 2 - wallT / 2);
    south.position.set(0, wallH / 2, this.depth / 2 + wallT / 2);
    const west = new THREE.Mesh(new THREE.BoxGeometry(wallT, wallH, this.depth + 0.7), wallMaterial);
    const east = west.clone();
    west.position.set(-this.width / 2 - wallT / 2, wallH / 2, 0);
    east.position.set(this.width / 2 + wallT / 2, wallH / 2, 0);
    for (const wall of [north, south, west, east]) {
      wall.castShadow = wall.receiveShadow = true;
      this.group.add(wall);
    }

    // Basement details: back-wall pipes and a couple of floor drains, non-colliding.
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x59625e, roughness: 0.55, metalness: 0.5 });
    for (const x of [-8.5, 6.8]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 4.2, 12), detailMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(x, 0.35, -this.depth / 2 - 0.28);
      this.group.add(pipe);
    }
  }

  buildObstacles() {
    for (const def of this.data.obstacles) {
      const cells = def.cells.map((c) => this.parseCell(c));
      const rows = cells.map((c) => c.row);
      const cols = cells.map((c) => c.col);
      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);

      const minCellWorld = this.cellToWorld({ row: minRow, col: minCol });
      const maxCellWorld = this.cellToWorld({ row: maxRow, col: maxCol });
      const minX = minCellWorld.x - CELL_SIZE / 2;
      const maxX = maxCellWorld.x + CELL_SIZE / 2;
      const minZ = minCellWorld.z - CELL_SIZE / 2;
      const maxZ = maxCellWorld.z + CELL_SIZE / 2;
      this.obstacleRects.push({ minX, maxX, minZ, maxZ });

      const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
      const width = maxX - minX;
      const depth = maxZ - minZ;
      const object = this.createObstacleVisual(def.type, width, depth);
      object.position.x = center.x;
      object.position.z = center.z;
      this.group.add(object);
    }
  }

  createObstacleVisual(type, width, depth) {
    const g = new THREE.Group();
    const boxMat = (color, roughness = 0.82, metalness = 0.02) =>
      new THREE.MeshStandardMaterial({ color, roughness, metalness });

    const makeBox = (w, h, d, color, y = h / 2, roughness = 0.82, metalness = 0.02) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat(color, roughness, metalness));
      mesh.position.y = y;
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };

    const makeCylinder = (radius, height, color, x, z, metalness = 0.1) => {
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, height, 16),
        boxMat(color, 0.62, metalness)
      );
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };

    // Keep the visible footprint close to the full blocked area. The collision
    // rectangle still uses the exact occupied cells; these meshes simply make
    // that blocked space visually obvious to the player.
    const fillW = width * 0.94;
    const fillD = depth * 0.92;

    if (type === 'cardboardPile') {
      // Several uneven boxes rather than one perfect cube.
      makeBox(fillW, 0.52, fillD, 0x8f6d48, 0.26);
      const box1 = makeBox(fillW * 0.52, 0.62, fillD * 0.56, 0xa37a4e, 0.83);
      box1.position.x = -fillW * 0.18;
      box1.position.z = fillD * 0.12;
      const box2 = makeBox(fillW * 0.42, 0.47, fillD * 0.48, 0x977047, 0.755);
      box2.position.x = fillW * 0.24;
      box2.position.z = -fillD * 0.16;
      const tape = makeBox(fillW * 0.06, 0.635, fillD * 0.58, 0xc4a36e, 0.838);
      tape.position.x = box1.position.x;
      tape.position.z = box1.position.z;
    } else if (type === 'cargoPile') {
      // A bulky mixed load: storage cases + boxes + tied sack.
      makeBox(fillW, 0.56, fillD, 0x626a68, 0.28, 0.78, 0.12);
      const caseA = makeBox(fillW * 0.55, 0.58, fillD * 0.48, 0x444b4a, 0.85, 0.72, 0.18);
      caseA.position.x = -fillW * 0.18;
      caseA.position.z = -fillD * 0.15;
      const box = makeBox(fillW * 0.38, 0.52, fillD * 0.43, 0x9b754d, 0.82);
      box.position.x = fillW * 0.26;
      box.position.z = fillD * 0.15;
      const sack = new THREE.Mesh(
        new THREE.SphereGeometry(Math.min(width, depth) * 0.25, 12, 9),
        boxMat(0x4d514d, 0.98)
      );
      sack.scale.set(1.05, 1.25, 0.9);
      sack.position.set(fillW * 0.14, 1.14, -fillD * 0.12);
      sack.castShadow = true;
      g.add(sack);
    } else if (type === 'barrelCluster') {
      // One barrel looks too narrow for a full blocked cell, so use a cluster.
      const r = Math.min(width, depth) * 0.22;
      const positions = [
        [-fillW * 0.24, -fillD * 0.2],
        [ fillW * 0.24, -fillD * 0.2],
        [0, fillD * 0.24]
      ];
      for (let i = 0; i < positions.length; i++) {
        const [x, z] = positions[i];
        makeCylinder(r, 1.22 + (i === 2 ? 0.1 : 0), i === 1 ? 0x505a60 : 0x59646b, x, z, 0.48);
      }
      makeBox(fillW * 0.86, 0.14, fillD * 0.72, 0x3f4545, 0.07, 0.72, 0.2);
    } else if (type === 'trashPile') {
      // Bags are backed by low cartons so the whole collision cell looks solid.
      makeBox(fillW, 0.4, fillD, 0x62503d, 0.2);
      const bagPositions = [
        [-fillW * 0.25, -fillD * 0.15, 0.34],
        [ fillW * 0.22, -fillD * 0.13, 0.31],
        [0, fillD * 0.22, 0.38]
      ];
      for (const [x, z, r] of bagPositions) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), boxMat(0x292d2b, 0.98));
        bag.scale.y = 1.18;
        bag.position.set(x, 0.55, z);
        bag.castShadow = true;
        g.add(bag);
      }
    } else if (type === 'workbenchPacked') {
      // A workbench with boxes underneath: visually blocks the full footprint.
      makeBox(fillW, 0.18, fillD, 0x6f563e, 1.18);
      makeBox(fillW * 0.96, 0.64, fillD * 0.86, 0x4d4a43, 0.32, 0.86, 0.08);
      const frontBox = makeBox(fillW * 0.42, 0.5, fillD * 0.42, 0x95704b, 0.68);
      frontBox.position.x = fillW * 0.22;
      frontBox.position.z = fillD * 0.18;
      const vice = makeBox(fillW * 0.14, 0.22, fillD * 0.18, 0x424b4e, 1.38, 0.56, 0.45);
      vice.position.x = -fillW * 0.34;
    } else if (type === 'crateStack') {
      makeBox(fillW, 0.58, fillD, 0x66513a, 0.29);
      const topA = makeBox(fillW * 0.48, 0.57, fillD * 0.82, 0x765a3b, 0.865);
      topA.position.x = -fillW * 0.24;
      const topB = makeBox(fillW * 0.43, 0.46, fillD * 0.72, 0x6b5137, 0.81);
      topB.position.x = fillW * 0.27;
      for (const x of [-fillW * 0.36, 0, fillW * 0.36]) {
        const strip = makeBox(0.07, 1.17, fillD * 1.01, 0x493722, 0.585);
        strip.position.x = x;
      }
    } else if (type === 'coveredFurniture') {
      makeBox(fillW, 0.72, fillD, 0x4f4540, 0.36);
      makeBox(fillW * 0.96, 0.72, fillD * 0.28, 0x493f3b, 0.96).position.z = fillD * 0.31;
      const cover = new THREE.Mesh(
        new THREE.BoxGeometry(fillW * 1.01, 0.09, fillD * 1.01),
        boxMat(0x77766f, 0.98)
      );
      cover.position.y = 0.76;
      cover.rotation.z = -0.025;
      cover.castShadow = true;
      g.add(cover);
    } else if (type === 'fallenShelf') {
      // Dense shelf laid on its side and filled with stored items.
      makeBox(fillW, 0.55, fillD, 0x4b5250, 0.275, 0.68, 0.18);
      for (const x of [-0.3, 0.3]) {
        const crate = makeBox(fillW * 0.26, 0.36, fillD * 0.62, 0x8d6845, 0.66);
        crate.position.x = x * fillW;
      }
      const rail = makeBox(fillW, 0.12, fillD * 0.13, 0x303635, 0.72, 0.6, 0.3);
      rail.position.z = -fillD * 0.4;
    } else {
      // storageShelf / shelf: tall, wide and visibly full of basement storage.
      const h = type === 'storageShelf' ? 1.78 : 1.55;
      const frameColor = 0x4b5351;
      makeBox(fillW, 0.12, fillD, frameColor, 0.06, 0.62, 0.3);
      for (const sx of [-1, 1]) {
        const post = makeBox(0.14, h, fillD * 0.96, frameColor, h / 2, 0.62, 0.3);
        post.position.x = sx * (fillW / 2 - 0.09);
      }
      for (const y of [0.45, 0.92, 1.39]) {
        if (y >= h) continue;
        makeBox(fillW, 0.1, fillD * 0.98, 0x3c4341, y, 0.62, 0.28);
      }
      // Fill the shelves with boxes so the silhouette matches the collision area.
      const itemCount = Math.max(2, Math.round(width / CELL_SIZE) * 3);
      for (let i = 0; i < itemCount; i++) {
        const col = i % Math.max(2, Math.round(width / CELL_SIZE) * 2);
        const row = Math.floor(i / Math.max(2, Math.round(width / CELL_SIZE) * 2));
        const itemW = Math.min(0.72, fillW / Math.max(2, Math.round(width / CELL_SIZE) * 2) * 0.82);
        const item = makeBox(itemW, 0.32 + (i % 2) * 0.08, fillD * 0.68,
          i % 3 === 0 ? 0x8f6b47 : 0x676f6c, 0.26 + row * 0.48);
        const cols = Math.max(2, Math.round(width / CELL_SIZE) * 2);
        item.position.x = -fillW / 2 + (col + 0.5) * (fillW / cols);
      }
    }
    return g;
  }
  buildPipes() {
    const pipeMaterial = new THREE.MeshStandardMaterial({ color: 0x4d5a5a, roughness: 0.5, metalness: 0.58 });
    const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x697777, roughness: 0.42, metalness: 0.7 });
    const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x111515 });

    for (const pipe of this.data.pipes) {
      const cellPos = this.cellToWorld(pipe.cell);
      const group = new THREE.Group();

      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.8, 18), pipeMaterial);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 10, 24), rimMaterial);
      const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), darkMaterial);

      const warningGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.36, 20),
        new THREE.MeshBasicMaterial({
          color: 0xff5a24,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );

      const warningDust = new THREE.Mesh(
        new THREE.RingGeometry(0.24, 0.48, 24),
        new THREE.MeshBasicMaterial({
          color: 0xd7c6a1,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );

      if (pipe.side === 'left') {
        tube.rotation.z = Math.PI / 2;
        tube.position.set(-this.width / 2 - 0.72, 0.64, cellPos.z);

        mouth.rotation.y = Math.PI / 2;
        mouth.position.set(-this.width / 2 - 0.02, 0.64, cellPos.z);

        rim.rotation.y = Math.PI / 2;
        rim.position.set(-this.width / 2 - 0.015, 0.64, cellPos.z);

        warningGlow.rotation.y = Math.PI / 2;
        warningGlow.position.set(-this.width / 2 + 0.03, 0.64, cellPos.z);

        warningDust.rotation.y = Math.PI / 2;
        warningDust.position.set(-this.width / 2 + 0.06, 0.64, cellPos.z);
      } else if (pipe.side === 'bottom') {
        tube.rotation.x = Math.PI / 2;
        tube.position.set(cellPos.x, 0.64, this.depth / 2 + 0.72);

        mouth.rotation.x = -Math.PI / 2;
        mouth.position.set(cellPos.x, 0.64, this.depth / 2 + 0.02);

        rim.rotation.x = Math.PI / 2;
        rim.position.set(cellPos.x, 0.64, this.depth / 2 + 0.015);

        warningGlow.rotation.x = -Math.PI / 2;
        warningGlow.position.set(cellPos.x, 0.64, this.depth / 2 - 0.03);

        warningDust.rotation.x = -Math.PI / 2;
        warningDust.position.set(cellPos.x, 0.64, this.depth / 2 - 0.06);
      }

      tube.castShadow = tube.receiveShadow = true;
      rim.castShadow = rim.receiveShadow = true;

      group.add(tube, rim, mouth, warningGlow, warningDust);
      group.userData.warningGlow = warningGlow;
      group.userData.warningDust = warningDust;

      this.group.add(group);
      this.pipeVisuals.set(pipe.id, group);
    }
  }

}
