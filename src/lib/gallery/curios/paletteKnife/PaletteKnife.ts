import type {Vec3} from '../../types.ts'

import {BoxGeometry, CylinderGeometry} from 'three/webgpu'

import BrushedMetalMaterial from '#src/lib/materials/BrushedMetalMaterial.ts'
import GrainedWoodMaterial from '#src/lib/materials/GrainedWoodMaterial.ts'
import {studioEnvironment} from '#src/lib/materials/metal.ts'

import salon from '../../salon.ts'
import {withWoodGrain} from '../../woodGrain.ts'
import Curio, {CurioModel} from '../base/Curio.ts'

/** the blade: how long, wide and thick its flat trowel is */
const blade = {
  length: 0.115,
  width: 0.034,
  thickness: 0.0016,
}
/** where the handle’s axis runs, cranked up from the blade so the painter’s knuckles clear the canvas */
const handleY = 0.0105
/** The blade’s width at the share `t` of its length, from its point to its heel: swelling out of the point, widest past its middle and narrowing into the heel. */
function bladeWidth(t: number) {
  const swelling = 0.08 + 0.92 * Math.sin(Math.PI / 2 * Math.min(t / 0.55, 1))
  return t > 0.55 ? swelling * (1 - 0.45 * (t - 0.55) / 0.45) : swelling
}
/** A flat trowel of spring steel, pointed at its tip and thinning toward it, its underside on the table. */
function bladeGeometry() {
  const geometry = new BoxGeometry(blade.length, blade.thickness, blade.width, 10, 1, 2)
  const position = geometry.getAttribute('position')
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index)
    const t = (x + blade.length / 2) / blade.length
    position.setZ(index, position.getZ(index) * bladeWidth(t))
    position.setY(index, position.getY(index) * (0.6 + 0.4 * t))
  }
  geometry.computeVertexNormals()
  return geometry.translate(-0.05, blade.thickness / 2, 0)
}
/** A part’s satin stainless steel. */
const steel = () => new BrushedMetalMaterial({environment: studioEnvironment})
/** where the palette knife lies when a game begins: on the Salon’s floor in front of its ottoman, in the skylight’s light, as if a painter dropped it judging the hang */
export const paletteKnifeSpot: Vec3 = [salon.center[0] + 0.35, 0.004, salon.center[1] + 0.85]

/**
 * A cranked palette knife: a flat trowel blade of spring steel, pointed and thinning toward its tip, its shank rising from the heel to a ferrule and a turned wooden handle that runs on above the blade’s plane, so a painter can lay paint flat without dragging their knuckles through it.
 * It lies on the Salon’s floor, and carried into the Forge steers a Transparent Orb there to an Impasto Orb.
 * In its own frame the blade lies flat with its tip toward −x and its handle running toward +x.
 */
export default class PaletteKnife extends Curio {
  readonly id = 'palette-knife'
  readonly mass = 0.14
  readonly position = paletteKnifeSpot
  readonly reach = 0.22
  readonly room = 'salon'
  override readonly rotation: Vec3 = [0, 0.7, 0]
  readonly title = 'A palette knife, still loaded'

  createModel() {
    const shank = new BoxGeometry(0.05, 0.0028, 0.0075)
    shank.rotateZ(0.23)
    shank.translate(0.025, 0.0072, 0)
    const ferrule = new CylinderGeometry(0.0068, 0.0068, 0.024, 16)
    ferrule.rotateZ(Math.PI / 2)
    ferrule.translate(0.052, handleY, 0)
    // Slimmer where the ferrule grips it, swelling a little to its butt.
    const handle = new CylinderGeometry(0.008, 0.0095, 0.105, 20)
    handle.rotateZ(Math.PI / 2)
    handle.translate(0.117, handleY, 0)
    return new CurioModel([
      {
        name: 'palette-knife-blade',
        geometry: bladeGeometry(),
        material: steel(),
      },
      {
        name: 'palette-knife-shank',
        geometry: shank,
        material: steel(),
      },
      {
        name: 'palette-knife-ferrule',
        geometry: ferrule,
        material: steel(),
      },
      {
        name: 'palette-knife-handle',
        geometry: withWoodGrain(handle, (x, y, z) => [x, z + y * 0.3], 0.61),
        material: new GrainedWoodMaterial({
          heartwood: ['#7a3b22', '#a05a34'],
          latewood: '#4a2413',
        }, {roughness: 0.5}),
      },
    ])
  }
}
