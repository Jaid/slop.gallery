import type {Material} from 'three/webgpu'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import renderCanvasTexture from 'canvas-textures/three'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {forgeBenchLamps, forgeBenchSign} from '#src/lib/gallery/forge.ts'
import ForgeOpalMaterial from '#src/lib/materials/forge/ForgeOpalMaterial.ts'

/** Enamel workshop plate with a line drawing of a crucible, between the two task lamps over the bench. */
export default function ForgeBenchWall() {
  const {width, height, y} = forgeBenchSign
  const {sites, z} = forgeBenchLamps
  const parts = useDisposable(useMemo(() => {
    const texture = renderCanvasTexture({
      name: 'Forge enamel workshop sign',
      width: 900,
      height: 270,
      draw: context => {
        const ink = '#edd8b0'
        const rule = '#b78655'
        context.fillStyle = '#183438'
        context.fillRect(0, 0, 900, 270)
        context.strokeStyle = rule
        context.lineWidth = 5
        context.strokeRect(18, 18, 864, 234)
        context.lineWidth = 2
        context.strokeRect(28, 28, 844, 214)
        // A crucible and three heat curls, separated from the name by a bronze rule.
        context.beginPath()
        context.moveTo(221, 55)
        context.lineTo(221, 215)
        context.stroke()
        context.strokeStyle = ink
        context.lineWidth = 4
        context.lineCap = 'round'
        context.beginPath()
        context.ellipse(125, 142, 56, 13, 0, 0, 2 * Math.PI)
        context.moveTo(69, 144)
        context.quadraticCurveTo(80, 193, 102, 198)
        context.lineTo(148, 198)
        context.quadraticCurveTo(170, 193, 181, 144)
        for (const x of [102, 125, 148]) {
          context.moveTo(x - 4, 115)
          context.bezierCurveTo(x - 14, 102, x + 11, 95, x + 3, 75)
        }
        context.stroke()
        context.textAlign = 'center'
        context.letterSpacing = '8px'
        context.font = '600 25px sans-serif'
        context.fillStyle = '#cfab77'
        context.fillText('THE FORGE', 550, 100)
        context.letterSpacing = '3px'
        context.font = '700 54px sans-serif'
        context.fillStyle = ink
        context.fillText('ALCHEMY WORKS', 550, 170, 576)
        context.strokeStyle = rule
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(420, 195)
        context.lineTo(680, 195)
        context.stroke()
      },
    })
    const enamel = new MeshStandardNodeMaterial({
      map: texture,
      roughness: 0.46,
    })
    const bronze = new MeshStandardNodeMaterial({
      color: '#8f603d',
      roughness: 0.47,
      metalness: 0.64,
    })
    return {
      enamel,
      bronze,
      dispose() {
        bronze.dispose()
        enamel.dispose()
        texture.dispose()
      },
    }
  }, []))
  return <group name='forge-bench-wall'>
    <RigidBody colliders={false} type='fixed'><CuboidCollider args={[width / 2, height / 2, 0.022]} position={[0, y, z - 0.02]} /></RigidBody>
    <StaticBatch name='forge-enamel-sign' position={[0, y, z - 0.02]}>
      <Box material={parts.bronze} size={[width, height, 0.043]} />
      {[-1, 1].flatMap(x => [-1, 1].map(yy => <mesh key={`${x}:${yy}`} castShadow material={parts.bronze} position={[x * (width / 2 - 0.036), yy * (height / 2 - 0.035), -0.025]} receiveShadow rotation-x={Math.PI / 2}><cylinderGeometry args={[0.017, 0.019, 0.016, 8]} /></mesh>))}
      <mesh material={parts.enamel} name='forge-alchemy-works' position={[0, 0, -0.022]} receiveShadow rotation-y={Math.PI}><planeGeometry args={[width - 0.023, height - 0.023]} /></mesh>
    </StaticBatch>
    {Object.entries(sites).map(([id, x]) => <TaskLight key={id} bronze={parts.bronze} lampId={`forge-${id}`} x={x} />)}
  </group>
}

function TaskLight({bronze, lampId, x}: {
  bronze: Material
  lampId: string
  x: number
}) {
  const opal = useDisposable(useMemo(() => new ForgeOpalMaterial(lampId), [lampId]))
  const {y, z, throwFromWall: reach} = forgeBenchLamps
  return <group name={`${lampId}-fixture`} position={[x, y, z - reach]}>
    <RigidBody colliders={false} type='fixed'><CuboidCollider args={[0.18, 0.12, (reach + 0.16) / 2]} position={[0, 0.035, (reach - 0.16) / 2]} /></RigidBody>
    <StaticBatch name='forge-task-light-bronze'>
      <Box material={bronze} position={[0, 0.13, reach - 0.018]} size={[0.13, 0.2, 0.05]} />
      <Box material={bronze} position={[0, 0.12, reach / 2]} size={[0.055, 0.067, reach]} />
      <mesh castShadow material={bronze} position={[0, 0.069, 0]} receiveShadow><cylinderGeometry args={[0.066, 0.185, 0.14, 32]} /></mesh>
      <mesh castShadow material={bronze} position={[0, -0.005, 0]} receiveShadow><cylinderGeometry args={[0.19, 0.19, 0.023, 32]} /></mesh>
    </StaticBatch>
    <mesh material={opal} scale={[1, 0.45, 1]}><sphereGeometry args={[0.158, 32, 12, 0, 2 * Math.PI, Math.PI / 2, Math.PI / 2]} /></mesh>
  </group>
}
