import type {Vec3} from '#src/lib/gallery/types.ts'

import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {CanvasTexture, SRGBColorSpace} from 'three/webgpu'

import Box from '#src/components/Scene/primitives.tsx'
import StaticBatch from '#src/components/Scene/StaticBatch.tsx'
import {antechamber, antechamberWings, moonfallApproach, upperGallery, wingArches} from '#src/lib/gallery/antechamber.ts'
import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'

const bronze = '#a58454'
const walnut = '#40382e'
const limestone = '#d8c7a3'
const {west, east} = antechamberWings
const {hall} = upperGallery

type PlaqueProps = {
  caption: string
  name: string
  position: Vec3
  rotation: number
}

type PanelRun = {
  color: string
  count: number
  length: number
  position: Vec3
  rotation: number
}

/** Vitreous enamel direction plates, painted at their final aspect ratio and glazed into a bronze frame. */
function Plaque({caption, name, position, rotation}: PlaqueProps) {
  const map = useDisposable(useMemo(() => {
    const canvas = new OffscreenCanvas(768, 288)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#263634'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#ad9261'
    ctx.lineWidth = 3
    ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#f3e6c6'
    ctx.font = '54px Georgia, serif'
    ctx.letterSpacing = '8px'
    ctx.fillText(name, canvas.width / 2, 130)
    ctx.font = '24px system-ui, sans-serif'
    ctx.letterSpacing = '6px'
    ctx.fillStyle = '#dcc594'
    ctx.fillText(caption, canvas.width / 2, 198)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    return texture
  }, [caption, name]))
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box color={bronze} metalness={0.5} size={[1.65, 0.64, 0.052]} />
    <mesh position={[0, 0, 0.028]} receiveShadow>
      <planeGeometry args={[1.6, 0.6]} />
      <meshStandardNodeMaterial map={map} roughness={0.55} />
    </mesh>
  </group>
}
const face = wallFace + 0.006
const panels: ReadonlyArray<PanelRun> = [
  {
    position: [0, 0, antechamber.south - face],
    rotation: Math.PI,
    length: 7.36,
    count: 4,
    color: '#776753',
  },
  {
    position: [west.west + face, 0, west.center[1]],
    rotation: Math.PI / 2,
    length: west.size[1] - 0.66,
    count: 4,
    color: '#805147',
  },
  {
    position: [west.center[0], 0, west.north + face],
    rotation: 0,
    length: west.size[0] - 0.66,
    count: 3,
    color: '#805147',
  },
  {
    position: [east.center[0], 0, east.south - face],
    rotation: Math.PI,
    length: east.size[0] - 0.66,
    count: 3,
    color: '#476460',
  },
  {
    position: [east.center[0], 0, east.north + face],
    rotation: 0,
    length: east.size[0] - 0.66,
    count: 3,
    color: '#476460',
  },
  {
    position: [(7.78 + hall.east - 0.4) / 2, hall.floorY, hall.north + face],
    rotation: 0,
    length: hall.east - 0.4 - 7.78,
    count: 10,
    color: '#566b62',
  },
]

/** Low painted paneling leaves the upper walls free for the dome’s colored light. */
export default function Joinery() {
  return <>
    <StaticBatch name='antechamber-paneling'>
      {panels.map(({color, count, length, position, rotation}) => <group key={position.join(',')} position={position} rotation={[0, rotation, 0]}>
        <Box color={walnut} position={[0, 0.685, 0]} size={[length, 0.89, 0.044]} />
        <Box color={limestone} position={[0, 1.13, 0.018]} size={[length + 0.06, 0.07, 0.086]} />
        <Box color={bronze} metalness={0.51} position={[0, 1.076, 0.032]} size={[length, 0.019, 0.03]} />
        {Array.from({length: count}, (_, i) => {
          const pitch = length / count
          const x = (i + 0.5) * pitch - length / 2
          return <group key={i} position={[x, 0.674, 0]}>
            <Box color={bronze} metalness={0.43} position={[0, 0, 0.026]} size={[pitch - 0.16, 0.64, 0.014]} />
            <Box color={color} position={[0, 0, 0.038]} size={[pitch - 0.198, 0.595, 0.015]} />
            <Box color={bronze} metalness={0.47} position={[0, 0, 0.052]} rotation={[0, 0, Math.PI / 4]} size={[0.09, 0.09, 0.021]} />
          </group>
        })}
      </group>)}
      {[-1, 1].map(side => <Box key={side} color={bronze} metalness={0.42} position={[hall.center[0], hall.floorY + 0.002, hall.center[1] + side * 0.96]} size={[hall.size[0] - 0.7, 0.004, 0.024]} />)}
    </StaticBatch>
    <Plaque caption='LOWER GALLERY' name='MOONFALL' position={[antechamber.west + face + 0.02, 4.13, wingArches.west.z]} rotation={Math.PI / 2} />
    <Plaque caption='UPPER GALLERY' name='BELVEDERE' position={[antechamber.east - face - 0.02, 4.13, wingArches.east.z]} rotation={-Math.PI / 2} />
    <Plaque caption='LOWER GALLERY  ↓' name='MOONFALL' position={[(west.west + moonfallApproach.x - moonfallApproach.width / 2) / 2, 2.18, west.south - face - 0.02]} rotation={Math.PI} />
    <Plaque caption='UPPER GALLERY  ↑' name='BELVEDERE' position={[east.east - face - 0.02, 2.18, 10.6]} rotation={-Math.PI / 2} />
    <Plaque caption='LOBBY BALCONY  →' name='BELVEDERE' position={[hall.west + face + 0.02, hall.floorY + 1.96, hall.center[1]]} rotation={Math.PI / 2} />
  </>
}
