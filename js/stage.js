import * as THREE from 'three';
import { CELL_SIZE } from './config.js?v=9.3';

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
    const isClubroom = this.data.theme === 'clubroom';

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(this.width + 0.5, 0.35, this.depth + 0.5),
      new THREE.MeshStandardMaterial({
        color: isClubroom ? 0x777161 : 0x555955,
        roughness: isClubroom ? 0.9 : 0.96,
        metalness: 0.03
      })
    );
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Low boundary walls keep the full playfield readable from the fixed camera.
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: isClubroom ? 0x64665d : 0x343a38,
      roughness: 0.92
    });
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

    if (isClubroom) {
      // Stage 2 details: old notice board, whiteboard and a floor entrance mat.
      // These are outside the collision cells and are decorative only.
      const boardMat = new THREE.MeshStandardMaterial({ color: 0x8d7653, roughness: 0.9 });
      const paperMat = new THREE.MeshStandardMaterial({ color: 0xd8d2bd, roughness: 0.84 });
      const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.05, 0.12), boardMat);
      board.position.set(-4.8, 0.9, -this.depth / 2 - 0.22);
      board.castShadow = true;
      this.group.add(board);

      for (let i = 0; i < 4; i++) {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.55, 0.04), paperMat);
        paper.position.set(-6.2 + i * 0.95, 0.93 + (i % 2) * 0.08, -this.depth / 2 - 0.145);
        this.group.add(paper);
      }

      const whiteboard = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.95, 0.1),
        new THREE.MeshStandardMaterial({ color: 0xbfc1b8, roughness: 0.68 })
      );
      whiteboard.position.set(5.8, 0.9, -this.depth / 2 - 0.22);
      this.group.add(whiteboard);

      const mat = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.035, 1.05),
        new THREE.MeshStandardMaterial({ color: 0x39453f, roughness: 0.98 })
      );
      mat.position.set(-7.8, 0.025, this.depth / 2 - 0.65);
      mat.receiveShadow = true;
      this.group.add(mat);
    } else {
      // Basement back-wall pipe details, non-colliding.
      const detailMat = new THREE.MeshStandardMaterial({ color: 0x59625e, roughness: 0.55, metalness: 0.5 });
      for (const x of [-8.5, 6.8]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 4.2, 12), detailMat);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(x, 0.35, -this.depth / 2 - 0.28);
        this.group.add(pipe);
      }
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
    } else if (type === 'locker') {
      // Clubroom lockers: a little cleaner and easier to read from above.
      makeBox(fillW, 1.72, fillD, 0x5c676d, 0.86, 0.72, 0.22);
      makeBox(fillW * 1.01, 0.08, fillD * 1.02, 0x434a4d, 0.04, 0.7, 0.24);
      makeBox(fillW * 1.01, 0.1, fillD * 1.02, 0x717b80, 1.73, 0.7, 0.22);
      const count = Math.max(1, Math.round(width / CELL_SIZE));
      for (let i = 1; i < count; i++) {
        const seam = makeBox(0.035, 1.58, fillD * 1.01, 0x3f494d, 0.87, 0.68, 0.25);
        seam.position.x = -fillW / 2 + (fillW * i) / count;
      }
      for (let i = 0; i < count; i++) {
        const doorCenterX = -fillW / 2 + (i + 0.5) * (fillW / count);
        for (let row = 0; row < 3; row++) {
          const vent = makeBox(fillW / count * 0.38, 0.022, 0.018, 0x3a4347, 1.22 - row * 0.13, 0.62, 0.25);
          vent.position.x = doorCenterX;
          vent.position.z = -fillD / 2 - 0.018;
        }
        const plate = makeBox(fillW / count * 0.24, 0.08, 0.02, 0xc9cbc4, 1.47, 0.42, 0.68);
        plate.position.x = doorCenterX;
        plate.position.z = -fillD / 2 - 0.02;
        const handle = makeBox(0.075, 0.18, 0.055, 0xc0c3bd, 0.92, 0.42, 0.72);
        handle.position.x = -fillW / 2 + (i + 0.72) * (fillW / count);
        handle.position.z = -fillD / 2 - 0.02;
      }
    } else if (type === 'equipmentShelf') {
      makeBox(fillW, 0.12, fillD, 0x545a57, 0.06, 0.62, 0.28);
      for (const sx of [-1, 1]) {
        const post = makeBox(0.13, 1.58, fillD * 0.94, 0x48504e, 0.79, 0.6, 0.3);
        post.position.x = sx * (fillW / 2 - 0.08);
      }
      for (const y of [0.42, 0.88, 1.34]) {
        makeBox(fillW, 0.09, fillD * 0.96, 0x424947, y, 0.62, 0.25);
      }
      const cells = Math.max(1, Math.round(width / CELL_SIZE));
      const cols = cells * 2;
      for (let i = 0; i < cells * 3; i++) {
        const item = makeBox(
          Math.min(0.72, fillW / (cells * 2.1)),
          0.28 + (i % 2) * 0.09,
          fillD * 0.55,
          i % 4 === 0 ? 0x9a744b : i % 4 === 1 ? 0x2f5c55 : i % 4 === 2 ? 0x6b7070 : 0x7e4b3c,
          0.24 + Math.floor(i / cols) * 0.46
        );
        item.position.x = -fillW / 2 + ((i % cols) + 0.5) * (fillW / cols);
        item.position.z = fillD * 0.12;
      }
      for (let i = 0; i < Math.max(2, cells); i++) {
        const can = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.08, 0.26, 12),
          boxMat(i % 2 ? 0xc6cc79 : 0x7ea3c7, 0.68, 0.08)
        );
        can.position.set(-fillW * 0.34 + i * (fillW * 0.34), 1.05, -fillD * 0.18);
        can.castShadow = can.receiveShadow = true;
        g.add(can);
      }
    } else if (type === 'clubTable') {
      // Table plus packed bags underneath so its collision footprint feels solid.
      makeBox(fillW, 0.16, fillD, 0x75593e, 1.0);
      makeBox(fillW * 0.94, 0.48, fillD * 0.82, 0x4c4940, 0.24, 0.9, 0.05);
      for (const x of [-0.3, 0.3]) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.18, 12, 8), boxMat(0x29333a, 0.92));
        bag.scale.set(1.3, 0.9, 0.8);
        bag.position.set(x * fillW, 0.62, fillD * 0.12);
        bag.castShadow = true;
        g.add(bag);
      }
    } else if (type === 'clubBench') {
      makeBox(fillW, 0.08, fillD * 0.9, 0x8c6b47, 0.67);
      for (const zOff of [-0.22, 0, 0.22]) {
        const slat = makeBox(fillW * 0.98, 0.06, fillD * 0.18, 0x9b754f, 0.61);
        slat.position.z = zOff * fillD;
      }
      makeBox(fillW * 0.95, 0.16, fillD * 0.72, 0x4a3c31, 0.12);
      for (const x of [-0.42, 0.42]) {
        const leg = makeBox(0.1, 0.56, 0.12, 0x4f5554, 0.28, 0.66, 0.18);
        leg.position.x = x * fillW;
      }
      for (const x of [-0.28, 0.28]) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.16, 10, 7), boxMat(0x2d3940, 0.94));
        bag.scale.set(1.35, 0.8, 0.85);
        bag.position.set(x * fillW, 0.47, 0);
        bag.castShadow = true;
        g.add(bag);
      }
    } else if (type === 'clubChair') {
      for (const x of [-0.34, 0.34]) {
        for (const z of [-0.32, 0.32]) {
          const leg = makeBox(0.08, 0.54, 0.08, 0x4d5658, 0.27, 0.72, 0.16);
          leg.position.x = x * fillW;
          leg.position.z = z * fillD;
        }
      }
      const seat = makeBox(fillW * 0.9, 0.14, fillD * 0.86, 0x6d7777, 0.64, 0.85, 0.04);
      const back = makeBox(fillW * 0.82, 0.78, fillD * 0.18, 0x5e696a, 1.02, 0.84, 0.04);
      back.position.z = fillD * 0.34;
      const backBar = makeBox(fillW * 0.7, 0.12, fillD * 0.12, 0x4e595a, 0.82, 0.82, 0.06);
      backBar.position.z = fillD * 0.25;
      seat.rotation.y = 0.08;
    } else if (type === 'racketRack') {
      makeBox(fillW, 0.62, fillD, 0x4b4032, 0.31);
      makeBox(fillW * 0.96, 0.12, fillD * 0.88, 0x765f42, 0.74);
      const count = Math.max(3, Math.round(width / CELL_SIZE) * 4);
      for (let i = 0; i < count; i++) {
        const x = -fillW * 0.42 + (i / Math.max(1, count - 1)) * fillW * 0.84;
        const shaft = makeBox(0.045, 0.78, 0.045, i % 2 ? 0x293b45 : 0x7b3431, 1.08);
        shaft.position.x = x;
        const head = new THREE.Mesh(
          new THREE.TorusGeometry(0.17, 0.026, 8, 18),
          boxMat(i % 2 ? 0x314c59 : 0x8a3c38, 0.55, 0.18)
        );
        head.scale.y = 1.25;
        head.position.set(x, 1.49, 0);
        head.castShadow = true;
        g.add(head);
      }
    } else if (type === 'bagPile') {
      makeBox(fillW, 0.3, fillD, 0x574a3f, 0.15);
      const positions = [
        [-0.3, -0.18, 0x293743],
        [0.27, -0.15, 0x453337],
        [-0.05, 0.24, 0x334237],
        [0.33, 0.22, 0x2f3136]
      ];
      for (const [px, pz, color] of positions) {
        const bag = new THREE.Mesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.22, 12, 8), boxMat(color, 0.96));
        bag.scale.set(1.25, 0.8, 0.86);
        bag.position.set(px * fillW, 0.52, pz * fillD);
        bag.castShadow = true;
        g.add(bag);
        const strap = makeBox(Math.min(width, depth) * 0.18, 0.03, 0.04, 0xc8c9bf, 0.58, 0.84, 0.02);
        strap.position.x = px * fillW;
        strap.position.z = pz * fillD;
      }
    } else if (type === 'clubSofa') {
      makeBox(fillW, 0.26, fillD, 0x505853, 0.13);
      const leftArm = makeBox(fillW * 0.12, 0.56, fillD * 0.9, 0x5b645f, 0.41);
      leftArm.position.x = -fillW * 0.44;
      const rightArm = makeBox(fillW * 0.12, 0.56, fillD * 0.9, 0x5b645f, 0.41);
      rightArm.position.x = fillW * 0.44;
      const back = makeBox(fillW, 0.72, fillD * 0.24, 0x59625e, 0.85);
      back.position.z = fillD * 0.34;
      const seat = makeBox(fillW * 0.9, 0.18, fillD * 0.64, 0x69716c, 0.65);
      seat.position.z = -fillD * 0.06;
      for (const x of [-0.22, 0.22]) {
        const cushion = makeBox(fillW * 0.36, 0.12, fillD * 0.54, 0x737b76, 0.79);
        cushion.position.x = x * fillW;
        cushion.position.z = -fillD * 0.04;
      }
    } else if (type === 'ballCart') {
      for (const x of [-0.34, 0.34]) {
        for (const z of [-0.34, 0.34]) {
          const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), boxMat(0x2e3333, 0.8, 0.22));
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x * fillW, 0.09, z * fillD);
          wheel.castShadow = true;
          g.add(wheel);
        }
      }
      makeBox(fillW * 0.86, 0.1, fillD * 0.86, 0x565e5c, 0.5, 0.6, 0.28);
      const basket = makeBox(fillW * 0.82, 0.54, fillD * 0.82, 0x66706d, 0.84, 0.48, 0.36);
      basket.material.wireframe = true;
      const handle = makeBox(fillW * 0.42, 0.05, 0.05, 0x515958, 1.28, 0.58, 0.24);
      handle.position.z = -fillD * 0.42;
      for (let x = -1; x <= 1; x++) {
        for (let z = -1; z <= 1; z++) {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), boxMat(0xb8bf54, 0.8));
          ball.position.set(x * 0.22, 0.95 + ((x + z + 4) % 2) * 0.08, z * 0.2);
          g.add(ball);
        }
      }
    } else if (type === 'clubTrash') {
      makeBox(fillW * 0.92, 0.2, fillD * 0.92, 0x4d4840, 0.1);
      const bin = makeCylinder(Math.min(width, depth) * 0.31, 0.95, 0x3f4947, 0, 0, 0.18);
      bin.position.y = 0.475;
      const rim = makeBox(fillW * 0.56, 0.06, fillD * 0.56, 0x68706d, 0.96, 0.55, 0.18);
      const bag = new THREE.Mesh(new THREE.SphereGeometry(Math.min(width, depth) * 0.24, 10, 8), boxMat(0x252927, 0.98));
      bag.scale.y = 0.82;
      bag.position.set(0.22, 0.93, -0.12);
      bag.castShadow = true;
      g.add(bag);
    } else if (type === 'coolerBox') {
      makeBox(fillW, 0.68, fillD, 0x52767d, 0.34, 0.76, 0.04);
      makeBox(fillW * 1.01, 0.16, fillD * 1.01, 0xc2c4b8, 0.75, 0.72, 0.02);
      const handle = makeBox(fillW * 0.54, 0.09, 0.09, 0x394447, 0.93, 0.64, 0.18);
      handle.position.z = -fillD * 0.22;
      for (const x of [-0.22, 0.22]) {
        const latch = makeBox(0.08, 0.11, 0.04, 0xc8cbc2, 0.55, 0.48, 0.22);
        latch.position.x = x * fillW;
        latch.position.z = -fillD * 0.46;
      }
      const sideHandleL = makeBox(0.06, 0.16, 0.22, 0x334042, 0.42, 0.56, 0.2);
      sideHandleL.position.x = -fillW * 0.5;
      const sideHandleR = makeBox(0.06, 0.16, 0.22, 0x334042, 0.42, 0.56, 0.2);
      sideHandleR.position.x = fillW * 0.5;
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

      // The warning rim sits directly on the pipe lip. Unlike the inner glow,
      // it remains visible even when the camera cannot see straight into the pipe.
      const warningRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.505, 0.105, 12, 28),
        new THREE.MeshBasicMaterial({
          color: 0xc95746,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false
        })
      );
      warningRim.renderOrder = 6;

      const warningGlow = new THREE.Mesh(
        new THREE.CircleGeometry(0.40, 24),
        new THREE.MeshBasicMaterial({
          color: 0xc95746,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide
        })
      );
      warningGlow.renderOrder = 5;

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

        warningRim.rotation.y = Math.PI / 2;
        warningRim.position.copy(rim.position);

        warningGlow.rotation.y = Math.PI / 2;
        warningGlow.position.set(-this.width / 2 + 0.12, 0.64, cellPos.z);

        warningDust.rotation.y = Math.PI / 2;
        warningDust.position.set(-this.width / 2 + 0.14, 0.64, cellPos.z);
      } else if (pipe.side === 'top') {
        tube.rotation.x = Math.PI / 2;
        tube.position.set(cellPos.x, 0.64, -this.depth / 2 - 0.72);

        // Top pipe points into the room (+Z). Circle/Torus default planes face Z.
        mouth.position.set(cellPos.x, 0.64, -this.depth / 2 - 0.02);
        rim.position.set(cellPos.x, 0.64, -this.depth / 2 - 0.015);

        warningRim.position.copy(rim.position);
        warningGlow.position.set(cellPos.x, 0.64, -this.depth / 2 + 0.03);
        warningDust.position.set(cellPos.x, 0.64, -this.depth / 2 + 0.06);
      } else if (pipe.side === 'bottom') {
        tube.rotation.x = Math.PI / 2;
        tube.position.set(cellPos.x, 0.64, this.depth / 2 + 0.72);

        mouth.rotation.x = -Math.PI / 2;
        mouth.position.set(cellPos.x, 0.64, this.depth / 2 + 0.02);

        rim.rotation.x = Math.PI / 2;
        rim.position.set(cellPos.x, 0.64, this.depth / 2 + 0.015);

        warningRim.rotation.x = Math.PI / 2;
        warningRim.position.copy(rim.position);

        warningGlow.rotation.x = -Math.PI / 2;
        warningGlow.position.set(cellPos.x, 0.64, this.depth / 2 - 0.03);

        warningDust.rotation.x = -Math.PI / 2;
        warningDust.position.set(cellPos.x, 0.64, this.depth / 2 - 0.06);
      }

      tube.castShadow = tube.receiveShadow = true;
      rim.castShadow = rim.receiveShadow = true;

      group.add(tube, rim, warningRim, mouth, warningGlow, warningDust);
      group.userData.warningRim = warningRim;
      group.userData.warningGlow = warningGlow;
      group.userData.warningDust = warningDust;

      this.group.add(group);
      this.pipeVisuals.set(pipe.id, group);
    }
  }

}
