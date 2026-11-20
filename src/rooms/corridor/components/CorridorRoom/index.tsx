import type {NodeMaterial, Texture} from 'three/webgpu'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import CorridorStairs from '#component/CorridorStairs'
import CoveredPassage from '#component/CoveredPassage'
import {corridorHallLanterns, corridorLanding, corridorLandingPaving, corridorPassage, corridorPaving} from '#src/lib/gallery/corridor.ts'
import {lodgeWindowRibCutouts} from '#src/lib/gallery/lodge.ts'
import lodgeTimber from '#src/lib/gallery/lodgeTimber.ts'
import {lightIndoors} from '#src/lib/materials/lights/index.ts'
import PlankFloorMaterial from '#src/lib/materials/PlankFloorMaterial.ts'

export default function CorridorRoom({lining, wood}: {
  /** the corridor’s board lining, shared with its walls and already lit by {@link lightIndoors} */
  lining: NodeMaterial
  wood: Texture
}) {
  // The corridor is lit by its lanterns alone, so its portals need their own copy of the timber.
  const timber = useDisposable(useMemo(() => lightIndoors(new MeshStandardNodeMaterial(lodgeTimber(wood))), [wood]))
  // The landing is laid with the Sienna’s boards, running on from its vestibule up to the stairs’ head tread.
  const landing = useDisposable(useMemo(() => lightIndoors(new PlankFloorMaterial(undefined, false)), []))
  return <group name='corridor-room'>
    <CoveredPassage material={lining} mounts={corridorHallLanterns} passage={corridorPassage} paving={corridorPaving} ribCutouts={lodgeWindowRibCutouts} timber={timber} />
    <CoveredPassage material={lining} passage={corridorLanding} paving={corridorLandingPaving} pavingMaterial={landing} timber={timber} />
    <CorridorStairs lining={lining} timber={timber} />
  </group>
}
