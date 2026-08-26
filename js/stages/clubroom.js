export const clubroom = {
  id: 'clubroom',
  stageNumber: 2,
  name: '部室',
  theme: 'clubroom',

  camera: {
    position: { x: 0, y: 15.8, z: 17.2 },
    lookAt: { x: 0, y: 1.35, z: 0.8 }
  },

  // 9 rows: a-i / 12 columns: 1-12
  rows: 9,
  cols: 12,

  // e5 is blocked, so the player starts one cell to the right.
  playerStart: 'e6',
  targetKills: 10,

  character: {
    // v9.3: full-body tennis player with embedded Idle / Run actions.
    type: 'animated',
    targetHeight: 2.20,
    url: './assets/models/tennisplayer.glb?v=9.3'
  },


  // Collision/pathfinding cells for Stage 2.
  occupiedCells: [
    'b2', 'b4', 'b5', 'b7', 'b8', 'b9', 'b11',
    'c2', 'c4', 'c5', 'c11',
    'd7', 'd9', 'd11',
    'e2', 'e4', 'e5', 'e7', 'e9',
    'f2', 'f4', 'f11',
    'g6', 'g8', 'g9',
    'h2', 'h3', 'h5', 'h6', 'h8', 'h9', 'h11'
  ],

  // Visuals are grouped only when the occupied cells form a complete rectangle,
  // so the visible footprint and the collision footprint stay aligned.
  obstacles: [
    { cells: ['b2', 'c2'], type: 'locker' },
    { cells: ['b4', 'b5', 'c4', 'c5'], type: 'clubSofa' },
    { cells: ['b7', 'b8', 'b9'], type: 'equipmentShelf' },
    { cells: ['b11', 'c11', 'd11'], type: 'locker' },

    { cells: ['d7', 'e7'], type: 'racketRack' },
    { cells: ['d9', 'e9'], type: 'equipmentShelf' },

    { cells: ['e2', 'f2'], type: 'cardboardPile' },
    { cells: ['e4', 'e5'], type: 'clubBench' },
    { cells: ['f4'], type: 'clubTrash' },
    { cells: ['f11'], type: 'coolerBox' },

    { cells: ['g6'], type: 'clubChair' },
    { cells: ['g8', 'g9', 'h8', 'h9'], type: 'bagPile' },

    { cells: ['h2', 'h3'], type: 'clubBench' },
    { cells: ['h5', 'h6'], type: 'clubSofa' },
    { cells: ['h11'], type: 'ballCart' }
  ],

  // Pipe entrances:
  // - above a11, facing south
  // - left of c1, facing east
  // - below i6, facing north
  pipes: [
    {
      id: 'top-a11-pipe',
      cell: 'a11',
      side: 'top',
      facing: 'S',
      interval: 7.2,
      initialDelay: 1.5
    },
    {
      id: 'left-c1-pipe',
      cell: 'c1',
      side: 'left',
      facing: 'E',
      interval: 8.8,
      initialDelay: 3.4
    },
    {
      id: 'bottom-i6-pipe',
      cell: 'i6',
      side: 'bottom',
      facing: 'N',
      interval: 9.4,
      initialDelay: 5.2
    }
  ]
};
