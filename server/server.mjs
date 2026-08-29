import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;

const CELL_SIZE = 2;
const PLAYER_RADIUS = 0.43;
const PLAYER_SPEED = 6.6;
const PLAYER_TURN_SPEED = 10;
const RAT_SPEED = 2.7;
const RAT_CONTACT_DISTANCE = 0.88;
const MATCH_DURATION = 60;
const TICK_RATE = 20;
const DT = 1 / TICK_RATE;

const battleStage = {
  id: 'battle_arena',
  name: '対戦アリーナ',
  rows: 12,
  cols: 18,
  playerStarts: {
    p1: 'f9',
    p2: 'g10'
  },
  occupiedCells: [
    'b2','b3','b5','b6','b8','b9','b10','b12','b13','b14','b16','b17',
    'd2','d4','d5','d7','d8','d10','d12','d14','d15','d17',
    'e2','e4','e10','e12','e14','e17',
    'f6','f8','f12','f16','f17',
    'g2','g3','g5','g6','g8','g10','g12','g14',
    'h8','h14','h15','h17',
    'i2','i4','i5','i6','i10','i11','i17',
    'j8','j13','j15',
    'k2','k3','k5','k6','k8','k10','k12','k13','k15','k16','k17'
  ],
  pipes: [
    { id: 'pipe-top-a4', cell: 'a4', side: 'top', facing: 'S', interval: 6.2, initialDelay: 1.2 },
    { id: 'pipe-left-j1', cell: 'j1', side: 'left', facing: 'E', interval: 7.4, initialDelay: 2.8 },
    { id: 'pipe-bottom-l11', cell: 'l11', side: 'bottom', facing: 'N', interval: 8.0, initialDelay: 4.0 },
    { id: 'pipe-right-c18', cell: 'c18', side: 'right', facing: 'W', interval: 8.8, initialDelay: 5.4 }
  ]
};

const DIRECTIONS = ['N', 'E', 'S', 'W'];
const DIR_DELTA = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 }
};

function turnLeft(dir) {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 3) % 4];
}

function turnRight(dir) {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 1) % 4];
}

function directionFromStep(from, to) {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === -1 && dc === 0) return 'N';
  if (dr === 1 && dc === 0) return 'S';
  if (dr === 0 && dc === 1) return 'E';
  if (dr === 0 && dc === -1) return 'W';
  return null;
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

function headingVector(dir) {
  const d = DIR_DELTA[dir];
  return { x: d.dc, z: d.dr };
}

function findPath(stage, startCell, startFacing, goalCell) {
  if (!startCell || !goalCell) return [];
  if (startCell.row === goalCell.row && startCell.col === goalCell.col) return [startCell];

  const queue = [{ cell: startCell, facing: startFacing }];
  let head = 0;
  const startKey = `${startCell.row},${startCell.col},${startFacing}`;
  const visited = new Set([startKey]);
  const parent = new Map();
  let goalStateKey = null;

  while (head < queue.length) {
    const current = queue[head++];
    const candidates = [current.facing, turnLeft(current.facing), turnRight(current.facing)];

    for (const nextFacing of candidates) {
      const d = DIR_DELTA[nextFacing];
      const nextCell = { row: current.cell.row + d.dr, col: current.cell.col + d.dc };
      if (!stage.isWalkableCell(nextCell.row, nextCell.col)) continue;
      const nextKey = `${nextCell.row},${nextCell.col},${nextFacing}`;
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      parent.set(nextKey, {
        prevKey: `${current.cell.row},${current.cell.col},${current.facing}`,
        cell: nextCell,
        facing: nextFacing
      });
      if (nextCell.row === goalCell.row && nextCell.col === goalCell.col) {
        goalStateKey = nextKey;
        queue.length = 0;
        break;
      }
      queue.push({ cell: nextCell, facing: nextFacing });
    }
  }

  if (!goalStateKey) return [startCell];
  const reversed = [];
  let cursor = goalStateKey;
  while (cursor !== startKey) {
    const info = parent.get(cursor);
    if (!info) break;
    reversed.push(info.cell);
    cursor = info.prevKey;
  }
  reversed.push(startCell);
  reversed.reverse();
  return reversed;
}

class StageLogic {
  constructor(data) {
    this.data = data;
    this.rows = data.rows;
    this.cols = data.cols;
    this.occupied = new Set(data.occupiedCells);
  }

  parseCell(cellName) {
    if (!cellName || typeof cellName !== 'string') return null;
    const row = cellName.charCodeAt(0) - 97;
    const col = Number(cellName.slice(1)) - 1;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
  }

