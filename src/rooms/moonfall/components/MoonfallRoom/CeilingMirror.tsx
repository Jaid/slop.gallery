import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {ceilingMirrorY} from '#src/lib/gallery/moonfall/config.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import PlanarMirrorMaterial from '#src/lib/materials/PlanarMirrorMaterial.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

type Slab = {
  center: readonly [number, number]
  size: readonly [number, number]
}
type Props = {
  size: readonly [number, number]
  slabs: ReadonlyArray<Slab>
}

export default function CeilingMirror({slabs}: Props) {
  const {mirrorReflections} = useGraphicsModeValue(getGraphicsProfile)
  return <Branch if={mirrorReflections}><Lining slabs={slabs} /></Branch>
}

/** The slab behind the lining keeps casting its shadow while the mirror renders. The beams below it stay matte. */
function Lining({slabs}: {slabs: ReadonlyArray<Slab>}) {
  const material = useDisposable(useMemo(() => new PlanarMirrorMaterial(null, {
    color: moonfallTheme.ceiling,
    envMapIntensity: 0,
    roughness: 0.7,
    reflection: {
      strength: 0.25,
      grazingStrength: 0,
      gaussianBlur: 4,
      loss: 0,
    },
  }), []))
  return <group position-y={ceilingMirrorY} rotation-x={Math.PI / 2}>
    {slabs.map(({center: [x, z], size: [width, depth]}) => <mesh key={`${x}:${z}`} material={material} name='moonfall-ceiling-mirror' position={[x, z, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
    </mesh>)}
    <primitive object={material.reflectionTarget!} />
  </group>
}
