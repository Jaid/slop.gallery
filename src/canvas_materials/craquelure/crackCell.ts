import type {Node} from 'three/webgpu'

import {atan, float, Fn, If, Loop, mx_cell_noise_vec3, vec2, vec3, vec4} from 'three/tsl'

type Vec2 = Node<'vec2'>

/** How far a seed may stray from the middle of its lattice cell, as a share of the cell: enough to hide the lattice, little enough that the 3 × 3 cells round a point always hold its nearest seeds. */
const jitter = 0.85
/** The offset of the `index`th (0–8) of the cells of a 3 × 3 neighborhood from its middle. */
const neighbor = (index: Node<'int'>) => vec2(float(index.mod(3)), float(index.div(3))).sub(1)

/** Three random numbers in 0–1 for each lattice cell (whole-numbered `cell`), another three for each `stream`. */
export const cellRandom = (cell: Vec2, stream = 0) => mx_cell_noise_vec3(vec3(cell, stream))
/** Where the seed of a lattice cell lies, in lattice units. */
const cellSeed = (cell: Vec2) => cell.add(cellRandom(cell).xy.sub(0.5).mul(jitter).add(0.5))
/**
 * The Voronoi cell of a jittered unit lattice in the plane that `p` lies in, the way a drying paint film breaks into islands: `xy` is the lattice cell of its seed, which `cellRandom` takes, `z` how far `p` lies inside the cell, its distance to the nearest edge shared with a neighbor, in lattice units, and `w` the direction toward that edge as an angle.
 *
 * The distance is exact, from a second pass over the neighbors of the nearest seed (Quílez), so a crack of any width keeps its width, and it is continuous across the edges, where it falls to 0 from both sides.
 */
const crackCell = Fn(([p]: [Vec2]) => {
  const base = p.floor().toVar()
  const nearestCell = vec2(0).toVar()
  const toNearest = vec2(0).toVar()
  const nearest = float(1e6).toVar()
  Loop(9, ({i}) => {
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
  const toward = vec2(1, 0).toVar()
  Loop(9, ({i}) => {
    const cell = nearestCell.add(neighbor(i))
    const toSeed = cellSeed(cell).sub(p)
    const across = toSeed.sub(toNearest)
    // The distance to the line halfway between the two seeds.
    If(across.dot(across).greaterThan(1e-6), () => {
      const direction = across.normalize()
      const distance = toNearest.add(toSeed).mul(0.5).dot(direction)
      If(distance.lessThan(inset), () => {
        inset.assign(distance)
        toward.assign(direction)
      })
    })
  })
  return vec4(nearestCell, inset, atan(toward.y, toward.x))
}, {
  p: 'vec2',
  return: 'vec4',
})

export default crackCell