  cellName(row, col) {
    return `${String.fromCharCode(97 + row)}${col + 1}`;
  }

  cellToWorld(cell) {
    const c = typeof cell === 'string' ? this.parseCell(cell) : cell;
    const x = (c.col - (this.cols - 1) / 2) * CELL_SIZE;
    const z = (c.row - (this.rows - 1) / 2) * CELL_SIZE;
    return { x, z };
  }

  worldToCell(x, z) {
    const col = Math.round(x / CELL_SIZE + (this.cols - 1) / 2);
    const row = Math.round(z / CELL_SIZE + (this.rows - 1) / 2);
    if (!this.isInside(row, col)) return null;
    return { row, col };
  }

  isInside(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  isWalkableCell(row, col) {
    return this.isInside(row, col) && !this.occupied.has(this.cellName(row, col));
  }

  canOccupy(x, z, radius) {
    const halfW = (this.cols * CELL_SIZE) / 2;
    const halfH = (this.rows * CELL_SIZE) / 2;
    if (x < -halfW + radius || x > halfW - radius || z < -halfH + radius || z > halfH - radius) return false;

    for (const name of this.occupied) {
      const cell = this.parseCell(name);
      const p = this.cellToWorld(cell);
      const minX = p.x - CELL_SIZE / 2;
      const maxX = p.x + CELL_SIZE / 2;
      const minZ = p.z - CELL_SIZE / 2;
      const maxZ = p.z + CELL_SIZE / 2;
      const nearestX = Math.max(minX, Math.min(x, maxX));
      const nearestZ = Math.max(minZ, Math.min(z, maxZ));
      const dx = x - nearestX;
      const dz = z - nearestZ;
      if (dx * dx + dz * dz < radius * radius) return false;
    }
    return true;
  }
}

let nextRatId = 1;

class RatLogic {
  constructor(stage, spawnCellName, facing) {
    this.id = `rat-${nextRatId++}`;
    this.stage = stage;
    this.cell = stage.parseCell(spawnCellName);
    this.facing = facing;
    this.targetFacing = facing;
    this.speed = RAT_SPEED;
    this.dead = false;

    const p = stage.cellToWorld(this.cell);
    this.x = p.x;
    this.z = p.z;
    this.from = { ...p };
    this.to = { ...p };
    this.targetCell = null;
    this.progress = 0;
  }

  chooseNext(players) {
    const livePlayers = Object.values(players).filter((p) => p.connected);
    if (!livePlayers.length) return;

    let best = livePlayers[0];
    let bestDist = Infinity;
    for (const p of livePlayers) {
      const dx = p.x - this.x;
      const dz = p.z - this.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestDist) {
        bestDist = d2;
        best = p;
      }
    }

    const goal = this.stage.worldToCell(best.x, best.z);
    if (!goal) return;

    const path = findPath(this.stage, this.cell, this.facing, goal);
    if (path.length < 2) return;
    const next = path[1];
    const nextFacing = directionFromStep(this.cell, next);
    if (!nextFacing) return;
    this.targetCell = { ...next };
    this.targetFacing = nextFacing;
    this.from = { x: this.x, z: this.z };
    this.to = this.stage.cellToWorld(next);
    this.progress = 0;
  }

  update(dt, players) {
    if (this.dead) return;
    let remainingDistance = this.speed * dt;
    let safety = 0;

    while (remainingDistance > 0.00001 && safety++ < 6) {
      if (!this.targetCell) this.chooseNext(players);
      if (!this.targetCell) break;
      const remainingInSegment = CELL_SIZE * (1 - this.progress);
      const travel = Math.min(remainingDistance, remainingInSegment);
      this.progress += travel / CELL_SIZE;
      remainingDistance -= travel;
      const t = Math.min(this.progress, 1);
      this.x = this.from.x + (this.to.x - this.from.x) * t;
      this.z = this.from.z + (this.to.z - this.from.z) * t;

      if (this.progress >= 0.999999) {
        this.x = this.to.x;
        this.z = this.to.z;
        this.cell = { ...this.targetCell };
        this.facing = this.targetFacing;
        this.targetCell = null;
        this.progress = 0;
        this.from = { x: this.x, z: this.z };
        this.chooseNext(players);
      }
    }
  }

  toNet() {
    return {
      id: this.id,
      x: this.x,
      z: this.z,
      yaw: facingYaw(this.targetFacing || this.facing),
      facing: this.targetFacing || this.facing
    };
  }
}

