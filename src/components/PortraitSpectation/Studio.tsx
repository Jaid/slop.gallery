import type {Portrait} from '#src/lib/gallery.ts'
import type {OrbitControls as OrbitControlsImpl} from 'three/addons/controls/OrbitControls.js'

import {OrbitControls} from '@react-three/drei/webgpu'
import {useThree} from '@react-three/fiber'
import useDisposable from 'disposable-lifetime/react'
import {useLayoutEffect, useMemo, useRef} from 'react'
import {PerspectiveCamera, Vector3} from 'three/webgpu'

import DynamicImageMaterial from '#component/DynamicImageMaterial'
import {frameBack} from '#src/frames/base/PortraitFrame.ts'
import {portraitFrame} from '#src/frames/index.ts'

/** the direction from the work to the camera it starts from: a three-quarter view from the front (+z), 32° to the right and 17° from above, like the studio snapshots’ */
const viewDirection = new Vector3(Math.sin(0.56) * Math.cos(0.3), Math.sin(0.3), Math.cos(0.56) * Math.cos(0.3))

/** The radius of the sphere around a framed work of these extents, in meters, which every angle of the orbit has to leave in view. */
export function spectationRadius(width: number, height: number, depth: number) {
  return Math.hypot(width, height, depth) / 2
}

/** How far from its middle a camera of the vertical field of view `fov`, in degrees, `aspect` times as wide as it is high, stands for a sphere of `radius` meters around the work to fill its view along the tighter of its sides. */
export function spectationDistance(radius: number, fov: number, aspect: number) {
  const vertical = fov * Math.PI / 180
  const horizontal = aspect > 0 && Number.isFinite(aspect) ? 2 * Math.atan(Math.tan(vertical / 2) * aspect) : vertical
  return radius / Math.sin(Math.min(vertical, horizontal) / 2)
}
/**
 * The contents of the spectation view’s own canvas: the work alone in a generic studio, lit from no visible source like the Knots’ lobby, with the camera orbiting it where the player drags.
 * `view` only tells apart one framing of the work from the next: the camera starts over whenever it or the work changes.
 */
export default function SpectationStudio({portrait, view}: {
  portrait: Portrait
  view: number
}) {
  return <>
    <StudioLighting />
    <PortraitModel portrait={portrait} />
    <CameraRig key={`${portrait.id}:${view}`} portrait={portrait} />
  </>
}

/** Puts the camera where it starts: a three-quarter view of the whole sphere of `radius` meters around the work’s middle at the depth `centerZ`, in a view `aspect` times as wide as it is high, with its clipping planes around that sphere. */
function frameCamera(camera: PerspectiveCamera, centerZ: number, radius: number, aspect: number) {
  // A breath of margin past the sphere the work turns in, so its corners stay off the canvas’ edges.
  const distance = spectationDistance(radius, camera.fov, aspect) * 1.04
  camera.position.set(0, 0, centerZ).addScaledVector(viewDirection, distance)
  camera.near = Math.max(0.01, radius * 0.02)
  camera.far = radius * 40
  camera.lookAt(0, 0, centerZ)
  camera.updateProjectionMatrix()
}
/** The studio’s lights, with a fill behind the work so its back, turned toward the camera, is lit too. What its surfaces mirror is set where the canvas is created. */
function StudioLighting() {
  return <>
    <ambientLight intensity={0.45} />
    <hemisphereLight color='#e1edff' groundColor='#80705d' intensity={1.3} />
    <directionalLight color='#fff0d7' intensity={2.3} position={[-3, 9, 16]} />
    <directionalLight color='#dfe9ff' intensity={1.1} position={[3, 4, -16]} />
  </>
}
/** The work itself, upright in its own frame at the studio’s middle, without its body, its placard or its wall. */
function PortraitModel({portrait: p}: {portrait: Portrait}) {
  const frame = portraitFrame(p.frame)
  const geometry = useDisposable(useMemo(() => frame.createGeometry(p.width, p.height), [frame, p.height, p.width]))
  return <group name='portrait-spectation-model'>
    <mesh geometry={geometry} material={frame.materials} name='portrait-frame' />
    <mesh name='portrait-image' position={[0, 0, frame.imageDepth]}><planeGeometry args={[p.width, p.height]} /><DynamicImageMaterial source={p.source} toneMapped={false} /></mesh>
  </group>
}
/** The orbiting camera: framed on the whole work from a three-quarter view at first, then the player’s to drag around it and scroll in and out, never panning it out of sight. */
function CameraRig({portrait: p}: {portrait: Portrait}) {
  const camera = useThree(state => state.camera)
  const size = useThree(state => state.size)
  const controls = useRef<OrbitControlsImpl>(null)
  const fitted = useRef(false)
  const frame = portraitFrame(p.frame)
  const radius = spectationRadius(p.width + frame.reach * 2, p.height + frame.reach * 2, frame.depth)
  const centerZ = frameBack + frame.depth / 2
  useLayoutEffect(() => {
    if (fitted.current || !(camera instanceof PerspectiveCamera) || !size.width || !size.height) {
      return
    }
    fitted.current = true
    frameCamera(camera, centerZ, radius, size.width / size.height)
    const orbit = controls.current
    if (orbit) {
      orbit.target.set(0, 0, centerZ)
      orbit.update()
    }
  }, [camera, centerZ, radius, size])
  return <OrbitControls dampingFactor={0.08} enableDamping enablePan={false} makeDefault maxDistance={radius * 6} minDistance={radius * 0.6} rotateSpeed={0.85} zoomSpeed={0.8} ref={controls} />
}
