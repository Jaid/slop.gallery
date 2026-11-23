import type {Material, Texture} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import Branch from 'branch-component'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {ExtrudeGeometry, Shape} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {balconyDeck, balconyGuard, lobbyBalcony} from '#src/lib/gallery/lobbyBalcony.ts'

const {backZ, floorY, frontZ, guardHeight, halfWidth} = lobbyBalcony
const width = 2 * halfWidth
const depth = backZ - frontZ
const bronze = '#715132'
const gilt = '#bf9452'
const bayCount = 8
const wallClearance = 0.38
const pierWidth = 0.19
const firstPier = -halfWidth + wallClearance
const bayWidth = -2 * firstPier / bayCount
const cellsPerBay = 3
const cellWidth = (bayWidth - pierWidth) / cellsPerBay
const guardZ = balconyGuard.position[2]

/** A full-width travertine loggia deck, with a bronze grille held between stone piers. */
export default function Balcony({cladding, stone}: {
  cladding: Material
  stone: Texture
}) {
  const corbel = useDisposable(useMemo(() => {
    const profile = new Shape
    profile.moveTo(0, -0.35)
    profile.lineTo(depth - 0.075, -0.35)
    profile.lineTo(depth - 0.075, -1.48)
    // The long curve seats into the rear wall; its nose rises underneath the fascia.
    profile.bezierCurveTo(depth * 0.75, -1.38, depth * 0.67, -0.56, 0, -0.54)
    profile.closePath()
    const geometry = new ExtrudeGeometry(profile, {
      depth: 0.21,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.024,
      bevelSegments: 2,
      curveSegments: 20,
    })
    return geometry.rotateY(-Math.PI / 2).translate(0.105, 0, 0)
  }, []))
  return <StaticBatch name='lobby-balcony'>
    <RigidBody colliders={false} type='fixed'>
      {[balconyDeck, balconyGuard].map(({position, size}) => <CuboidCollider key={position[1]} args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} />)}
    </RigidBody>
    <Box color='#e5d9bd' map={stone} position={balconyDeck.position} roughness={0.44} size={[...balconyDeck.size]} />
    <Box material={cladding} position={[0, floorY - 0.28, frontZ + 0.016]} size={[width, 0.23, 0.19]} />
    <Box color='#d4bf9a' position={[0, floorY - 0.085, frontZ + 0.007]} size={[width, 0.095, 0.22]} />
    <Box color={gilt} metalness={0.62} position={[0, floorY - 0.195, frontZ - 0.084]} size={[width, 0.034, 0.028]} />
    <Box color={gilt} metalness={0.62} position={[0, floorY + 0.002, frontZ + 0.38]} size={[width - 0.25, 0.004, 0.022]} />
    {[0.16, guardHeight - 0.055].map((height, i) => <Box key={height} color={i ? gilt : bronze} metalness={0.6} position={[0, floorY + height, guardZ]} roughness={0.36} size={[width, i ? 0.11 : 0.07, i ? 0.16 : 0.085]} />)}
    {Array.from({length: bayCount}, (_, bay) => <group key={bay} position={[firstPier + bay * bayWidth + pierWidth / 2, floorY, guardZ]}>
      {Array.from({length: cellsPerBay}, (_cell, cell) => <group key={cell} position={[(cell + 0.5) * cellWidth, 0, 0]}>
        <Branch if={cell > 0}><Box color={bronze} metalness={0.6} position={[-cellWidth / 2, 0.62, 0]} size={[0.043, 0.97, 0.053]} /></Branch>
        <mesh castShadow position={[0, 0.63, 0]} receiveShadow scale={[1, 1.94, 1]}>
          <torusGeometry args={[cellWidth * 0.35, 0.022, 8, 24]} />
          <meshStandardNodeMaterial color={bronze} metalness={0.63} roughness={0.39} />
        </mesh>
        <Box color={gilt} metalness={0.63} position={[0, 0.63, 0]} rotation={[0, 0, Math.PI / 4]} size={[0.115, 0.115, 0.073]} />
      </group>)}
    </group>)}
    {[-1, 1].map(side => <Box key={side} color={bronze} metalness={0.6} position={[side * (halfWidth - 0.14), floorY + 0.62, guardZ]} size={[0.05, 0.97, 0.062]} />)}
    <group name='belvedere-roundel' position={[0, 8.9, backZ - 0.21]}>
      <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.27, 1.33, 0.22, 64]} />
        <meshStandardNodeMaterial color='#c8b691' roughness={0.63} />
      </mesh>
      {[1.13, 0.86, 0.25].map(radius => <mesh key={radius} position={[0, 0, -0.108]}>
        <torusGeometry args={[radius, radius === 1.13 ? 0.033 : 0.021, 10, 64]} />
        <meshStandardNodeMaterial color={gilt} metalness={0.6} roughness={0.38} />
      </mesh>)}
      {Array.from({length: 16}, (_, i) => {
        const angle = i * Math.PI / 8
        const major = i % 2 === 0
        return <group key={i} rotation={[0, 0, angle]}>
          <Box color={major ? gilt : bronze} metalness={0.57} position={[0, 0.55, -0.117]} size={[major ? 0.048 : 0.022, 0.63, 0.036]} />
          {major && <Box color={gilt} metalness={0.57} position={[0, 0.995, -0.116]} rotation={[0, 0, Math.PI / 4]} size={[0.076, 0.076, 0.035]} />}
        </group>
      })}
      <mesh position={[0, 0, -0.12]} scale={[0.19, 0.19, 0.062]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardNodeMaterial color={gilt} metalness={0.56} roughness={0.41} />
      </mesh>
    </group>
    {Array.from({length: bayCount + 1}, (_, i) => <group key={i} position={[firstPier + i * bayWidth, floorY, frontZ]}>
      <Box material={cladding} position={[0, 0.6, 0.093]} size={[0.19, 1.08, 0.22]} />
      <Box color={gilt} metalness={0.6} position={[0, 1.16, 0.093]} size={[0.245, 0.06, 0.26]} />
      <Branch if={i !== bayCount / 2}><mesh castShadow geometry={corbel} material={cladding} receiveShadow /></Branch>
    </group>)}
  </StaticBatch>
}
