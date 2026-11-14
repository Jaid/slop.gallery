import type PortraitFrame from '#src/frames/base/PortraitFrame.ts'
import type {Portrait} from '#src/lib/gallery.ts'
import type {ComponentProps, ComponentRef} from 'react'
import type {WebgpuRendererOptions} from 'three-fiber-game'

import {OrbitControls} from '@react-three/drei/webgpu'
import {Canvas, useStore, useThree} from '@react-three/fiber'
import clsx from 'clsx'
import useDisposable from 'disposable-lifetime/react'
import {useLayoutEffect, useMemo, useRef} from 'react'
import {WebgpuRenderer} from 'three-fiber-game'
import {PerspectiveCamera} from 'three/webgpu'

import DynamicImageMaterial from '#component/DynamicImageMaterial'
import Icon from '#component/Icon'
import {frameBack} from '#src/frames/base/PortraitFrame.ts'
import {portraitFrame} from '#src/frames/index.ts'
import frameStudio from '#src/frames/lib/materials/frameStudio.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {portraitRoomTitle} from '#src/lib/gallery/portraitRoom.ts'
import {useZoomIndependentDpr} from '#src/lib/rendering/scale.ts'

import css from './style.module.sass'

export type PortraitSpectationProps = {
  onClose: () => void
  portrait: Portrait
}

const spectationFov = 38
const startAzimuth = 0.32
const startElevation = 0.14
const framingPadding = 1.25
const createStudioRenderer = (options: WebgpuRendererOptions) => {
  const renderer = new WebgpuRenderer({
    ...options,
    alpha: true,
    antialias: true,
  })
  renderer.setClearColor(0, 0)
  return renderer
}

/**
 * Inspects one work from the pause menu across the map and main columns: a studio 3D view of the framed portrait with orbital controls above, and its title, flavor text, creator, year and current room below.
 * Works the player hasn’t interacted with yet render with reduced opacity on the 3D canvas.
 */
export default function PortraitSpectation({onClose, portrait}: PortraitSpectationProps) {
  const dpr = useZoomIndependentDpr(1)
  const held = useGallery(state => state.held)
  const playerRoom = useGallery(state => state.room)
  const visited = Boolean(portrait.interacted)
  const room = portraitRoomTitle(portrait, held, playerRoom)
  return <section className={css.container} aria-label={portrait.title} data-interacted={visited} data-portrait={portrait.id} data-testid='portrait-spectation'>
    <div className={css.stage}>
      <div className={clsx(css.canvas, !visited && css.unvisited)} data-testid='portrait-spectation-canvas'>
        <Canvas
          camera={{
            fov: spectationFov,
            position: [0, 0, 2],
          }} dpr={dpr} renderer={createStudioRenderer as ComponentProps<typeof Canvas>['renderer']} share={false}
        >
          <SpectatedPortrait portrait={portrait} />
        </Canvas>
      </div>
      <button className={css.close} aria-label='Close portrait view' type='button' onClick={onClose}>
        <Icon name='close' size={18} />
      </button>
      <p className={css.hint}>Drag to orbit · Scroll to zoom</p>
    </div>
    <div className={css.details}>
      <h2 className={css.title}>{portrait.title}</h2>
      <p className={css.description}>{portrait.description}</p>
      <div className={css.meta}>
        <p className={css.byline}><span>{portrait.creator}</span><span aria-hidden='true'> · </span><span>{portrait.year ?? 'Undated'}</span></p>
        <p className={css.room} data-testid='portrait-spectation-room'><span className={css.roomLabel}>Current room: </span><span className={css.roomValue}>{room}</span></p>
      </div>
    </div>
  </section>
}

function spectationDistance(width: number, height: number, frame: PortraitFrame, aspect: number) {
  const totalWidth = width + frame.reach * 2
  const totalHeight = height + frame.reach * 2
  const halfHeight = totalHeight / 2 * framingPadding
  const projectedWidth = totalWidth * Math.cos(startAzimuth) + frame.depth * Math.sin(startAzimuth)
  const halfWidth = projectedWidth / 2 * framingPadding
  const slope = Math.tan(spectationFov * Math.PI / 360)
  return Math.max(halfHeight / slope, halfWidth / (slope * Math.max(0.4, aspect))) + Math.hypot(totalWidth, frame.depth) / 2
}
function SpectatedPortrait({portrait}: {portrait: Portrait}) {
  const store = useStore()
  const size = useThree(state => state.size)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const aspect = size.width / Math.max(1, size.height)
  const aspectRef = useRef(aspect)
  useLayoutEffect(() => {
    aspectRef.current = aspect
  }, [aspect])
  const frame = portraitFrame(portrait.frame)
  const geometry = useDisposable(useMemo(() => frame.createGeometry(portrait.width, portrait.height), [frame, portrait.width, portrait.height]))
  const centerZ = (frameBack + frame.front) / 2
  const distance = spectationDistance(portrait.width, portrait.height, frame, aspect)
  useLayoutEffect(() => {
    const {camera} = store.getState()
    const startDistance = spectationDistance(portrait.width, portrait.height, frame, aspectRef.current)
    const radius = Math.hypot(portrait.width + frame.reach * 2, portrait.height + frame.reach * 2, frame.depth) / 2
    camera.position.set(
      startDistance * Math.sin(startAzimuth) * Math.cos(startElevation),
      startDistance * Math.sin(startElevation),
      startDistance * Math.cos(startAzimuth) * Math.cos(startElevation),
    )
    if (camera instanceof PerspectiveCamera) {
      camera.near = Math.max(0.01, (startDistance - radius * 2) / 4)
      camera.far = startDistance * 6 + radius * 4
      camera.updateProjectionMatrix()
    }
    controls.current?.target.set(0, 0, 0)
    controls.current?.update()
  }, [frame, portrait.height, portrait.id, portrait.width, store])
  return <>
    <primitive attach='environment' object={frameStudio} />
    <ambientLight color='#ffffff' intensity={0.45} />
    <hemisphereLight args={['#e1edff', '#80705d', 1.3]} />
    <directionalLight color='#fff0d7' intensity={2.1} position={[2.2, 3.2, 4.5]} />
    <directionalLight color='#dce8ff' intensity={1.1} position={[-2.5, 1.5, -4]} />
    <group position={[0, 0, -centerZ]}>
      <mesh geometry={geometry} material={frame.materials} name='portrait-frame' />
      <mesh name='portrait-image' position={[0, 0, frame.imageDepth]}>
        <planeGeometry args={[portrait.width, portrait.height]} />
        <DynamicImageMaterial source={portrait.source} toneMapped={false} />
      </mesh>
    </group>
    <OrbitControls dampingFactor={0.08} enableDamping enablePan={false} makeDefault maxDistance={distance * 3} maxPolarAngle={Math.PI - 0.05} minDistance={distance * 0.35} minPolarAngle={0.05} ref={controls} />
  </>
}
