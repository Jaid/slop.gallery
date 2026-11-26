import type {ThreeElements} from '@react-three/fiber'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js'

import EngravedPlateFace from '#component/EngravedPlateFace'
import engravedPlate from '#src/lib/gallery/engravedPlate.ts'
import BrassMaterial from '#src/lib/materials/BrassMaterial.ts'
import EngravedBrassMaterial from '#src/lib/materials/EngravedBrassMaterial.ts'
import {graphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import useLoadingElementTexture from '#src/lib/useLoadingElementTexture.ts'

const {radius, size} = engravedPlate

/** A brass plate engraved with `heading` over `byline`, the middle of its back on the surface it is fixed to at its origin, its face toward +z; plain brass until its lettering is rasterized. */
export default function EngravedPlate({byline, heading, ...group}: Omit<ThreeElements['group'], 'children'> & {
  byline?: string
  heading: string
}) {
  const [width, height] = engravedPlate.texture
  const lettering = useLoadingElementTexture(`engraved-plate:${heading}\n${byline ?? ''}`, useMemo(() => ({
    width,
    height,
    resolution: graphicsProfile.canvasTextureResolution,
    name: `Engraved plate: ${heading}`,
    mipmaps: graphicsProfile.canvasTextureMipmaps,
    render: () => <EngravedPlateFace byline={byline} heading={heading} />,
  }), [byline, heading, height, width]))
  const material = useDisposable(useMemo(() => (lettering ? new EngravedBrassMaterial(lettering) : new BrassMaterial), [lettering]))
  const geometry = useDisposable(useMemo(() => new RoundedBoxGeometry(...size, 2, radius), []))
  return <group {...group}>
    <mesh castShadow geometry={geometry} material={material} name='engraved-plate' position={[0, 0, size[2] / 2]} receiveShadow />
  </group>
}
