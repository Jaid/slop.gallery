import type {WallDecorationsProps} from '#src/components/Scene/WallSurface.tsx'

import Branch from 'branch-component'
import hsl from 'okhsl'

import MainEntrance from '#component/MainEntrance'
import Box from '#src/components/Scene/primitives.tsx'
import gold from '#src/lib/materials/gold.ts'

/** The Lobby’s entrance surround, picture lights and pilasters. */
export default function WallDecorations({wall, trim, material}: WallDecorationsProps) {
  return <Branch if={wall.id === 'lobby-north'}>
    <MainEntrance />
    {[-3.6, 3.6].map(x => <group key={x} position={[x, 0, 0]}><Box material={gold} position={[0, 4.67, 0.55]} size={[0.76, 0.06, 0.16]} /><mesh position={[0, 4.637, 0.55]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.62, 0.12]} /><meshBasicNodeMaterial color={hsl.integer(86, 100, 95)} /></mesh></group>)}
    {[-5.3, -2.2, 2.2, 5.3].map(x => <group key={x}><Box color={trim} material={material} position={[x, 2.7, 0.16]} size={[0.18, 4.9, 0.2]} /><Box color={trim} material={material} position={[x, 4.94, 0.24]} size={[0.34, 0.15, 0.28]} /></group>)}
  </Branch>
}
