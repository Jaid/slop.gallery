import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, Fn, If, int, Loop, mix, time, vec3} from 'three/tsl'

import {knotArc, knotLength} from '../../candidates/claude_opus/lib/knotArc.ts'
import {knotTubeRadius} from '../../candidates/claude_opus/lib/knotFrameOpus55.ts'
import {tubeInterior} from '../../candidates/claude_opus/lib/tubeInterior.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** one filament slot per cell along the tube; the count must be an integer so identities wrap */
const cells = 150
const cellLength = knotLength / cells
/** vertices per filament polyline, from the electrode to the glass */
const joints = 10
const electrode = 0.07
/** Shortest signed angle between two angles, in radians. */
const angleBetween = (a: Node<'float'>, b: Node<'float'>) => {
  const d = a.sub(b)
  return atan(d.sin(), d.cos())
}
/** Distance between a ray (unit direction) and a segment. */
function raySegmentDistance(origin: Node<'vec3'>, direction: Node<'vec3'>, a: Node<'vec3'>, b: Node<'vec3'>) {
  const edge = b.sub(a)
  const w = origin.sub(a)
  const bd = direction.dot(edge)
  const ee = edge.dot(edge).max(0.0000001)
  const dw = direction.dot(w)
  const ew = edge.dot(w)
  const denominator = ee.sub(bd.mul(bd)).max(0.0000001)
  const s = ew.sub(bd.mul(dw)).div(denominator).clamp()
  const t = bd.mul(s).sub(dw).max(0)
  return w.add(direction.mul(t)).sub(edge.mul(s)).length()
}
/** A plasma tube. A thin electrode runs through the heart of the knot; from it, writhing filaments crawl outward to the smoked glass, flickering in and out. Like a plasma globe, the discharge seeks the nearest conductor — the visitor: the closer one stands, the more filaments bend toward them, and where they touch the glass a hot spot blooms. Filaments are true polylines intersected with the refracted viewing ray, so they stay continuous and crisp at any distance. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {objectDistance, facing} = viewerFrame()
    const attraction = objectDistance.smoothstep(0.9, 3.6).oneMinus().mul(0.7).add(0.15)
    const interior = tubeInterior({
      ior: 1.12,
      maxChord: 0.3,
    })
    const {frame, cameraLocal, direction, entry} = interior
    const toViewer = cameraLocal.sub(frame.center)
    const viewerAngle = atan(toViewer.dot(frame.binormal), toViewer.dot(frame.frameNormal).negate())
    const entryAlong = knotArc(interior.sample(0).tube.x).mul(knotLength)
    const flicker = time.mul(1.6)
// only filament slots the refracted ray can pass near are visited: usually two or three
    const margin = cellLength * 1.4
    const alongSpan = interior.chord.mul(direction.dot(frame.tangent))
    const firstCell = entryAlong.add(alongSpan.min(0)).sub(margin).div(cellLength).floor()
    const cellCount = entryAlong.add(alongSpan.max(0)).add(margin).div(cellLength).floor().sub(firstCell).add(1).min(8)
    const discharge = Fn(() => {
      const core = float(0).toVar()
      const halo = float(0).toVar()
      const contact = float(0).toVar()
      Loop({
        start: int(0),
        end: int(cellCount),
        type: 'int',
      }, ({i}) => {
        const cell = firstCell.add(float(i))
        const slot = cell.mod(cells)
        const identity = cellNoiseVec3(vec3(slot, 5.3, 0))
        const phase = flicker.mul(identity.x.mul(0.6).add(0.7)).add(identity.z.mul(9))
        const strike = cellNoiseVec3(vec3(slot, phase.floor(), 1.7))
// each slot strikes only part of the time: a quick flash, then a slower fade
        const alive = strike.x.smoothstep(0.3, 0.5).mul(phase.fract().oneMinus().pow(0.6)).mul(strike.y.mul(0.5).add(0.6))
        If(alive.greaterThan(0.004), () => {
          const free = identity.y.mul(TAU).add(time.mul(identity.x.sub(0.5).mul(0.5)))
          const heading = free.add(angleBetween(viewerAngle, free).mul(attraction.mul(identity.z.mul(0.6).add(0.4))))
          const base = cell.add(0.5).add(identity.z.sub(0.5).mul(0.6)).mul(cellLength).sub(entryAlong)
// incommensurate sines: jagged, restless and far cheaper than gradient noise
          const point = (joint: number, branch: number) => {
            const radius = electrode + (1 - electrode) * joint / (joints - 1)
            const seed = slot.mul(1.37).add(branch * 2.9)
            const writhe = time.mul(1.9).add(seed).add(radius * 5.1).sin().mul(0.45)
              .add(time.mul(-3.3).add(seed.mul(2.3)).add(radius * 13.7).sin().mul(0.17))
              .add(time.mul(5.1).add(seed.mul(0.7)).add(radius * 29).sin().mul(0.07)).mul(radius)
            const drift = time.mul(1.3).add(seed.mul(4.1)).add(radius * 3.7).sin().mul(cellLength * 0.8 * radius)
// crackle: every joint jumps a little, re-rolled several times a second
            const jolt = cellNoiseVec3(vec3(slot, joint + branch * 13, time.mul(9).floor())).sub(0.5).mul(radius)
            const angle = heading.add(writhe).add(jolt.x.mul(0.5))
            const offset = frame.frameNormal.mul(angle.cos().negate()).add(frame.binormal.mul(angle.sin())).mul(radius * knotTubeRadius)
            return frame.center.add(frame.tangent.mul(base.add(drift).add(jolt.y.mul(cellLength * 0.6)))).add(offset)
          }
// a trunk from the electrode, forking once or twice on its way to the glass
          const forkAt = 3
          const trunk = Array.from({length: forkAt + 1}, (_, joint) => point(joint, 0))
          for (const branch of [0, 1, 2]) {
            let previous = branch === 0 ? trunk[0] : trunk[forkAt]
            const weight = branch === 0 ? alive : alive.mul(identity.x.step(branch * 0.3))
            for (let joint = branch === 0 ? 1 : forkAt + 1;joint < joints;joint++) {
              const next = branch === 0 && joint <= forkAt ? trunk[joint] : point(joint, branch)
              const distance = raySegmentDistance(entry, direction, previous, next)
// thick near the electrode, hair-fine where it meets the glass
              const width = (0.0026 - 0.0017 * joint / (joints - 1)) * (branch === 0 ? 1 : 0.7)
              core.addAssign(distance.div(width).pow(2).negate().exp().mul(weight))
              halo.addAssign(distance.div(width * 7).pow(2).negate().exp().mul(weight).mul(0.5))
              previous = next
            }
// where each tip meets the glass it spreads into a small, ragged starburst
            const foot = previous.sub(entry)
            const footAngle = atan(foot.dot(frame.tangent), foot.dot(frame.normal.cross(frame.tangent)))
            const rays = footAngle.mul(5).add(slot.mul(1.3)).add(branch * 2).add(time.mul(2.3)).sin().mul(0.5)
              .add(footAngle.mul(3).sub(slot.mul(0.7)).sub(time.mul(1.7)).sin().mul(0.35)).add(0.5).max(0).pow(1.5).mul(1.4)
            const reach = foot.length().div(rays.mul(0.008).add(0.003))
            contact.addAssign(reach.pow(2).negate().exp().mul(0.8).add(foot.length().div(0.0025).pow(2).negate().exp()).mul(weight))
          }
        })
      })
      return vec3(core, halo, contact)
    })()
// the electrode: distance from the viewing ray to the tube's axis
    const axisGap = raySegmentDistance(entry, direction, frame.center.sub(frame.tangent.mul(0.4)), frame.center.add(frame.tangent.mul(0.4)))
    const wire = axisGap.div(0.0035).pow(2).negate().exp()
    const wireHalo = axisGap.div(0.02).pow(2).negate().exp()
    const plasma = color(hsl.integer(326, 100, 97)).mul(discharge.x.mul(1.1))
      .add(mix(color(hsl.integer(338, 100, 67)), color(hsl.integer(286, 99, 53)), discharge.y.smoothstep(0, 1)).mul(discharge.y.mul(0.45)))
      .add(color(hsl.integer(326, 100, 91)).mul(wire.mul(1.2)))
      .add(color(hsl.integer(316, 100, 62)).mul(wireHalo.mul(0.35)))
    const bloom = color(hsl.integer(326, 100, 93)).mul(discharge.z.mul(1.3))
// the rarefied gas glows faintly where the tube is thick
    const gas = color(hsl.integer(290, 86, 17)).mul(interior.chord.mul(1.2))
    this.colorNode = color(hsl.integer(307, 54, 3))
    this.metalness = 0
    this.roughness = 0.05
    this.specularIntensity = 0.5
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.02
    this.emissiveNode = plasma.add(bloom).add(gas).mul(facing.mul(0.3).add(0.7))
  }
}
