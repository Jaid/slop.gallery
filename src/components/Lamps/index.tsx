import type {PlacedLamp} from '#src/worlds/base/PlacedRoom.ts'
import type {Light, PointLight, SpotLight} from 'three/webgpu'

import {useLayoutEffect, useRef, useState} from 'react'
import {Object3D} from 'three/webgpu'
import useGraphicsMode from 'use-graphics-mode'

import {registerLamp} from '#src/lib/rendering/lamps.ts'
import {useShadowProps} from '#src/lib/rendering/shadowFilters.ts'
import world from '#src/worlds/current.ts'

type PlacedSpotLamp = Extract<PlacedLamp, {kind: 'spot'}>
type PlacedPointLamp = Exclude<PlacedLamp, PlacedSpotLamp>

// Lamps of rooms out of reach never exist, so they neither light nor compile into anything.
const lamps = world.lamps().filter(lamp => world.reach.covers(lamp.room))
const spots = lamps.filter((lamp): lamp is PlacedSpotLamp => lamp.kind === 'spot')
const points = lamps.filter((lamp): lamp is PlacedPointLamp => lamp.kind !== 'spot')
/** Registers the lamp’s light by its global id while it is mounted, so that fixtures can find it and lighting knows where it shines. */
const useRegistered = <Kind extends Light>(lamp: PlacedLamp) => {
  const light = useRef<Kind>(null)
  useLayoutEffect(() => registerLamp(light.current!, {
    id: lamp.id,
    optional: lamp.optional ?? false,
    fences: world.lampFences(lamp),
  }), [lamp])
  return light
}

/**
 * Every lamp of the rooms in the world’s reach as a light at the scene’s root, named by its global id. All of them exist from the first frame on, wherever their rooms are still loading: a light mounting later would rebuild every lit material.
 * Fixtures only draw their lamps’ bodies; the ones that animate their light, like a flickering fire, find it with `useLamp`.
 */
export default function Lamps() {
  return <group name='lamps'>
    {points.map(lamp => <PointLamp key={lamp.id} lamp={lamp} />)}
    {spots.map(lamp => <SpotLamp key={lamp.id} lamp={lamp} />)}
  </group>
}

/** Whether the lamp casts a shadow in the current graphics mode. */
const useShadow = (lamp: PlacedLamp) => {
  const isHeavy = useGraphicsMode()
  return lamp.shadow === 'heavy' ? isHeavy : lamp.shadow ?? false
}
/** Point lights that cast a shadow borrow a slot of the shadow pool with `userData.shadow`, blurred wider as `userData.softShadow` asks, the pool’s `softShadowKey`. */
function PointLamp({lamp}: {lamp: PlacedPointLamp}) {
  const light = useRegistered<PointLight>(lamp)
  const shadow = useShadow(lamp)
  return <pointLight color={lamp.tint ?? '#ffffff'} decay={lamp.decay ?? 2} distance={lamp.range ?? 0} intensity={lamp.strength ?? 1} name={lamp.id} position={lamp.position} userData-shadow={shadow} userData-softShadow={lamp.softShadow} ref={light} />
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
