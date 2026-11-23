import type {LodgeFloorTuning} from './lodgeFloorTuning.ts'

import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo} from 'react'
import {uniform} from 'three/tsl'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {lightIndoors} from '../materials/lights/index.ts'
import PlankFloorMaterial from '../materials/PlankFloorMaterial.ts'
import {getTunedGraphics, subscribeTunedGraphics} from '../rendering/customGraphics.ts'
import {getGraphicsProfile} from '../rendering/graphicsMode.ts'
import {lodgeFloorOil, lodgeFloorPlanks} from './lodge.ts'

/** what every floor of the planks mirrors with, which the tuning panel changes for all of them at once */
const reflection = {
  strength: uniform(lodgeFloorOil.reflection.strength),
  grazingStrength: uniform(lodgeFloorOil.reflection.grazingStrength),
  loss: uniform(lodgeFloorOil.reflection.loss),
}
const finish = {
  ...lodgeFloorOil,
  reflection: {
    ...lodgeFloorOil.reflection,
    ...reflection,
  },
}
/** Gives a floor of the planks the finish the tuning panel set, if it mirrors the room; a matte one keeps its own. */
const tune = (material: PlankFloorMaterial, tuning: LodgeFloorTuning) => {
  if (!material.reflection) {
    return
  }
  reflection.strength.value = tuning.lodgeFloorReflection
  reflection.grazingStrength.value = tuning.lodgeFloorGrazing
  reflection.loss.value = tuning.lodgeFloorLoss
  material.reflectionBlur.value = tuning.lodgeFloorBlur
  material.roughness = tuning.lodgeFloorRoughness
  material.envMapIntensity = tuning.lodgeFloorEnvironment
}

/**
 * The Lodge’s oiled planks for one floor of them, lit only by indoor lights, which mirror the room faintly in heavy mode, in the finish the tuning panel of `?development` sets, which starts as {@link lodgeFloorOil}.
 *
 * Every floor of them lays the material’s reflection target at its surface, so each in view renders the mirror and follows the world’s choice of the plane it mirrors.
 */
export default function useLodgeFloor() {
  const {floorReflections} = useGraphicsModeValue(getGraphicsProfile)
  const material = useDisposable(useMemo(() => lightIndoors(new PlankFloorMaterial(lodgeFloorPlanks, floorReflections, finish)), [floorReflections]))
  useEffect(() => {
    tune(material, getTunedGraphics())
    return subscribeTunedGraphics(tuning => tune(material, tuning))
  }, [material])
  return material
}
