import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {lightIndoors} from '../materials/lights/index.ts'
import PlankFloorMaterial from '../materials/PlankFloorMaterial.ts'
import {getGraphicsProfile} from '../rendering/graphicsMode.ts'
import {lodgeFloorOil, lodgeFloorPlanks} from './lodge.ts'

/**
 * The Lodge’s oiled planks for one floor of them, lit only by indoor lights, which mirror the room faintly in heavy mode.
 *
 * Every floor of them lays the material’s reflection target at its surface, so each in view renders the mirror and follows the world’s choice of the plane it mirrors.
 */
export default function useLodgeFloor() {
  const {mirrorReflections} = useGraphicsModeValue(getGraphicsProfile)
  return useDisposable(useMemo(() => lightIndoors(new PlankFloorMaterial(lodgeFloorPlanks, mirrorReflections, lodgeFloorOil)), [mirrorReflections]))
}
