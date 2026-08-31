const occupiedCells = [
  'b2','b3','b5','b6','b8','b9','b10','b12','b13','b14','b16','b17',
  'd2','d4','d5','d7','d8','d10','d12','d14','d15','d17',
  'e2','e4','e10','e12','e14','e17',
  'f6','f8','f12','f16','f17',
  'g2','g3','g5','g6','g8','g10','g12','g14',
  'h8','h14','h15','h17',
  'i2','i4','i5','i6','i10','i11','i17',
  'j8','j13','j15',
  'k2','k3','k5','k6','k8','k10','k12','k13','k15','k16','k17'
];

const obstacleTypes = [
  'locker', 'cardboardPile', 'equipmentShelf', 'clubBench', 'bagPile',
  'clubChair', 'clubSofa', 'racketRack', 'crateStack', 'cargoPile'
];

export const battleArena = {
  id: 'battle_arena',
  stageNumber: 'VS',
  name: '対戦アリーナ',
  theme: 'battle',
  camera: {
    position: { x: 0, y: 18.5, z: 19.5 },
    lookAt: { x: 0, y: 0.8, z: 0.5 }
  },
  rows: 12,
  cols: 18,
  playerStart: 'f9',
  playerStarts: {
    p1: 'f9',
    p2: 'g11'
  },
  duration: 60,
  occupiedCells,
  obstacles: occupiedCells.map((cell, index) => ({
    cells: [cell],
    type: obstacleTypes[index % obstacleTypes.length]
  })),
  pipes: [
    { id: 'pipe-top-a4', cell: 'a4', side: 'top', facing: 'S', interval: 6.2, initialDelay: 1.2 },
    { id: 'pipe-left-j1', cell: 'j1', side: 'left', facing: 'E', interval: 7.4, initialDelay: 2.8 },
    { id: 'pipe-bottom-l11', cell: 'l11', side: 'bottom', facing: 'N', interval: 8.0, initialDelay: 4.0 },
    { id: 'pipe-right-c18', cell: 'c18', side: 'right', facing: 'W', interval: 8.8, initialDelay: 5.4 }
  ],
  battleCharacters: {
    p1: {
      type: 'animated',
      targetHeight: 1.78,
      modelName: 'BluePlayer',
      url: './assets/models/main_character_blue.glb?v=11.2'
    },
    p2: {
      type: 'animated',
      targetHeight: 1.78,
      modelName: 'RedPlayer',
      url: './assets/models/main_character_red.glb?v=11.2'
    }
  }
};
