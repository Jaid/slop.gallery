import type {BufferGeometry} from 'three/webgpu'

import {SphereGeometry, TorusGeometry} from 'three/webgpu'

import {mergeParts} from '../geometry.ts'

/** A gilt rosette facing +y: a domed boss inside a beaded ring 0.62 × `size` from its middle, with eight petals on the ring. Without the boss, it rings whatever hangs from its middle. `detail` multiplies the curve segments. */
export default function rosette(size: number, {boss = true, detail = 1} = {}) {
  const seg = (base: number) => Math.max(2, Math.round(base * detail))
  const parts: Array<BufferGeometry> = []
  if (boss) {
    const dome = new SphereGeometry(size * 0.38, seg(8), seg(3), 0, Math.PI * 2, 0, Math.PI / 2)
    parts.push(dome.scale(1, 0.7, 1))
  }
  const ring = new TorusGeometry(size * 0.62, size * 0.09, seg(4), seg(16))
  parts.push(ring.rotateX(Math.PI / 2))
  for (let i = 0; i < 8; i++) {
    const petal = new SphereGeometry(size * 0.2, seg(6), seg(2), 0, Math.PI * 2, 0, Math.PI / 2)
    const angle = i * Math.PI / 4 + Math.PI / 8
    parts.push(petal.scale(1.5, 0.45, 0.8).translate(size * 0.62, 0, 0).rotateY(angle))
  }
  return mergeParts(parts)
}
