import type {Node} from 'three/webgpu'

import {float, Fn, If, Loop, mx_cell_noise_vec3, vec3, vec4} from 'three/tsl'

type Vec3 = Node<'vec3'>

/** How far a seed may stray from the middle of its lattice cell, as a share of the cell: enough to hide the lattice, little enough that the 3 × 3 × 3 cells round a point always hold its nearest seeds. */
const jitter = 0.85
/** The offset of the `index`th (0–26) of the cells of a 3 × 3 × 3 neighborhood from its middle. */
const neighbor = (index: Node<'int'>) => vec3(float(index.mod(3)), float(index.div(3).mod(3)), float(index.div(9))).sub(1)

/** Three random numbers in 0–1 for each lattice cell (whole-numbered `cell`), another three for each `stream`. */
export const cellRandom = (cell: Vec3, stream = 0) => mx_cell_noise_vec3(stream === 0 ? cell : cell.add(vec3(stream * 1031, stream * -577, stream * 263)))
/** Where the seed of a lattice cell lies, in lattice units. */
export const cellSeed = (cell: Vec3) => cell.add(cellRandom(cell).sub(0.5).mul(jitter).add(0.5))

/**
 * The Voronoi cell of a jittered unit lattice that `p` lies in, the way crystals or rock fragments pack a block: `xyz` is the lattice cell of its seed, which `cellRandom` and `cellSeed` take, and `w` how far `p` lies inside the cell, its distance to the nearest face shared with a neighbor, in lattice units.
 *
 * The cells are convex polyhedra, so any surface cuts them into polygons with straight edges, and two faces meeting at a corner of a block show the same cell across it. The distance is exact, from a second pass over the neighbors of the nearest seed (Quílez), so a border of any width keeps its width. It is continuous across the faces, so its screen-space derivatives draw them without seams, unlike the jumping cell ids.
 */
export const voronoiCell = Fn(([p]: [Vec3]) => {
  const base = p.floor().toVar()
  const nearestCell = vec3(0).toVar()
  const toNearest = vec3(0).toVar()
  const nearest = float(1e6).toVar()
  Loop(27, ({i}) => {
    const cell = base.add(neighbor(i))
    const toSeed = cellSeed(cell).sub(p)
    const distance = toSeed.dot(toSeed)
    If(distance.lessThan(nearest), () => {
      nearest.assign(distance)
      nearestCell.assign(cell)
      toNearest.assign(toSeed)
    })
  })
  const inset = float(1e6).toVar()
  Loop(27, ({i}) => {
    const cell = nearestCell.add(neighbor(i))
    const toSeed = cellSeed(cell).sub(p)
    const across = toSeed.sub(toNearest)
    // The distance to the plane halfway between the two seeds.
    If(across.dot(across).greaterThan(1e-6), () => {
      inset.assign(inset.min(toNearest.add(toSeed).mul(0.5).dot(across.normalize())))
    })
  })
  return vec4(nearestCell, inset)
}, {
  p: 'vec3',
  return: 'vec4',
})
