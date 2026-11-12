import type {SnapshotSubject} from '#src/components/Scene/GrabbableProp.tsx'
import type {KnotLabel} from './layout.ts'
import type {Rarity} from 'knot-materials'
import type {Vec3} from 'math'
import type {Material, Node, Texture} from 'three/webgpu'

import {useFrame} from '@react-three/fiber'
import {CuboidCollider, CylinderCollider} from '@react-three/rapier'
import useDisposable from 'disposable-lifetime/react'
import {knotSign, knotSignId, knotSignParts, knotSignRoundParts} from 'knot-materials/signs.ts'
import {useEffect, useMemo, useRef} from 'react'
import {attribute, texture, uv, vec2} from 'three/tsl'
import {Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshBasicNodeMaterial, PlaneGeometry} from 'three/webgpu'
import useGraphicsMode, {useGraphicsModeValue} from 'use-graphics-mode'

import InteractiveObject from '#component/InteractiveObject'
import KnotLabelFace, {KnotLabelFaces} from '#component/KnotLabelFace'
import GrabbableProp, {propObjects} from '#src/components/Scene/GrabbableProp.tsx'
import metal from '#src/lib/materials/metal.ts'
import InstancedPropVisuals from '#src/lib/physics/InstancedPropVisuals.ts'
import {fitCanvasTextureResolution, getGraphicsProfile} from '#src/lib/rendering/graphicsMode.ts'
import useLoadingElementTexture, {rasterizeFace} from '#src/lib/useLoadingElementTexture.ts'

import {labelAtlasColumns, labelBackground, labelHeight, labelWidth} from './layout.ts'
import redrawPlates from './redrawPlates.ts'
import createSupportGeometry from './supportGeometry.ts'

/** a nameplate on its stand: `position` is its plaque’s center, `knotSign.elevation` over the floor its stand rests on, and `rotation` turns it around the vertical */
export type KnotSignPlacement = {
  entry: KnotLabel
  position: Vec3
  rotation: number
}

/**
 * The Knots’ nameplates: one complete face atlas and two instanced batches, faces and physical supports. Each nameplate is a prop of its own, which E activates.
 * `ratings` overrides the stars of the Knots it holds, like Knottingham’s live edits. `signs` must keep its identity while it stays the same, since a new one draws every face anew.
 */
