import type {PortraitSlot} from '#src/lib/gallery/types.ts'
import type {InstancedMesh} from 'three/webgpu'

import {useLayoutEffect, useMemo, useRef} from 'react'
import {Color, Euler, Matrix4, Quaternion, Vector3} from 'three/webgpu'

import {slotIssue, usePortraitSlots} from '#src/lib/gallery/portraitSlotStore.ts'
import {invalidSlotColor, slotBorder, slotColors, slotPanels} from '#src/lib/gallery/portraitSlotVisuals.ts'
import world from '#src/worlds/current.ts'

const aimedColor = '#ffffff'
/** room for slots created while editing before the meshes are rebuilt */
const headroom = 64
/** Whether the slot hangs on a wall of a room in the world’s reach; the others have no wall to show on, though editing keeps them, so dumping the slots still dumps every one. */
const inReach = ({wallId}: PortraitSlot) => world.reach.covers(world.wall(wallId)?.room)
/**
 * What `?show_portrait_slots` shows: every portrait slot of the rooms in the world’s reach and its name plate as tinted panels with solid borders, colored by ratio. While editing, the aimed slot gets a white border, a dragged slot leaves its old place and slots that could not hang where they are turn red.
 */
export default function PortraitSlots() {
  const slots = usePortraitSlots(state => state.slots)
  const aimed = usePortraitSlots(state => state.aimed)
  const dragging = usePortraitSlots(state => state.dragging)
  // The editor draws a dragged slot where it would drop, so it leaves its old place.
  const shown = useMemo(() => slots.filter(slot => slot.id !== dragging && inReach(slot)), [dragging, slots])
  const capacity = Math.ceil((slots.length + headroom) / headroom) * headroom
  return <SlotPanels key={capacity} aimed={aimed} capacity={capacity} slots={shown} />
}

function SlotPanels({aimed, capacity, slots}: {
  aimed: string | null
  capacity: number
  slots: ReadonlyArray<PortraitSlot>
}) {
  const fill = useRef<InstancedMesh>(null)
  const edges = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!fill.current || !edges.current) {
      return
    }
    const frame = new Matrix4
    const part = new Matrix4
    const rotation = new Quaternion
    const unit = new Vector3(1, 1, 1)
    const tint = new Color
    const outline = new Color
    let fills = 0
    let sides = 0
    for (const slot of slots) {
      frame.compose(new Vector3(...slot.position), rotation.setFromEuler(new Euler(0, slot.rotation, 0)), unit)
      tint.set(slotIssue(slot, slots) ? invalidSlotColor : slotColors[slot.ratio])
      outline.set(slot.id === aimed ? aimedColor : tint)
      for (const [x, y, width, height] of slotPanels(slot)) {
        fill.current.setColorAt(fills, tint)
        fill.current.setMatrixAt(fills++, part.makeScale(width, height, 1).setPosition(x, y, 0).premultiply(frame))
        const sideRectangles = [
          [x, y + (height - slotBorder) / 2, width, slotBorder],
          [x, y - (height - slotBorder) / 2, width, slotBorder],
          [x + (width - slotBorder) / 2, y, slotBorder, height],
          [x - (width - slotBorder) / 2, y, slotBorder, height],
        ]
        for (const [sideX, sideY, sideWidth, sideHeight] of sideRectangles) {
          edges.current.setColorAt(sides, outline)
          edges.current.setMatrixAt(sides++, part.makeScale(sideWidth, sideHeight, 1).setPosition(sideX, sideY, 0.005).premultiply(frame))
        }
      }
    }
    fill.current.count = fills
    edges.current.count = sides
    for (const mesh of [fill.current, edges.current]) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true
      }
      mesh.computeBoundingSphere()
    }
  }, [aimed, slots])
  return <>
    <instancedMesh args={[undefined, undefined, capacity * 2]} frustumCulled={false} renderOrder={1} ref={fill}>
      <planeGeometry />
      <meshBasicNodeMaterial depthWrite={false} opacity={0.35} toneMapped={false} transparent />
    </instancedMesh>
    <instancedMesh args={[undefined, undefined, capacity * 8]} frustumCulled={false} ref={edges}>
      <planeGeometry />
      <meshBasicNodeMaterial toneMapped={false} />
    </instancedMesh>
  </>
}
