import type SahurMesh from './SahurMesh.ts'
import type {Ring, Station} from './SahurMesh.ts'

const honey = '#ba7a42'
const hand = '#c68b50'
const sole = '#be8249'
const club = '#bd8147'
/** The long blank rests in the curled hand. The end is turned and softly rounded, not cut off on the diagonal. */
function turnBat(mesh: SahurMesh) {
  return mesh.loft([
    [-1.134, 0.021, 0.366, 0, 0],
    [-1.126, 0.04, 0.364, 0.071, 0.068],
    [-1.099, 0.085, 0.36, 0.105, 0.094],
    [-1.047, 0.197, 0.346, 0.11, 0.099],
    [-0.915, 0.47, 0.322, 0.091, 0.084],
    [-0.742, 0.809, 0.29, 0.064, 0.063],
    [-0.564, 1.174, 0.255, 0.041, 0.041],
    [-0.427, 1.443, 0.229, 0.032, 0.032],
    [-0.369, 1.553, 0.219, 0.038, 0.038],
    [-0.354, 1.583, 0.216, 0.026, 0.026],
    [-0.348, 1.595, 0.215, 0, 0],
  ], {
    seed: 4.81,
    sides: 20,
    steps: 3,
    tint: club,
  })
}
function carveFeet(mesh: SahurMesh, side: number, x: number, z: number) {
  const instep = mesh.loft([
    [x, 0.099, z - 0.127, 0, 0],
    [x, 0.108, z - 0.101, 0.079, 0.1],
    [x, 0.108, z - 0.038, 0.103, 0.12],
    [x + side * 0.009, 0.094, z + 0.041, 0.104, 0.111],
    [x + side * 0.023, 0.067, z + 0.125, 0.127, 0.076],
    [x + side * 0.03, 0.051, z + 0.205, 0.14, 0.057],
    [x + side * 0.027, 0.044, z + 0.245, 0.108, 0.043],
    [x + side * 0.019, 0.044, z + 0.268, 0, 0],
  ], {
    seed: 1.7 + side * 0.1,
    sides: 20,
    steps: 3,
    tint: sole,
  })
  const toes = Array.from({length: 5}, (_, i) => {
    const across = -0.082 + 0.057 * i
    const xToe = x + side * across
    const reach = [0.369, 0.35, 0.322, 0.293, 0.259][i]
    const radius = [0.048, 0.034, 0.031, 0.028, 0.026][i]
    const splay = side * (-0.026 + 0.012 * i)
    return mesh.loft([
      [xToe - splay, 0.05, z + reach - 0.16, 0, 0],
      [xToe - splay * 0.5, 0.05, z + reach - 0.108, radius, radius * 0.83],
      [xToe, 0.039, z + reach - 0.055, radius * 0.93, radius * 0.8],
      [xToe + splay, 0.036, z + reach - 0.023, radius * 0.69, radius * 0.64],
      [xToe + splay, 0.037, z + reach, 0, 0],
    ], {
      seed: 1.7 + side * 0.1,
      sides: 12,
      steps: 2,
      tint: sole,
    })
  })
  return [instep, ...toes]
}
function carveLeg(mesh: SahurMesh, side: number, x: number, z: number) {
  return mesh.loft([
    [x, 0.081, z, 0, 0],
    [x, 0.145, z, 0.088, 0.091],
    [x, 0.3, z - 0.009, 0.065, 0.068],
    [x - side * 0.013, 0.559, z - 0.001, 0.074, 0.088],
    [x - side * 0.038, 0.861, z + 0.048, 0.07, 0.072],
    [x - side * 0.038, 0.974, z + 0.083, 0.084, 0.087],
    [x - side * 0.034, 1.112, z + 0.031, 0.087, 0.092],
    [x - side * 0.039, 1.43, z + 0.016, 0.108, 0.113],
    [x - side * 0.045, 1.495, z + 0.014, 0.073, 0.084],
    [x - side * 0.045, 1.533, z + 0.014, 0, 0],
  ], {
    seed: 1.73 + side * 0.17,
    sides: 16,
    steps: 3,
    tint: honey,
  })
}
const grippingArm: ReadonlyArray<Station> = [
  [-0.41, 1.414, 0.211, 0, 0],
  [-0.448, 1.458, 0.211, 0.056, 0.049],
  [-0.465, 1.514, 0.183, 0.062, 0.048],
  [-0.45, 1.606, 0.139, 0.042, 0.035],
  [-0.45, 1.748, 0.076, 0.048, 0.041],
  [-0.457, 1.935, -0.025, 0.066, 0.059],
  [-0.414, 2.111, -0.071, 0.074, 0.063],
  [-0.364, 2.311, -0.093, 0.09, 0.078],
  [-0.339, 2.382, -0.098, 0.063, 0.063],
  [-0.319, 2.416, -0.102, 0, 0],
]
const relaxedArm: ReadonlyArray<Station> = [
  [0.403, 1.391, 0.229, 0, 0],
  [0.426, 1.461, 0.201, 0.065, 0.044],
  [0.442, 1.534, 0.151, 0.056, 0.041],
  [0.453, 1.605, 0.098, 0.044, 0.037],
  [0.481, 1.74, 0.037, 0.052, 0.045],
  [0.503, 1.912, -0.019, 0.065, 0.059],
  [0.47, 2.084, -0.065, 0.084, 0.072],
  [0.39, 2.308, -0.067, 0.093, 0.077],
  [0.359, 2.382, -0.058, 0.066, 0.062],
  [0.328, 2.413, -0.058, 0, 0],
]
export function carveFigure(mesh: SahurMesh, addHull: (rings: ReadonlyArray<Ring>, weight: number, stride?: number) => void) {
  addHull(turnBat(mesh), 23, 2)
  for (const side of [-1, 1]) {
    const x = side < 0 ? -0.221 : 0.203
    const z = side < 0 ? -0.057 : -0.022
    const foot = carveFeet(mesh, side, x, z)
    addHull(foot.flatMap(rings => rings.filter((_, index) => index % 2 === 0 || index === rings.length - 1)), 8, 1)
    addHull(carveLeg(mesh, side, x, z), 23, 3)
    const arm = mesh.loft(side < 0 ? grippingArm : relaxedArm, {
      seed: 3.19 - side * 0.09,
      sides: 18,
      steps: 3,
      tint: honey,
    })
    addHull(arm.slice(0, 16), 4, 3)
    addHull(arm.slice(15), 7, 3)
  }
  carveHands(mesh)
}

