import type {KnotBay} from 'knot-materials/exhibition.ts'

import {RigidBody} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {knotBays} from 'knot-materials/exhibition.ts'
import {knotBillboardPhysics} from 'knot-materials/knotBillboardPhysics.ts'
import {knotPreviewMountY, knotPreviewPanelOffsetY, knotPreviewTextureLayout} from 'knot-materials/KnotPreviewLayout.ts'
import loadKnotMaterial from 'knot-materials/materials.ts'
import hsl from 'okhsl'
import {useMemo} from 'react'
import {MeshBasicNodeMaterial} from 'three/webgpu'

import InteractiveObject from '#component/InteractiveObject'
import Stand, {Sign} from '#component/KnotBillboardSupport'
import KnotPreviewFace, {knotPreviewBackground} from '#component/KnotPreviewFace'
import {narrate} from '#src/lib/gallery/actions.ts'
import {fitCanvasTextureResolution, graphicsProfile, isHeavy} from '#src/lib/rendering/graphicsMode.ts'
import useLoadingElementTexture from '#src/lib/useLoadingElementTexture.ts'

import RuntimeKnotIconRenderer, {releaseCanvases} from './RuntimeKnotIconRenderer.ts'

const {canvasTextureMipmaps: mipmaps, canvasTextureResolution: resolution} = graphicsProfile

/** One billboard at the west end of every row, sharing one detached renderer for their Knot screenshots. */
export default function KnotPreviewSigns({x}: {
  /** where the billboards stand, relative to their row centers */
  x: number
}) {
  const renderer = useDisposable(useMemo(() => new RuntimeKnotIconRenderer(loadKnotMaterial, isHeavy), []))
  return knotBays.map(bay => <group key={bay.candidate.id} position={bay.center}><KnotPreviewSign bay={bay} renderer={renderer} x={x} /></group>)
}

/** Runtime billboard composed into one texture per candidate; no combined texture is persisted. */
function KnotPreviewSign({bay, renderer, x}: {
  bay: KnotBay
  renderer: RuntimeKnotIconRenderer
  /** where the billboard stands, relative to the row center */
  x: number
}) {
  const layout = knotPreviewTextureLayout(bay.finishes.length)
  const texture = useLoadingElementTexture(`billboard-texture:${bay.candidate.id}`, useMemo(() => ({
    width: layout.width,
    height: layout.height,
    resolution: fitCanvasTextureResolution(resolution, layout.width, layout.height),
    name: `Knot preview: ${bay.candidate.title}`,
    mipmaps,
    prepare: (signal: AbortSignal) => renderer.render(bay.finishes, signal),
    disposeInputs: releaseCanvases,
    render: (images: ReadonlyMap<string, HTMLCanvasElement>) => <KnotPreviewFace bay={bay} images={images} />,
  }), [bay, layout.height, layout.width, renderer]))
  const face = useDisposable(useMemo(() => new MeshBasicNodeMaterial({
    color: texture ? hsl.integer(0, 0, 100) : knotPreviewBackground,
    map: texture,
    toneMapped: false,
  }), [texture]))
  return <InteractiveObject id={`preview-${bay.candidate.id}`} action='Listen' name={`preview-${bay.candidate.id}`} position={[x, knotPreviewMountY, 0]} rotation={[0, Math.PI / 2, 0]} title={`${bay.candidate.title} billboard`} onActivate={() => narrate(`preview-${bay.candidate.id}`)}>
    <RigidBody additionalSolverIterations={knotBillboardPhysics.solverIterations} angularDamping={knotBillboardPhysics.stand.angularDamping} ccd colliders={false} linearDamping={knotBillboardPhysics.stand.linearDamping} name='billboard-stand'>
      <Stand />
    </RigidBody>
    <RigidBody additionalSolverIterations={knotBillboardPhysics.solverIterations} angularDamping={knotBillboardPhysics.sign.angularDamping} ccd colliders={false} linearDamping={knotBillboardPhysics.sign.linearDamping} name='billboard-sign' position={[0, knotPreviewPanelOffsetY, knotBillboardPhysics.sign.standGap]}>
      <Sign face={face} />
    </RigidBody>
  </InteractiveObject>
}
