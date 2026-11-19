import type ForgeMaterials from '#src/lib/materials/forge/ForgeMaterials.ts'

import {CuboidCollider, RigidBody} from '@react-three/rapier'
import renderCanvasTexture from 'canvas-textures/three'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {useGraphicsModeValue} from 'use-graphics-mode'

import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'
import forge, {forgePlate} from '#src/lib/gallery/forge.ts'
import {getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'

export default function WorksPlate({materials}: {materials: ForgeMaterials}) {
  const {width, height, y} = forgePlate
  const {surfaceAnisotropy, canvasTextureResolution} = useGraphicsModeValue(getGraphicsProfile)
  const face = useDisposable(useMemo(() => lettering(surfaceAnisotropy, canvasTextureResolution), [surfaceAnisotropy, canvasTextureResolution]))
  return <RigidBody colliders={false} name='forge-works-plate' position={[0, y, forge.size[1] / 2 - wallFace - 0.026]} rotation-y={Math.PI} type='fixed'>
    <CuboidCollider args={[width / 2, height / 2, 0.026]} />
    <mesh castShadow material={materials.brass} receiveShadow><boxGeometry args={[width, height, 0.052]} /></mesh>
    <mesh position-z={0.027} receiveShadow><planeGeometry args={[width - 0.024, height - 0.024]} /><meshStandardNodeMaterial map={face} roughness={0.36} /></mesh>
  </RigidBody>
}

/** Signwriter’s panel over the machine: a crucible holding the orbs, between the rays of a rising sun. */
function lettering(anisotropy: number, resolution: number) {
  return renderCanvasTexture({name: 'Assay works lettering', width: 1200, height: 300, anisotropy, resolution, draw(ctx) {
    const gold = '#e1b473'
    const cream = '#fff0cd'
    ctx.fillStyle = '#1e4948'
    ctx.fillRect(0, 0, 1200, 300)
    for (const [inset, weight] of [[12, 4], [22, 1.5]]) {
      ctx.lineWidth = weight
      ctx.strokeStyle = gold
      ctx.beginPath()
      ctx.roundRect(inset, inset, 1200 - 2 * inset, 300 - 2 * inset, 14)
      ctx.stroke()
    }
    // Four slotted brass fixings at the corners.
    for (const x of [40, 1160]) {
      for (const y of [40, 260]) {
        ctx.fillStyle = gold
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, 2 * Math.PI)
        ctx.fill()
        ctx.fillStyle = '#745535'
        ctx.fillRect(x - 4, y - 1, 8, 2)
      }
    }
    ctx.save()
    ctx.translate(170, 150)
    ctx.lineWidth = 3
    for (const radius of [84, 75]) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, 2 * Math.PI)
      ctx.stroke()
    }
    for (let i = -3; i <= 3; i++) {
      ctx.save()
      ctx.rotate(i * 0.3)
      ctx.fillStyle = gold
      ctx.fillRect(-1.5, -64, 3, i % 2 === 0 ? 21 : 15)
      ctx.restore()
    }
    ctx.fillStyle = cream
    ctx.beginPath()
    ctx.arc(0, -17, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = gold
    ctx.beginPath()
    ctx.moveTo(-39, 4)
    ctx.lineTo(39, 4)
    ctx.lineTo(18, 36)
    ctx.lineTo(-18, 36)
    ctx.closePath()
    ctx.fill()
    ctx.fillRect(-26, 42, 52, 4)
    ctx.restore()
    ctx.textAlign = 'center'
    ctx.fillStyle = gold
    ctx.font = 'bold 20px sans-serif'
    ctx.letterSpacing = '6px'
    ctx.fillText('GALLERY   •   METALLURGY', 705, 71)
    ctx.fillStyle = cream
    ctx.letterSpacing = '4px'
    ctx.font = 'bold 93px Georgia, serif'
    ctx.fillText('ASSAY WORKS', 706, 181)
    ctx.fillStyle = gold
    ctx.fillRect(345, 205, 722, 2)
    ctx.letterSpacing = '4px'
    ctx.font = '22px sans-serif'
    ctx.fillText('TRANSMUTATION   /   SHOP  01', 705, 246)
  }})
}
