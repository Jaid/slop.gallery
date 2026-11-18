import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {useMemo} from 'react'
import {MeshStandardNodeMaterial} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'

import MeshSurfaceCollider from '#component/MeshSurfaceCollider'
import SalonRoofGeometry, {salonRoofFinish} from '#src/lib/gallery/SalonRoofGeometry.ts'

import RolledGlassMaterial from './RolledGlassMaterial.ts'
import StuccoMaterial from './StuccoMaterial.ts'

/** An oval, fluted plaster cove, with a cast-bronze fanlight at the crown. */
export default function SalonRoof({size}: {size: readonly [number, number]}) {
  const heavy = useGraphicsMode()
  const roof = useDisposable(useMemo(() => new SalonRoofGeometry(size), [size]))
  const finishes = useDisposable(useMemo(() => {
    const plaster = new StuccoMaterial(heavy)
    const clay = new StuccoMaterial(heavy, true)
    const gilt = new MeshStandardNodeMaterial({
      color: '#c09961',
      envMapIntensity: 1.4,
      metalness: 0.62,
      roughness: 0.34,
      name: 'salon-gilt-fillet',
    })
    const bronze = new MeshStandardNodeMaterial({
      color: '#876544',
      envMapIntensity: 1.28,
      metalness: 0.68,
      roughness: 0.37,
      name: 'salon-cast-bronze',
    })
    const stucco = Object.values({
      [salonRoofFinish.plaster]: plaster,
      [salonRoofFinish.clay]: clay,
      [salonRoofFinish.gilt]: gilt,
    })
    const glass = new RolledGlassMaterial(heavy)
    return {
      bronze,
      glass,
      stucco,
      dispose() {
        for (const material of [...stucco, bronze, glass]) {
          material.dispose()
        }
      },
    }
  }, [heavy]))
  return <group name='salon-roof'>
    <RigidBody colliders={false} type='fixed'>
      <MeshSurfaceCollider args={roof.collision} />
    </RigidBody>
    <mesh castShadow geometry={roof.plaster} material={finishes.stucco} name='salon-fluted-ceiling' receiveShadow />
    <mesh castShadow geometry={roof.bars} material={finishes.bronze} name='salon-rooflight-tracery' receiveShadow />
    {/* The aperture and bronze, not the glass, shape the sun and its volumetric shafts. */}
    <mesh castShadow={false} geometry={roof.glass} material={finishes.glass} name='salon-rooflight-glass' />
  </group>
}
