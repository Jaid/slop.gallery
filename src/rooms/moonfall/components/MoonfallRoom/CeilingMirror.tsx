import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'

import {ceilingMirrorY} from '#src/lib/gallery/moonfall/config.ts'
import {moonfallTheme} from '#src/lib/gallery/moonfall/palette.ts'
import PlanarMirrorMaterial from '#src/lib/materials/PlanarMirrorMaterial.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsQuality.ts'

type Props = {size: readonly [number, number]}

export default function CeilingMirror({size}: Props) {
  const {mirrorReflections} = graphicsProfile
  return <Branch if={mirrorReflections}><Lining size={size} /></Branch>
}

/** The slab behind the lining keeps casting its shadow while the mirror renders. The beams below it stay matte. */
function Lining({size: [width, depth]}: Props) {
  const material = useDisposable(useMemo(() => new PlanarMirrorMaterial(null, {
    color: moonfallTheme.ceiling,
    envMapIntensity: 0,
    roughness: 0.7,
    reflection: {
      strength: 0.2,
      grazingStrength: 0,
      gaussianBlur: 4,
      loss: 0,
    },
  }), []))
  return <mesh material={material} name='moonfall-ceiling-mirror' position-y={ceilingMirrorY} receiveShadow rotation-x={Math.PI / 2}>
    <planeGeometry args={[width, depth]} />
    <primitive object={material.reflectionTarget!} />
  </mesh>
}
