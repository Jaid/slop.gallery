import type {Wall} from '#src/lib/placement/wallGeometry.ts'
import type {Material} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import {siennaWainscot, siennaWainscotPanel} from '#src/lib/gallery/siennaWainscot.ts'

const {field, frame, rail} = siennaWainscotPanel

/** The Sienna’s wainscot along a papered wall: fitted between corners and door casings, each a frame with a raised field and a rail along its top. */
export default function SiennaWainscot({field: fieldMaterial, frame: frameMaterial, wall}: {
  /** the darker wood of the raised fields */
  field: Material
  /** the varnished wood of the frames and rails, with its grain along each mesh’s x axis */
  frame: Material
  wall: Wall
}) {
  return <group position={wall.center} rotation={[0, wall.rotation, 0]}>
    {siennaWainscot(wall).map(({u, width}) => <group key={u} position={[u, 0, 0]} scale-x={width / siennaWainscotPanel.width}>
      <Box material={frameMaterial} name='sienna-wainscot-frame' position={[0, frame.y, frame.front]} size={[...frame.size]} />
      <Box material={fieldMaterial} name='sienna-wainscot-panel' position={[0, field.y, field.front]} size={[...field.size]} />
      <Box material={frameMaterial} name='sienna-wainscot-rail' position={[0, rail.y, rail.front]} size={[...rail.size]} />
    </group>)}
  </group>
}