function createRoom() {
  const stage = new StageLogic(battleStage);
  return {
    code: makeRoomCode(),
    stage,
    sockets: { p1: null, p2: null },
    players: {
      p1: createPlayerState('p1', stage),
      p2: createPlayerState('p2', stage)
    },
    rats: [],
    pipes: battleStage.pipes.map((p) => ({ ...p, timer: p.initialDelay })),
    started: false,
    finished: false,
    timeLeft: MATCH_DURATION,
    lastSnapshotAt: 0
  };
}

function createPlayerState(slot, stage) {
  const start = stage.cellToWorld(battleStage.playerStarts[slot]);
  return {
    slot,
    connected: false,
    x: start.x,
    z: start.z,
    yaw: 0,
    inputX: 0,
    inputZ: 0,
    moving: false,
    score: 0,
    stun: 0
  };
}

function resetRoomForMatch(room) {
  room.rats = [];
  room.pipes = battleStage.pipes.map((p) => ({ ...p, timer: p.initialDelay }));
  room.timeLeft = MATCH_DURATION;
  room.finished = false;
  room.started = true;
  for (const slot of ['p1', 'p2']) {
    const player = room.players[slot];
    const start = room.stage.cellToWorld(battleStage.playerStarts[slot]);
    player.x = start.x;
    player.z = start.z;
    player.yaw = slot === 'p1' ? 0 : Math.PI;
    player.inputX = 0;
    player.inputZ = 0;
    player.moving = false;
    player.score = 0;
    player.stun = 0;
  }
}

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function playerCount(room) {
  return ['p1', 'p2'].filter((slot) => room.players[slot].connected).length;
}

function roomSnapshot(room) {
  return {
    code: room.code,
    started: room.started,
    finished: room.finished,
    timeLeft: room.timeLeft,
    players: {
      p1: {
        x: room.players.p1.x,
        z: room.players.p1.z,
        yaw: room.players.p1.yaw,
        moving: room.players.p1.moving,
        score: room.players.p1.score,
        stun: room.players.p1.stun,
        connected: room.players.p1.connected
      },
      p2: {
        x: room.players.p2.x,
        z: room.players.p2.z,
        yaw: room.players.p2.yaw,
        moving: room.players.p2.moving,
        score: room.players.p2.score,
        stun: room.players.p2.stun,
        connected: room.players.p2.connected
      }
    },
    rats: room.rats.map((r) => r.toNet()),
    pipes: room.pipes.map((p) => ({ id: p.id, timer: p.timer, interval: p.interval, cell: p.cell, side: p.side }))
  };
}

const rooms = new Map();

const app = express();
app.use(express.static(ROOT_DIR));
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  socket.on('create_room', () => {
    let room = createRoom();
    while (rooms.has(room.code)) room = createRoom();
    rooms.set(room.code, room);
    attachPlayerToRoom(socket, room, 'p1');
    socket.emit('room_created', { code: room.code, slot: 'p1', players: playerCount(room) });
  });

  socket.on('join_room', ({ code }) => {
    const normalized = String(code || '').trim().toUpperCase();
    const room = rooms.get(normalized);
    if (!room) {
      socket.emit('room_error', { message: '部屋が見つかりません。' });
      return;
    }
    if (room.players.p2.connected) {
      socket.emit('room_error', { message: 'その部屋は満員です。' });
      return;
    }
    attachPlayerToRoom(socket, room, 'p2');
    io.to(room.code).emit('room_update', { code: room.code, players: playerCount(room) });
    if (playerCount(room) === 2) startMatch(room);
  });

  socket.on('player_input', (data) => {
    const { roomCode, slot, inputX, inputZ } = data || {};
    const room = rooms.get(roomCode);
    if (!room || !room.players[slot]) return;
    room.players[slot].inputX = Number.isFinite(inputX) ? Math.max(-1, Math.min(1, inputX)) : 0;
    room.players[slot].inputZ = Number.isFinite(inputZ) ? Math.max(-1, Math.min(1, inputZ)) : 0;
  });

  socket.on('leave_room', () => {
    detachSocket(socket);
  });

  socket.on('disconnect', () => {
    detachSocket(socket);
  });
});

function attachPlayerToRoom(socket, room, slot) {
  socket.data.roomCode = room.code;
  socket.data.slot = slot;
  room.sockets[slot] = socket.id;
  room.players[slot].connected = true;
  socket.join(room.code);
}

