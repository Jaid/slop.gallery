import type {BufferGeometry} from 'three/webgpu'

import {useFrame, useThree} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useEffect, useMemo, useRef, useState} from 'react'
import {attribute, cameraPosition, dot, float, fract, length, modelWorldMatrixInverse, positionLocal, step, vec4} from 'three/tsl'
import {MeshBasicNodeMaterial} from 'three/webgpu'

import {useGallery} from '#src/lib/gallery.ts'
import WallObstructionScan from '#src/lib/placement/WallObstructionScan.ts'
import {patchGeometry, reservationGeometry, stickySurfaceGeometry} from '#src/lib/placement/wallOverlayGeometry.ts'
import world from '#src/worlds/current.ts'

const stickyColor = '#38e08c'
const reservedColor = '#ff2a2a'
/** how many meters out of their wall the red overlays are drawn, toward the camera, so whatever stands out of their wall less far, like a chimney breast, can’t hide them, while furniture and walls further in front still do */
const nudge = 1.4
/** how many meters at most an overlay travels toward the camera, so one seen at a glancing angle doesn’t reach through the walls of other rooms in front of it */
const furthest = 2
/** how close to the camera a nudged overlay comes at most, beyond its near plane */
const nearest = 0.15
/** how far apart the stripes over suspected obstructions are, along their wall and up it, in meters */
const stripePeriod = 0.12
/** how many milliseconds a frame may spend scanning for obstructions */
const scanBudget = 2
/** how many milliseconds a finished scan waits before it starts over, picking up rooms that mounted and things that moved */
const scanPause = 2000
/**
 * `?show_sticky`: a green tint over every wall face that artworks can hang on, without its openings and reservations, hidden like the wall behind whatever stands in front of it, like its trim.
 * The declared reservations are red, and red stripes mark where something stands out of a sticky wall in the way of hung frames without the wall declaring it, which probably should be a reservation; both show through whatever stands out of their wall.
 */
export default function StickySurfaces() {
  const sticky = useDisposable(useMemo(() => stickySurfaceGeometry(world.placement.walls), []))
  const reserved = useDisposable(useMemo(() => reservationGeometry(world.placement.walls), []))
  const reservedMaterial = useDisposable(useMemo(() => nudgedMaterial(0.55, false), []))
  return <>
    <mesh frustumCulled={false} geometry={sticky} name='sticky-surfaces' raycast={() => {}} renderOrder={1}>
      <meshBasicNodeMaterial color={stickyColor} depthWrite={false} opacity={0.3} toneMapped={false} transparent />
    </mesh>
    <mesh frustumCulled={false} geometry={reserved} material={reservedMaterial} name='sticky-reservations' raycast={() => {}} renderOrder={2} />
    <Obstructions />
  </>
}

/** An unlit overlay drawn toward the camera along each ray, until it stands {@link nudge} meters out of its wall or has travelled {@link furthest}, so it shows exactly where it is, only in front of what stands out of the wall; striped diagonally across its wall, or solid. */
function nudgedMaterial(opacity: number, striped: boolean) {
  const material = new MeshBasicNodeMaterial({
    color: reservedColor,
    depthWrite: false,
    toneMapped: false,
    transparent: true,
  })
  const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
  const toEye = eye.sub(positionLocal)
  const distance = length(toEye)
  const toward = toEye.div(distance)
  // Seen at a slant, it has to travel further along the ray to stand as far out of the wall.
  const along = float(nudge).div(dot(toward, attribute('wallNormal', 'vec3')).max(nudge / furthest))
  material.positionNode = positionLocal.add(toward.mul(along.min(distance.sub(nearest)).max(0)))
  const point = attribute('wallPoint', 'vec2')
  material.opacityNode = striped ? step(0.5, fract(point.x.add(point.y).div(stripePeriod))).mul(opacity) : float(opacity)
  return material
}
/** The stripes over what the {@link WallObstructionScan} finds, scanning a little every frame once the world is ready. */
function Obstructions() {
  const scene = useThree(state => state.scene)
  const scan = useMemo(() => new WallObstructionScan(world.placement.walls, scene), [scene])
  const material = useDisposable(useMemo(() => nudgedMaterial(0.85, true), []))
  const [geometry, setGeometry] = useState<BufferGeometry | null>(null)
  const pass = useRef<Generator<void, void, void>>(null)
  const nextPass = useRef(0)
  const version = useRef(0)
  useEffect(() => () => geometry?.dispose(), [geometry])
  useFrame(() => {
    const now = performance.now()
    if (!useGallery.getState().ready || !pass.current && now < nextPass.current) {
      return
    }
    pass.current ??= scan.pass()
    while (performance.now() < now + scanBudget) {
      if (pass.current.next().done) {
        pass.current = null
        nextPass.current = performance.now() + scanPause
        break
      }
    }
    if (scan.version !== version.current) {
      version.current = scan.version
      setGeometry(patchGeometry(world.placement.walls.filter(wall => scan.patches.get(wall.id)?.length).map(wall => [wall, scan.patches.get(wall.id)!])))
    }
  })
  return geometry && <mesh frustumCulled={false} geometry={geometry} material={material} name='sticky-obstructions' raycast={() => {}} renderOrder={3} />
}
