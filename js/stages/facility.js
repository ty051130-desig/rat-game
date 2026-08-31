const occupiedCells = [
  'a18',
  'b2', 'b4', 'b6', 'b8', 'b10', 'b11', 'b12', 'b14', 'b16', 'b18',
  'c4', 'c8', 'c18',
  'd2', 'd4', 'd6', 'd7', 'd8', 'd10', 'd12', 'd14', 'd15', 'd16', 'd18',
  'e2',
  'f2', 'f4', 'f6', 'f8', 'f9', 'f10', 'f12', 'f14', 'f16', 'f18',
  'h2', 'h4', 'h6', 'h8', 'h10', 'h12', 'h13', 'h14', 'h16', 'h18',
  'i8', 'i14', 'i18',
  'j2', 'j3', 'j4', 'j6', 'j8', 'j10', 'j12', 'j14', 'j16', 'j17', 'j18',
  'l2', 'l3', 'l4', 'l6', 'l8', 'l10', 'l12', 'l13', 'l14', 'l16', 'l17', 'l18'
];

const obstacleTypes = [
  'crateStack', 'cargoPile', 'barrelCluster',
  'workbenchPacked', 'coveredFurniture', 'cardboardPile'
];

export const facility = {
  id: 'facility',
  stageNumber: 3,
  name: '封鎖研究区画',
  theme: 'facility',

  camera: {
    position: { x: 0, y: 24.5, z: 22.5 },
    lookAt: { x: 0, y: 0.7, z: 0.8 }
  },

  // 12 rows: a-l / 18 columns: 1-18
  rows: 12,
  cols: 18,

  // The player begins beside the first capture loop around h10.
  playerStart: 'g9',
  targetKills: 20,

  character: {
    type: 'animated',
    targetHeight: 1.78,
    url: './assets/models/main_character.glb?v=11.2'
  },

  occupiedCells,

  // v11.2 redesign: every obstacle is cell-exact.
  // The open floor contains many one-cell-wide loops, so the player can
  // actually circle an obstacle and reach a rat from behind.
  obstacles: occupiedCells.map((cell, index) => ({
    cells: [cell],
    type: obstacleTypes[index % obstacleTypes.length]
  })),

  // Five staggered entrances. The first rat comes from a3 and reaches the
  // central g-row, where the h10 loop gives the player a real rear-capture
  // opportunity. Later pipes turn the same loops into a high-difficulty puzzle.
  pipes: [
    {
      id: 'facility-top-a3',
      cell: 'a3',
      side: 'top',
      facing: 'S',
      interval: 8.4,
      initialDelay: 1.4
    },
    {
      id: 'facility-right-g18',
      cell: 'g18',
      side: 'right',
      facing: 'W',
      interval: 9.1,
      initialDelay: 5.8
    },
    {
      id: 'facility-bottom-l9',
      cell: 'l9',
      side: 'bottom',
      facing: 'N',
      interval: 9.8,
      initialDelay: 10.5
    },
    {
      id: 'facility-left-g1',
      cell: 'g1',
      side: 'left',
      facing: 'E',
      interval: 10.6,
      initialDelay: 15.5
    },
    {
      id: 'facility-top-a15',
      cell: 'a15',
      side: 'top',
      facing: 'S',
      interval: 11.4,
      initialDelay: 21.0
    }
  ]
};
