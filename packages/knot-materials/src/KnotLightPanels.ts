import type {KnotLightFracture, KnotLightSlot} from './KnotLights.ts'

import hsl from 'okhsl'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'
import {attribute, color, float, mix, positionGeometry, smoothstep, uniform, vec2} from 'three/tsl'
import {Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, MeshStandardNodeMaterial} from 'three/webgpu'

import {knotLight} from './KnotLights.ts'

export const knotLightHousingSize = [knotLight.size[0] + 0.16, 0.1, knotLight.size[2] + 0.16] as const
export const knotLightDiffuserSize = [knotLight.size[0] - 0.12, 0.024, knotLight.size[2] - 0.12] as const
export const knotLightHousingY = 0.025
// The entire luminous face sits BELOW the solid housing, not embedded inside it.
export const knotLightDiffuserY = -0.04
// Rapier needs a small contact skin to resolve a thin, face-on panel after CCD clamps its fall.
export const knotLightDiffuserContactSkin = 0.005
export const knotLightColor = hsl.integer(87, 100, 96)
export const knotLightSurfaceIntensity = 4

/** Two draw calls, with fracture and emission evaluated on the actual visible face. */
export default class KnotLightPanels {
  readonly debrisMaterial = new MeshStandardNodeMaterial({
    color: hsl.integer(112, 8, 44),
    roughness: 0.85,
  })
  // Two smooth-shaded facets per rounded edge: within 0.8 mm (diffuser) and 1.9 mm (ceiling housing) of the true arc.
  readonly diffuserGeometry = new RoundedBoxGeometry(...knotLightDiffuserSize, 1, 0.01)
  readonly diffuserMaterial = new MeshBasicNodeMaterial({toneMapped: false})
  readonly diffusers: InstancedMesh
  readonly fractures: InstancedBufferAttribute
  readonly housingGeometry = new RoundedBoxGeometry(...knotLightHousingSize, 1, 0.025)
  readonly housingMaterial = new MeshStandardNodeMaterial({
    color: hsl.integer(129, 4, 17),
    roughness: 0.6,
    metalness: 0.25,
  })
  readonly housings: InstancedMesh
  readonly intensities: InstancedBufferAttribute
  /** the color the lit diffusers shine in before `surfaceIntensity`, `knotLightColor` unless {@link setColor} changes it; a uniform, so changing it compiles nothing */
  readonly lightColor = uniform(new Color(knotLightColor))
  readonly liveFractions: Float32Array
  private readonly matrix = new Matrix4

  /** `name` prefixes both instanced meshes, so aim dumps tell fixtures in different rooms apart. `surfaceIntensity` is the lit diffuser’s luminance relative to `knotLightColor`. */
  constructor(readonly slots: ReadonlyArray<KnotLightSlot>, name = 'knot-slot-led', surfaceIntensity = knotLightSurfaceIntensity) {
    const intensityValues = new Float32Array(slots.length)
    const intensityAttribute = new InstancedBufferAttribute(intensityValues.fill(1), 1)
    this.intensities = intensityAttribute.setUsage(DynamicDrawUsage)
    // Normal.xy, signed line offset, enabled. Local X/Z coordinates are normalized to [-1, 1].
    const fractureAttribute = new InstancedBufferAttribute(new Float32Array(slots.length * 4), 4)
    this.fractures = fractureAttribute.setUsage(DynamicDrawUsage)
    const slotLiveFractions = new Float32Array(slots.length)
    this.liveFractions = slotLiveFractions.fill(1)
    this.diffuserGeometry.setAttribute('lightIntensity', this.intensities)
    this.diffuserGeometry.setAttribute('lightFracture', this.fractures)
    const point = positionGeometry.xz.div(vec2(knotLightDiffuserSize[0] / 2, knotLightDiffuserSize[2] / 2))
    const fracture = attribute('lightFracture', 'vec4')
    const distance = point.dot(fracture.xy).sub(fracture.z)
    const live = float(1).sub(smoothstep(-0.006, 0.006, distance).mul(fracture.w))
    const edge = smoothstep(0.7, 1, point.x.abs().max(point.y.abs()))
    const emission = attribute('lightIntensity', 'float').mul(live).mul(float(1).sub(edge.mul(0.12)))
    this.diffuserMaterial.colorNode = mix(color(hsl.integer(120, 10, 25)), this.lightColor.mul(surfaceIntensity), emission)
    this.diffuserMaterial.name = 'Knot exposed emissive LED diffusers'
    this.housings = new InstancedMesh(this.housingGeometry, this.housingMaterial, slots.length)
    this.housings.name = `${name}-housings`
    this.diffusers = new InstancedMesh(this.diffuserGeometry, this.diffuserMaterial, slots.length)
    this.diffusers.name = `${name}-diffusers`
    this.diffusers.instanceMatrix.setUsage(DynamicDrawUsage)
    for (const [index, slot] of slots.entries()) {
      this.housings.setMatrixAt(index, this.matrix.makeTranslation(slot.position[0], slot.position[1] + knotLightHousingY, slot.position[2]))
      this.diffusers.setMatrixAt(index, this.matrix.makeTranslation(slot.position[0], slot.position[1] + knotLightDiffuserY, slot.position[2]))
    }
    for (const mesh of [this.housings, this.diffusers]) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
    }
  }

  break(index: number) {
    this.diffusers.setMatrixAt(index, this.matrix.makeScale(0, 0, 0))
    this.diffusers.instanceMatrix.needsUpdate = true
    this.liveFractions[index] = 0
    this.setIntensity(index, 0)
  }

  dispose() {
    this.housings.dispose()
    this.diffusers.dispose()
    this.housingGeometry.dispose()
    this.diffuserGeometry.dispose()
    this.housingMaterial.dispose()
    this.diffuserMaterial.dispose()
    this.debrisMaterial.dispose()
  }

  fracture(index: number, fracture: KnotLightFracture) {
    const [nx, nz] = fracture.normal
    this.fractures.setXYZW(index, nx, nz, nx * fracture.point[0] + nz * fracture.point[1], 1)
    this.fractures.needsUpdate = true
    this.liveFractions[index] = fracture.liveFraction
  }

  /** Makes every lit diffuser shine in the color, like a panel switched to another color temperature. */
  setColor(value: Color) {
    this.lightColor.value.copy(value)
  }

  setIntensity(index: number, intensity: number) {
    if (Math.abs(this.intensities.getX(index) - intensity) > 0.001) {
      this.intensities.setX(index, intensity)
      this.intensities.needsUpdate = true
    }
  }
}
