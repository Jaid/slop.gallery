import type {Vec3} from '#src/lib/gallery.ts'
import type {ThreeElements} from '@react-three/fiber'
import type {ColorRepresentation, Texture} from 'three/webgpu'

import Branch from 'branch-component'
import hsl from 'okhsl'

const defaultColor = hsl.integer(88, 24, 84)

export default function Box({size, color = defaultColor, map, material, metalness = 0, roughness = 0.7, envMapIntensity = 1, ...props}: Omit<ThreeElements['mesh'], 'children'> & {
  color?: ColorRepresentation
  envMapIntensity?: number
  map?: Texture
  metalness?: number
  roughness?: number
  size: Vec3
}) {
  return <mesh castShadow material={material} receiveShadow {...props}><boxGeometry args={size} /><Branch not={material}><meshStandardNodeMaterial color={color} envMapIntensity={envMapIntensity} map={map} metalness={metalness} roughness={roughness} /></Branch></mesh>
}