export default function KnotLabels({signs, ratings, action = 'Listen', onActivate}: {
  action?: string
  onActivate: (entry: KnotSignPlacement['entry']) => void
  ratings?: ReadonlyMap<string, Rarity>
  signs: ReadonlyArray<KnotSignPlacement>
}) {
  const isHeavy = useGraphicsMode()
  const {canvasTextureMipmaps: mipmaps, canvasTextureResolution: resolution} = useGraphicsModeValue(getGraphicsProfile)
  const atlasRows = Math.ceil(signs.length / labelAtlasColumns)
  // Only the flat fallback is owned here; the reflective steel is shared for the page lifetime.
  const flatSupportMaterial = useDisposable(useMemo(() => new MeshBasicNodeMaterial({color: '#9ca6ad'}), []))
  const supportMaterial = isHeavy ? metal : flatSupportMaterial
  const resources = useDisposable(useMemo(() => {
    const offsets = new Float32Array(signs.length * 2)
    for (let index = 0; index < signs.length; index++) {
      offsets[index * 2] = index % labelAtlasColumns / labelAtlasColumns
      offsets[index * 2 + 1] = 1 - (Math.floor(index / labelAtlasColumns) + 1) / atlasRows
    }
    const geometry = new PlaneGeometry(knotSign.width, knotSign.height)
    // Separate the only face from its metal backing, not from other face layers.
    geometry.translate(0, 0, 0.0005)
    geometry.rotateX(knotSign.tilt)
    // The face of a single nameplate, for studio snapshots, without the batch’s per-instance atlas offsets.
    const plate = geometry.clone()
    geometry.setAttribute('labelOffset', new InstancedBufferAttribute(offsets, 2))
    const faceMaterial = () => {
      const face = new MeshBasicNodeMaterial({color: labelBackground})
      face.name = 'Knot nameplate material'
      face.toneMapped = false
      face.polygonOffset = true
      face.polygonOffsetFactor = -1
      face.polygonOffsetUnits = -1
      return face
    }
    /** the face color sampled from `atlas`, with each face’s tile at `offset` */
    const atlasColor = (atlas: Texture, offset: Node<'vec2'>) => texture(atlas, uv().mul(vec2(1 / labelAtlasColumns, 1 / atlasRows)).add(offset))
    const material = faceMaterial()
    const faces = new InstancedMesh(geometry, material, signs.length)
    faces.name = 'knot-nameplates'
    const supports = new InstancedMesh(createSupportGeometry(), [], signs.length)
    supports.name = 'knot-nameplate-supports'
    supports.castShadow = true
    supports.receiveShadow = true
    const meshes = [faces, supports]
    const matrix = new Matrix4
    for (const [index, sign] of signs.entries()) {
      matrix.makeRotationY(sign.rotation)
      matrix.setPosition(...sign.position)
      for (const mesh of meshes) {
        mesh.setMatrixAt(index, matrix)
      }
    }
    for (const mesh of meshes) {
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingBox()
      mesh.computeBoundingSphere()
    }
    return {
      faces,
      supports,
      setAtlas(atlas: Texture | null) {
        material.colorNode = atlas ? atlasColor(atlas, attribute('labelOffset', 'vec2')) : null
        material.needsUpdate = true
      },
      /** the nameplate of the sign at `index` alone, plaque and stand, as the instanced batches draw it with `atlas` and `stand` */
      snapshotSubject(index: number, atlas: Texture | null, stand: Material): SnapshotSubject {
        const face = faceMaterial()
        if (atlas) {
          face.colorNode = atlasColor(atlas, vec2(offsets[index * 2], offsets[index * 2 + 1]))
        }
        const object = new Group
        object.add(new Mesh(plate, face), new Mesh(supports.geometry, stand))
        return {
          object,
          dispose: () => face.dispose(),
        }
      },
      visuals: new InstancedPropVisuals(meshes, signs.map(sign => knotSignId(sign.entry.id))),
      dispose() {
        for (const mesh of meshes) {
          mesh.dispose()
          mesh.geometry.dispose()
        }
        plate.dispose()
        material.dispose()
      },
    }
  }, [atlasRows, signs]))
  const atlasResolution = fitCanvasTextureResolution(resolution, labelAtlasColumns * labelWidth, atlasRows * labelHeight)
  const atlas = useLoadingElementTexture('knot-sign-texture', useMemo(() => ({
    width: labelAtlasColumns * labelWidth,
    height: atlasRows * labelHeight,
    resolution: atlasResolution,
    name: 'Knot nameplate atlas',
    mipmaps,
    render: () => <KnotLabelFaces exhibits={signs.map(sign => sign.entry)} />,
  }), [atlasResolution, atlasRows, mipmaps, signs]))
  useEffect(() => {
    resources.setAtlas(atlas)
  }, [resources, atlas])
  /** the rarities the atlas shows, which only differ from the entries’ own after live edits */
  const shown = useRef<{
    atlas: typeof atlas
    ratings: Map<string, Rarity>
  }>(null)
  useEffect(() => {
    if (!atlas || !ratings) {
      return
    }
    if (shown.current?.atlas !== atlas) {
      shown.current = {
        atlas,
        ratings: new Map(signs.map(({entry}) => [entry.id, entry.rarity])),
      }
    }
    const controller = new AbortController
    const rasterize = (exhibit: KnotLabel) => rasterizeFace(<KnotLabelFace exhibit={exhibit} />, {
      width: labelWidth,
      height: labelHeight,
      resolution: atlasResolution,
    }, controller.signal)
    void redrawPlates(atlas, signs.map(sign => sign.entry), ratings, shown.current.ratings, rasterize).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        console.error('Knot nameplate could not be redrawn.', error)
      }
    })
    return () => controller.abort()
  }, [atlas, atlasResolution, ratings, signs])
  useFrame(() => resources.visuals.update(id => propObjects.get(id)?.group))
  return <>
    <primitive object={resources.faces} />
    <primitive object={resources.supports}><primitive attach='material' object={supportMaterial} /></primitive>
    {signs.map(({entry, position, rotation}, signIndex) => <GrabbableProp key={entry.id} id={knotSignId(entry.id)} angularDamping={0.15} colliders={false} friction={0.9} linearDamping={0.1} position={position} restitution={0.1} rotation={[0, rotation, 0]} snapshotSubject={() => resources.snapshotSubject(signIndex, atlas, supportMaterial)} title={`${entry.title} · nameplate`} type='dynamic'>
      {/* Raycast-only copy; visible geometry remains instanced. */}
      <InteractiveObject id={knotSignId(entry.id)} action={action} title={`${entry.title} nameplate`} onActivate={() => onActivate(entry)}>
        <mesh dispose={null} geometry={resources.supports.geometry} material={supportMaterial} visible={false} />
      </InteractiveObject>
      {knotSignParts.map(({position: partPosition, rotation: partRotation, size}, index) => <CuboidCollider key={index} args={[size[0] / 2, size[1] / 2, size[2] / 2]} mass={knotSign.plateMass} position={partPosition} rotation={partRotation} />)}
      {knotSignRoundParts.map(({position: partPosition, rotation: partRotation, radius, height: partHeight, mass}, index) => <CylinderCollider key={index} args={[partHeight / 2, radius]} mass={mass} position={partPosition} rotation={partRotation} />)}
    </GrabbableProp>)}
  </>
}
