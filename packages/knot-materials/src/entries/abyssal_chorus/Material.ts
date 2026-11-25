import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, normalViewGeometry, tangentLocal, time, vec3} from 'three/tsl'

import {below} from '../../candidates/claude_opus/lib/below.ts'
import {rgb} from '../../candidates/claude_opus/lib/rgb.ts'
import {knotLength, loopCoordinate, tubeCircumference, tubeCoordinates} from '../../candidates/claude_opus/lib/tubeCoordinates.ts'
import {voronoi} from '../../candidates/claude_opus/lib/voronoi3dStruct.ts'
import {wavelengthColor} from '../../candidates/claude_opus/lib/wavelengthColorCie.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

const combRows = 8
const platesPerRow = 560
const wavesPerRow = 29
const jellyIndex = 1.34
/** A comb jelly in the lightless deep. Eight rows of ciliary plates beat in metachronal waves; each plate is a diffraction grating, so rainbows run along the rows and shift hue as you move. Beneath the gel, canals and a crimson gut glow through a parallax of real depth. The creature is shy: approach it and it startles, rings of blue-green bioluminescence blooming across its body more and more often. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.35)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const n = normalLocal.normalize()
    const {along, around} = tubeCoordinates()
    const alongDirection = tangentLocal.xyz.normalize()
    const aroundDirection = n.cross(alongDirection).normalize()
// Where the view ray, refracted into the gel, reaches a given depth – as a shift in tube coordinates.
    const cosIncident = n.dot(view).clamp(0, 1)
    const lateral = view.sub(n.mul(cosIncident))
    const refractedCos = lateral.dot(lateral).div(jellyIndex ** 2).oneMinus().max(0.05).sqrt()
    const drift = lateral.div(jellyIndex).div(refractedCos)
    const sink = (depth: number) => ({
      along: along.sub(drift.dot(alongDirection).mul(depth / knotLength)),
      around: around.sub(drift.dot(aroundDirection).mul(depth / tubeCircumference)),
    })
    const rowField = (coordinateAlong: Node<'float'>, coordinateAround: Node<'float'>) => {
      const rowCoordinate = coordinateAround.mul(combRows)
      const index = rowCoordinate.floor()
      const meander = coordinateAlong.mul(TAU * 13).add(index.mul(2.3)).sin().mul(0.05)
      return {
        index,
        distance: rowCoordinate.fract().sub(0.5).add(meander).abs(),
      }
    }
// Comb rows on the skin.
    const row = rowField(along, around)
    const rowFootprint = around.mul(combRows).fwidth().max(0.0001)
    const rowMask = row.distance.smoothstep(float(0.1).sub(rowFootprint), float(0.1).add(rowFootprint)).oneMinus()
    const plateCoordinate = along.mul(platesPerRow)
    const plateLocal = plateCoordinate.fract()
    const plateFootprint = plateCoordinate.fwidth().max(0.0001)
    const plateResolved = plateFootprint.smoothstep(0.18, 0.45).oneMinus()
// Paddle-shaped plates: longest on the row's midline, tapering toward its edges.
    const plateReach = row.distance.div(0.1).pow2().oneMinus().max(0).sqrt().mul(0.2)
    const plateDistance = plateLocal.sub(0.45).abs()
    const plateShape = plateDistance.smoothstep(plateReach.sub(plateFootprint), plateReach.add(plateFootprint)).oneMinus()
// Fused cilia comb each plate into fine lashes across the row.
    const lashCoordinate = around.mul(combRows * 14)
    const lashes = lashCoordinate.mul(TAU).sin().mul(0.5).add(0.5).mul(lashCoordinate.fwidth().smoothstep(0.3, 0.8).oneMinus()).mul(0.45).add(0.55)
    const plate = mix(float(0.3), plateShape.mul(lashes), plateResolved)
// Metachronal beating: a wave of power strokes runs down every row, each row slightly out of step with its neighbors.
    const beatPhase = along.mul(TAU * wavesPerRow).sub(time.mul(2.6)).add(row.index.mul(0.9))
    const beat = beatPhase.sin()
    const stroke = beat.max(0).pow(3)
// Diffraction: hue follows the angle between the line of sight and the row, tilted by each plate's beat.
    const viewAlong = view.dot(alongDirection)
    const gratingPhase = viewAlong.add(beat.mul(0.35)).mul(1.7).add(row.index.mul(0.37)).add(time.mul(0.05))
    const wavelength = gratingPhase.fract().mul(310).add(395)
    const iridescence = wavelengthColor(wavelength).mul(stroke.mul(1.6).add(0.06)).mul(rowMask).mul(plate)
// Beneath the gel: meridional canals under each row, fed by the crimson gut deep in the tube's core.
    const canalCoordinates = sink(0.03)
    const canal = rowField(canalCoordinates.along, canalCoordinates.around)
    const canalMask = canal.distance.smoothstep(0.015, 0.06).oneMinus()
    const canalHalo = canal.distance.smoothstep(0.02, 0.2).oneMinus()
    const photocytes = voronoi(p.mul(70), 0.8)
    const photocyteDot = photocytes.distance.smoothstep(0.08, 0.22).oneMinus().mul(below(photocytes.random.x, 0.35)).mul(p.mul(70).fwidth().length().smoothstep(0.4, 1).oneMinus())
    const twinkle = time.mul(photocytes.random.y.mul(2).add(0.6)).add(photocytes.random.z.mul(TAU)).sin().mul(0.5).add(0.5)
    const gutCoordinates = sink(0.09)
    const gutLoop = loopCoordinate(gutCoordinates.along, knotLength * 6)
    const gutTexture = mx_fractal_noise_float(vec3(gutLoop.x.add(gutCoordinates.around.mul(TAU).sin()), gutLoop.y.add(gutCoordinates.around.mul(TAU).cos()), time.mul(0.05)), 3, 2, 0.5).mul(0.5).add(0.5)
// Two pharyngeal canals wind through the core, beaded with the gut's pulsing light.
    const gutRow = gutCoordinates.around.mul(2).add(gutCoordinates.along.mul(TAU * 7).sin().mul(0.08))
    const gutLine = gutRow.fract().sub(0.5).abs().smoothstep(0.02, 0.1).oneMinus().add(gutRow.fract().sub(0.5).abs().smoothstep(0, 0.3).oneMinus().mul(0.25))
    const gut = facing.pow(2).mul(gutLine).mul(gutTexture.smoothstep(0.3, 0.75).mul(0.8).add(0.2))
// Startle response: rings of light bloom from scattered points; approach and they fire faster and more often.
    const flashCells = voronoi(p.mul(3.4).add(vec3(0, 0, 5.1)), 0.8)
    const rate = intimate.mul(0.28).add(0.07)
    const cycle = time.mul(rate).add(flashCells.random.x.mul(17))
    const age = cycle.fract().div(rate)
    const active = flashCells.random.y.lessThan(intimate.mul(0.55).add(0.25)).select(float(1), float(0))
    const radius = flashCells.distance.div(3.4)
    const front = age.mul(0.09)
    const ring = radius.sub(front).div(0.018).pow2().negate().exp()
    const bloom = ring.mul(0.8).add(radius.div(0.05).negate().exp().mul(0.6)).mul(age.mul(-0.9).exp()).mul(active).mul(flashCells.border.smoothstep(0, 0.12))
    const noise = mx_noise_float(p.mul(22).add(time.mul(0.3))).mul(0.5).add(0.5)
// The body is nearly black water; almost everything you see is light.
    this.colorNode = rgb(hsl.integer(264, 48, 3.4))
    this.metalness = 0
    this.roughness = 0.12
    this.clearcoat = 0.3
    this.clearcoatRoughness = 0.07
    this.clearcoatNormalNode = normalViewGeometry
    this.normalNode = proceduralNormal(rowMask.mul(plate).mul(0.6).add(stroke.mul(rowMask).mul(0.2)).add(noise.mul(0.04)), 0.0016)
    this.emissiveNode = iridescence.mul(near.mul(0.4).add(0.8))
      .add(rgb(hsl.integer(234, 91, 61)).mul(canalMask.mul(0.25).add(canalHalo.mul(0.05))).mul(facing.mul(0.5).add(0.5)))
      .add(rgb(hsl.integer(177, 100, 92.3)).mul(photocyteDot).mul(twinkle).mul(canalMask.mul(0.8).add(0.2)).mul(0.7))
      .add(rgb(hsl.integer(16, 94, 41)).mul(gut).mul(0.6))
      .add(mix(rgb(hsl.integer(170, 98, 78)), rgb(hsl.integer(260, 100, 55)), noise).mul(bloom).mul(canalMask.mul(0.5).add(0.5)).mul(1.4))
      .add(rgb(hsl.integer(247, 99, 66)).mul(grazing.pow(3)).mul(0.35).add(rgb(hsl.integer(262, 71, 12)).mul(grazing.pow(2)).mul(0.06)))
  }
}
