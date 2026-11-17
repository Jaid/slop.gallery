import {expect, test} from 'bun:test'

import CrumbledStoneGeometry from '../../src/lib/gallery/CrumbledStoneGeometry.ts'
import {salonSculptureSocket} from '../../src/lib/gallery/salon.ts'
import {triangleCount} from '../../src/lib/geometry.ts'
import {blockSize} from '../../src/sculptures/block/config.ts'

for (const [name, size] of [['socket', salonSculptureSocket.size], ['block', blockSize]] as const) {
  test(`the ${name} has a closed chipped rim and a flat, square-edged base`, () => {
    const geometry = new CrumbledStoneGeometry(size)
    try {
      expect(triangleCount(geometry)).toBeLessThan(4000)
      // The box faces have separate normals and UVs, but their rim vertices must meet in space.
      const positions = geometry.getAttribute('position')
      const keys = Array.from({length: positions.count}, (_, i) => [positions.getX(i), positions.getY(i), positions.getZ(i)].join(','))
      const directed = new Set<string>
      const indices = geometry.index!.array
      let baseTriangles = 0
      const baseY = Math.fround(-size[1] / 2)
      const base = keys.filter((_, i) => positions.getY(i) === baseY)
      const halfX = Math.fround(size[0] / 2)
      const halfZ = Math.fround(size[2] / 2)
      const corners = [-halfX, halfX].flatMap(x => [-halfZ, halfZ].map(z => [x, baseY, z].join(',')))
      expect(new Set(base)).toEqual(new Set(corners))
      for (let i = 0; i < indices.length; i += 3) {
        if ([indices[i], indices[i + 1], indices[i + 2]].every(index => positions.getY(index) === baseY)) {
          baseTriangles++
        }
        for (let j = 0; j < 3; j++) {
          const a = keys[indices[i + j]]
          const b = keys[indices[i + (j + 1) % 3]]
          directed.add(`${a}|${b}`)
        }
      }
      expect(baseTriangles).toBe(2)
      expect(directed.size).toBe(indices.length)
      expect([...directed].every(edge => directed.has(edge.split('|').toReversed().join('|')))).toBe(true)
    } finally {
      geometry.dispose()
    }
  })
}
