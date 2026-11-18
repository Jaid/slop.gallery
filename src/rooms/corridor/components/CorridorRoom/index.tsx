import type {NodeMaterial, Texture} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import CorridorStairs from '#component/CorridorStairs'
import CoveredPassage from '#component/CoveredPassage'
import {corridorHallLanterns, corridorLanding, corridorLandingLantern, corridorPassage, corridorPaving} from '#src/lib/gallery/corridor.ts'
import {lodgeWindowRibCutouts} from '#src/lib/gallery/lodge.ts'
import lodgeTimber from '#src/lib/gallery/lodgeTimber.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'

const landingMounts = [corridorLandingLantern]

export default function CorridorRoom({lining, wood}: {
  /** the corridor’s board lining, shared with its walls and already lit by {@link lightIndoors} */
  lining: NodeMaterial
  wood: Texture
}) {
  // The corridor is lit by its lanterns alone, so its portals need their own copy of the timber.
  const timber = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial(lodgeTimber(wood))), [wood]))
  return <group name='corridor-room'>
    <CoveredPassage material={lining} mounts={corridorHallLanterns} passage={corridorPassage} paving={corridorPaving} ribCutouts={lodgeWindowRibCutouts} sole timber={timber} />
    <CoveredPassage material={lining} mounts={landingMounts} passage={corridorLanding} timber={timber} />
    <CorridorStairs lining={lining} timber={timber} />
  </group>
}