function carveHands(mesh: SahurMesh) {
  for (let i = 0; i < 4; i++) {
    const y = 1.468 + 0.032 * (i - 1.5)
    const x = -0.431 + (y - 1.43) * 0.47
    mesh.loft([
      [x - 0.043, y + 0.021, 0.195, 0, 0],
      [x - 0.051, y + 0.006, 0.234, 0.019, 0.019],
      [x - 0.033, y - 0.012, 0.265, 0.018, 0.017],
      [x - 0.004, y - 0.015, 0.275, 0.015, 0.016],
      [x + 0.022, y - 0.01, 0.261, 0, 0],
    ], {
      across: [0, 1, 0],
      seed: 3.28,
      sides: 10,
      steps: 2,
      tint: hand,
    })
    const start = 0.379 + 0.028 * i
    const tip = 1.291 + 0.017 * Math.abs(i - 1)
    mesh.loft([
      [start, 1.458, 0.209 - 0.015 * i, 0, 0],
      [start + 0.01, 1.406, 0.241 - 0.016 * i, 0.022, 0.023],
      [start - 0.008, 1.344 + 0.012 * i, 0.267 - 0.018 * i, 0.019, 0.017],
      [start - 0.029, tip + 0.019, 0.277 - 0.021 * i, 0.015, 0.015],
      [start - 0.039, tip, 0.279 - 0.021 * i, 0, 0],
    ], {
      seed: 3.1,
      sides: 10,
      steps: 2,
      tint: hand,
    })
  }
  // Opposed thumbs: one crosses the grip, the other hooks inward toward the body.
  mesh.loft([
    [-0.48, 1.555, 0.169, 0, 0],
    [-0.47, 1.56, 0.215, 0.029, 0.028],
    [-0.43, 1.531, 0.245, 0.024, 0.024],
    [-0.387, 1.506, 0.259, 0.02, 0.018],
    [-0.376, 1.487, 0.254, 0, 0],
  ], {
    across: [0, 1, 0],
    seed: 3.28,
    sides: 12,
    steps: 2,
    tint: hand,
  })
  mesh.loft([
    [0.428, 1.528, 0.162, 0, 0],
    [0.4, 1.481, 0.202, 0.031, 0.03],
    [0.369, 1.452, 0.251, 0.027, 0.024],
    [0.348, 1.407, 0.269, 0.019, 0.02],
    [0.332, 1.386, 0.261, 0, 0],
  ], {
    seed: 3.1,
    sides: 12,
    steps: 2,
    tint: hand,
  })
}
