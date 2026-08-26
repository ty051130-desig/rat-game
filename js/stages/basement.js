export const basement = {
  id: 'basement',
  stageNumber: 1,
  name: '地下室',
  theme: 'basement',
  rows: 7,
  cols: 12,
  playerStart: 'c6',
  targetKills: 10,

  character: {
    type: 'animated',
    targetHeight: 1.78,
    url: './assets/models/main_character.glb?v=9.3'
  },

  occupiedCells: [
    'b2', 'b3', 'b5', 'b7', 'b8', 'b10', 'b11',
    'd2', 'd3', 'd5', 'd6', 'd7', 'd9', 'd10', 'd12',
    'f2', 'f4', 'f5', 'f7', 'f9', 'f11'
  ],

  obstacles: [
    { cells: ['b2', 'b3'], type: 'shelf' },
    { cells: ['b5'], type: 'cardboardPile' },
    { cells: ['b7', 'b8'], type: 'cargoPile' },
    { cells: ['b10', 'b11'], type: 'crateStack' },

    { cells: ['d2', 'd3'], type: 'workbenchPacked' },
    { cells: ['d5', 'd6', 'd7'], type: 'storageShelf' },
    { cells: ['d9', 'd10'], type: 'cardboardPile' },
    { cells: ['d12'], type: 'barrelCluster' },

    { cells: ['f2'], type: 'trashPile' },
    { cells: ['f4', 'f5'], type: 'fallenShelf' },
    { cells: ['f7'], type: 'cargoPile' },
    { cells: ['f9'], type: 'crateStack' },
    { cells: ['f11'], type: 'coveredFurniture' }
  ],

  pipes: [
    {
      id: 'left-pipe',
      cell: 'b1',
      side: 'left',
      facing: 'E',
      interval: 4.2,
      initialDelay: 1.3
    },
    {
      id: 'bottom-pipe',
      cell: 'g11',
      side: 'bottom',
      facing: 'N',
      interval: 6.4,
      initialDelay: 3.0
    }
  ]
};
