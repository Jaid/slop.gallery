import type {PlacedLamp} from '#src/worlds/base/PlacedRoom.ts'
import type {Light, PointLight, SpotLight} from 'three/webgpu'

import {useLayoutEffect, useRef, useState} from 'react'
import {Object3D} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'

import {registerLamp} from '#src/lib/rendering/lamps.ts'
import {useShadowProps} from '#src/lib/rendering/shadowFilters.ts'
import {reachedRooms} from '#src/lib/worldReach.ts'
import world from '#src/worlds/current.ts'

type PlacedSpotLamp = Extract<PlacedLamp, {kind: 'spot'}>

const lamps = world.lamps()
/** Registers the lamp’s light by its global id while it is mounted, so that fixtures can find it and lighting knows where it shines. */
const useRegistered = <Kind extends Light>(lamp: PlacedLamp) => {
  const light = useRef<Kind>(null)
  useLayoutEffect(() => registerLamp(light.current!, {
    id: lamp.id,
    optional: lamp.optional ?? false,
    rooms: world.lampRooms(lamp),
  }), [lamp])
  return light
}

/**
 * Every lamp of the world within reach as a light at the scene’s root, named by its global id. All of them exist from the first frame on, wherever their rooms are still loading: a light mounting later would rebuild every lit material. The lamps of rooms out of reach under `?world_reach` are never created at all, like their rooms.
 * Fixtures only draw their lamps’ bodies; the ones that animate their light, like a flickering fire, find it with `useLamp`.
 */
export default function Lamps() {
  const reached = reachedRooms()
  const shown = reached ? lamps.filter(lamp => reached.has(lamp.room)) : lamps
  return <group name='lamps'>
    {shown.filter(lamp => lamp.kind !== 'spot').map(lamp => <PointLamp key={lamp.id} lamp={lamp} />)}
    {shown.filter((lamp): lamp is PlacedSpotLamp => lamp.kind === 'spot').map(lamp => <SpotLamp key={lamp.id} lamp={lamp} />)}
  </group>
}

/** Whether the lamp casts a shadow in the current graphics mode. */
const useShadow = (lamp: PlacedLamp) => {
  const isHeavy = useGraphicsMode()
  return lamp.shadow === 'heavy' ? isHeavy : lamp.shadow ?? false
}
/** Point lights that cast a shadow borrow a slot of the shadow pool with `userData.shadow`. */
function PointLamp({lamp}: {lamp: PlacedLamp}) {
  const light = useRegistered<PointLight>(lamp)
  const shadow = useShadow(lamp)
  return <pointLight color={lamp.tint ?? '#ffffff'} decay={lamp.decay ?? 2} distance={lamp.range ?? 0} intensity={lamp.strength ?? 1} name={lamp.id} position={lamp.position} userData-shadow={shadow} ref={light} />
}
/** A spot light that casts a shadow takes a lights node of its own in every lit material. */
function SpotLamp({lamp}: {lamp: PlacedSpotLamp}) {
  const light = useRegistered<SpotLight>(lamp)
  const castsShadow = useShadow(lamp)
  const [target] = useState(() => {
    const object = new Object3D
    object.position.set(...lamp.target)
    return object
  })
  const shadow = useShadowProps(2048)
  return <>
    <primitive object={target} />
    <spotLight angle={lamp.angle} castShadow={castsShadow} color={lamp.tint ?? '#ffffff'} decay={lamp.decay ?? 2} distance={lamp.range ?? 0} intensity={lamp.strength ?? 1} name={lamp.id} penumbra={lamp.penumbra ?? 0} position={lamp.position} shadow-bias={-0.0001} shadow-normalBias={0.025} target={target} ref={light} {...castsShadow ? shadow : {}} />
  </>
}