function detachSocket(socket) {
  const roomCode = socket.data.roomCode;
  const slot = socket.data.slot;
  if (!roomCode || !slot) return;
  const room = rooms.get(roomCode);
  if (!room) return;

  room.sockets[slot] = null;
  room.players[slot].connected = false;
  room.players[slot].inputX = 0;
  room.players[slot].inputZ = 0;
  room.started = false;
  room.finished = true;

  io.to(room.code).emit('room_closed', { message: '相手が退出したため対戦を終了しました。' });
  rooms.delete(room.code);
}

function startMatch(room) {
  resetRoomForMatch(room);
  io.to(room.code).emit('match_started', {
    code: room.code,
    stageId: battleStage.id,
    duration: MATCH_DURATION
  });
}

function updatePlayers(room, dt) {
  for (const slot of ['p1', 'p2']) {
    const player = room.players[slot];
    if (!player.connected) continue;

    if (player.stun > 0) {
      player.stun = Math.max(0, player.stun - dt);
      player.moving = false;
      continue;
    }

    let dx = player.inputX;
    let dz = player.inputZ;
    const len = Math.hypot(dx, dz);
    if (len < 0.001) {
      player.moving = false;
      continue;
    }

    dx /= len;
    dz /= len;
    const amount = PLAYER_SPEED * dt;
    const nextX = player.x + dx * amount;
    if (room.stage.canOccupy(nextX, player.z, PLAYER_RADIUS)) player.x = nextX;
    const nextZ = player.z + dz * amount;
    if (room.stage.canOccupy(player.x, nextZ, PLAYER_RADIUS)) player.z = nextZ;

    const targetYaw = Math.atan2(-dx, -dz) + Math.PI;
    player.yaw = rotateTowards(player.yaw, targetYaw, dt * PLAYER_TURN_SPEED);
    player.moving = true;
  }
}

function isSpawnCellBusy(room, cellName) {
  const c = room.stage.parseCell(cellName);
  return room.rats.some((r) => !r.dead && r.cell.row === c.row && r.cell.col === c.col && r.progress < 0.55);
}

function updatePipes(room, dt) {
  for (const pipe of room.pipes) {
    pipe.timer -= dt;
    if (pipe.timer <= 0) {
      if (!isSpawnCellBusy(room, pipe.cell)) {
        room.rats.push(new RatLogic(room.stage, pipe.cell, pipe.facing));
        pipe.timer += pipe.interval;
      } else {
        pipe.timer = 0.4;
      }
    }
  }
}

function resolveRatContacts(room) {
  const livePlayers = ['p1', 'p2'].filter((slot) => room.players[slot].connected);
  for (const rat of [...room.rats]) {
    rat.update(DT, room.players);

    const candidates = [];
    const frontHits = [];
    for (const slot of livePlayers) {
      const player = room.players[slot];
      const dx = player.x - rat.x;
      const dz = player.z - rat.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > RAT_CONTACT_DISTANCE * RAT_CONTACT_DISTANCE) continue;
      const heading = headingVector(rat.targetFacing || rat.facing);
      const dot = dx * heading.x + dz * heading.z;
      if (dot >= 0) frontHits.push({ slot, distSq });
      else candidates.push({ slot, distSq });
    }

    if (candidates.length) {
      candidates.sort((a, b) => a.distSq - b.distSq);
      room.players[candidates[0].slot].score += 1;
      rat.dead = true;
      room.rats = room.rats.filter((r) => r !== rat);
      continue;
    }

    if (frontHits.length) {
      frontHits.sort((a, b) => a.distSq - b.distSq);
      room.players[frontHits[0].slot].stun = 0.8;
    }
  }
}

function finishMatch(room) {
  room.started = false;
  room.finished = true;
  const p1 = room.players.p1.score;
  const p2 = room.players.p2.score;
  let winner = 'draw';
  if (p1 > p2) winner = 'p1';
  if (p2 > p1) winner = 'p2';
  io.to(room.code).emit('match_ended', {
    code: room.code,
    winner,
    scores: { p1, p2 }
  });
}

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.started || room.finished) continue;
    updatePlayers(room, DT);
    updatePipes(room, DT);
    resolveRatContacts(room);
    room.timeLeft = Math.max(0, room.timeLeft - DT);
    io.to(room.code).emit('state', roomSnapshot(room));
    if (room.timeLeft <= 0) finishMatch(room);
  }
}, 1000 / TICK_RATE);

server.listen(PORT, () => {
  console.log(`Rat Escape v10.0 server running: http://localhost:${PORT}`);
});
