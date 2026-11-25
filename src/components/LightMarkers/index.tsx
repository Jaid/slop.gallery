import type {Light} from 'three/webgpu'

import {useFrame, useThree} from '@react-three/fiber'
import hsl from 'okhsl'
import {useEffect, useLayoutEffect, useState} from 'react'
import {Color, Vector2, Vector3} from 'three/webgpu'

import {isTextInput, notify} from '#src/lib/gallery.ts'
import overlay from '#src/lib/overlay/index.ts'
import useMarkerBatch, {markerRadius as radius} from '#src/lib/overlay/useMarkerBatch.ts'
import {changeLightDecay, changeLightIntensity, changeLightRange, describeObject, isEditingLamps, isShadowSlot, lightActive, lightShadowOn, moveLight, resetLight, setLightOn, setLightShadow, useLightEdits} from '#src/lib/rendering/lightLevels.ts'
import {shadowPool} from '#src/lib/rendering/shadowPool.ts'

type Positional = Light & {
  isPointLight?: boolean
  isRectAreaLight?: boolean
  isSpotLight?: boolean
}

const layer = overlay.addLayer({id: 'lamps'})
/** the most lights that get a marker */
const capacity = 1024
/** marker radius in meters, larger for the aimed light and larger still for selected ones */
const aimedRadius = 0.2
const selectedRadius = 0.26
/** how far away a light can be aimed at */
const reach = 40
const offColor = new Color(hsl.integer(0, 0, 25))
const position = new Vector3
const origin = new Vector3
const direction = new Vector3
const offset = new Vector3
const color = new Color
const pointer = new Vector2
const forward = new Vector3
const right = new Vector3
const step = new Vector3
const up = new Vector3(0, 1, 0)
/** how far one numpad press moves the selected lights, in meters */
const moveStep = 0.1
/** numpad keys that move the selected lights: along the view’s heading and its right side, flattened to the floor, and straight up */
const moveKeys: Partial<Record<string, readonly [number, number, number]>> = {
  Numpad8: [1, 0, 0],
  Numpad2: [-1, 0, 0],
  Numpad6: [0, 1, 0],
  Numpad4: [0, -1, 0],
  Numpad9: [0, 0, 1],
  Numpad3: [0, 0, -1],
}
/** the lights marked this frame, reused across frames */
const found: Array<Light> = []
/** Lights without a position of their own, like the sun, can name where their marker goes with `userData.marker`, a world position. */
const isMarked = (light: Positional) => Boolean(light.isPointLight || light.isSpotLight || light.isRectAreaLight || light.userData.marker) && !isShadowSlot(light)
const markerPosition = (light: Light, target: Vector3) => {
  const marker = light.userData.marker as [number, number, number] | undefined
  return marker ? target.set(...marker) : target.setFromMatrixPosition(light.matrixWorld)
}
/** The marked light nearest along a ray, within a tolerance that widens with distance, so far lights stay as easy to hit as near ones. */
const pick = (lights: ReadonlyArray<Light>, from: Vector3, toward: Vector3) => {
  let nearest = reach
  let picked: Light | null = null
  for (const light of lights) {
    markerPosition(light, offset).sub(from)
    const along = offset.dot(toward)
    if (!(along > 0.2 && along < nearest && offset.addScaledVector(toward, -along).length() < radius * 1.5 + along * 0.015)) {
      continue
    }
    nearest = along
    picked = light
  }
  return picked
}
/** key that copies every light switched off or made stronger or weaker to the clipboard */
const copyEditsKey = 'KeyK'
const formatPosition = ({x, y, z}: Vector3) => `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`
/** One line per edited light: its name, `off` or its strength factor, its range and decay and its world position, which tells apart lights of the same name. */
const listEdits = () => {
  const {moved, off, reshaped, shadows, strengths} = useLightEdits.getState()
  return [...new Set([...off, ...strengths.keys(), ...reshaped, ...moved, ...shadows.keys()])].map(light => {
    const strength = strengths.get(light) ?? 1
    const level = off.has(light) ? 'off' : `×${strength.toFixed(2)}`
    const {decay, distance} = light as Light & {
      decay?: number
      distance?: number
    }
    const where = `, ${moved.has(light) ? 'moved to' : 'at'} ${formatPosition(light.getWorldPosition(position))}`
    const shadow = shadows.get(light)
    return `${describeObject(light)}: ${level}${distance ? `, range ${distance.toFixed(1)} m` : ''}${decay === undefined ? '' : `, decay ${decay.toFixed(2)}`}${shadow === undefined ? '' : `, shadow ${shadow ? 'on' : 'off'}`}${where}`
  }).join('\n')
}
/** A light’s name, or how many lights there are. */
const describeLights = (lights: ReadonlyArray<Light>) => (lights.length === 1 ? describeObject(lights[0]) : `${lights.length} lights`)
/** Applies an edit to each light and tells the distinct values it left them with, or that none of them can take it. */
const editEach = <Value,>(lights: ReadonlyArray<Light>, edit: (light: Light) => Value | undefined, label: string, format: (value: Value) => string, [one, several]: readonly [string, string]) => {
  const values = new Set<string>
  for (const light of lights) {
    const value = edit(light)
    if (value !== undefined) {
      values.add(format(value))
    }
  }
  notify(values.size ? `${describeLights(lights)}: ${label} ${[...values].join(', ')}` : `${describeLights(lights)} ${lights.length === 1 ? one : several}`)
}
/** Puts the list on the clipboard, telling how many lights it holds. */
const copyEdits = async (list: string) => {
  try {
    await navigator.clipboard.writeText(list)
    notify(`Copied ${list.split('\n').filter(Boolean).length} edited lights`)
  } catch {
    notify('Could not copy; the list is in the console')
  }
}
/**
 * `?show_lamps`: a glowing, dark-rimmed dot in the color of every point, spot and area light and every light with a `userData.marker`, seen through walls, dark gray for lights switched off. With
 * `?edit_lamps`, the light the camera aims at grows: E switches it off and on, Numpad / switches its shadow on and off, ←/→ make it weaker or stronger by one unit of intensity and ↓/↑ shorten or extend its range by 1 m and Numpad 7/1 make it fade faster or more gently, for the rest of the page session.
 * Left-clicking a marker selects its light, which then takes these keys wherever the camera aims, until a click on another marker or anything else; Shift+clicking a marker adds its light to the selection or takes it out, so the keys change every selected light at once. Selected lights shine wherever the player is, even outside the rooms that light them.
 * Numpad 8, 2, 4 and 6 move the selected lights forward, back, left and right of the view, 9 and 3 up and down, 5 centers them on the camera, 0 undoes all their edits, and K copies every edit.
 */
export default function LightMarkers() {
  const camera = useThree(state => state.camera)
  const scene = useThree(state => state.scene)
  const canvas = useThree(state => state.renderer.domElement)
  const markers = useMarkerBatch(layer, capacity)
  const [ranges] = useState(() => new Map<Light, ReturnType<typeof overlay.addSphere>>)
  useLayoutEffect(() => () => {
    for (const sphere of ranges.values()) {
      sphere.remove()
    }
    ranges.clear()
  }, [ranges])
  useFrame(() => {
    found.length = 0
    scene.traverseVisible(object => {
      if ((object as Light).isLight && isMarked(object as Positional) && found.length < capacity) {
        found.push(object as Light)
      }
    })
    let aimed: Light | null = null
    if (isEditingLamps) {
      camera.getWorldPosition(origin)
      camera.getWorldDirection(direction)
      aimed = pick(found, origin, direction)
      if (aimed !== useLightEdits.getState().aimed) {
        useLightEdits.setState({aimed})
      }
    }
    const batch = markers.current
    if (!batch?.parent) {
      return
    }
    const {off, selected} = useLightEdits.getState()
    for (const [index, light] of found.entries()) {
      const isSelected = selected.has(light)
      const size = isSelected ? selectedRadius : (light === aimed ? aimedRadius : radius)
      markerPosition(light, position)
      batch.setMarker(index, position, size, off.has(light) ? offColor : color.copy(light.color).multiplyScalar(light === aimed || isSelected ? 3 : 1.5), !lightActive.current(light), light.castShadow || shadowPool.isLent(light) ? 'square' : 'circle')
    }
    batch.show(found.length)
    for (const [light, sphere] of ranges) {
      if (selected.has(light)) {
        continue
      }
      sphere.remove()
      ranges.delete(light)
    }
    for (const light of selected) {
      const {distance} = light as Light & {distance?: number}
      const sphere = ranges.get(light)
      // Zero is an unlimited reach; directional and area lights have no spherical cutoff either.
      if (distance === undefined || !(distance > 0 && Number.isFinite(distance))) {
        sphere?.remove()
        ranges.delete(light)
        continue
      }
      const center = markerPosition(light, position).toArray()
      if (sphere) {
        sphere.setBounds(center, distance)
      } else {
        ranges.set(light, overlay.addSphere(center, distance, {
          layer,
          name: `${light.name}-range`,
          renderOrder: -1,
        }))
      }
    }
  }, {
    before: 'render',
    after: 'light-levels',
  })
  useEffect(() => {
    if (!isEditingLamps) {
      return
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.code === copyEditsKey && !event.repeat && !isTextInput(event.target)) {
        const list = listEdits()
        console.info(list)
        copyEdits(list).catch(console.error)
        return
      }
      const {aimed: looked, selected} = useLightEdits.getState()
      if (event.ctrlKey || event.metaKey || event.altKey || isTextInput(event.target)) {
        return
      }
      const move = moveKeys[event.code]
      // Lights placed by a marker, like the sun, have no position of their own to move, but can still be reset.
      const movable = [...selected].filter(light => !light.userData.marker)
      if (event.code === 'Numpad0' ? selected.size : (move || event.code === 'Numpad5') && movable.length) {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.code === 'Numpad0') {
          const lights = [...selected]
          const at = lights.map(light => resetLight(light))
          notify(`${describeLights(lights)}: reset${lights.length === 1 ? `, at ${formatPosition(at[0])}` : ''}`)
          return
        }
        if (move) {
          camera.getWorldDirection(forward).setY(0).normalize()
          right.crossVectors(forward, up)
          step.set(0, 0, 0).addScaledVector(forward, move[0]).addScaledVector(right, move[1]).addScaledVector(up, move[2]).multiplyScalar(moveStep)
        } else {
          // The selection keeps its shape, with its center put at the camera.
          step.set(0, 0, 0)
          for (const light of movable) {
            step.add(light.getWorldPosition(position))
          }
          step.divideScalar(-movable.length).add(camera.getWorldPosition(origin))
        }
        const at = movable.map(light => moveLight(light, step))
        notify(movable.length === 1 ? `${describeObject(movable[0])}: at ${formatPosition(at[0])}` : `${describeLights(movable)}: moved`)
        return
      }
      const lights = selected.size ? [...selected] : (looked ? [looked] : [])
      if (!lights.length) {
        return
      }
      const actions: Partial<Record<string, () => void>> = {
        KeyE: () => {
          if (event.repeat) {
            return
          }
          // Mixed lights all come on, so a second press switches them all off.
          const {off} = useLightEdits.getState()
          const on = lights.some(light => off.has(light))
          for (const light of lights) {
            setLightOn(light, on)
          }
          notify(`${describeLights(lights)} ${on ? 'on' : 'off'}`)
        },
        NumpadDivide: () => {
          if (event.repeat) {
            return
          }
          const casters = lights.filter(light => lightShadowOn(light) !== undefined)
          if (!casters.length) {
            notify(`${describeLights(lights)} can’t cast ${lights.length === 1 ? 'a shadow' : 'shadows'}`)
            return
          }
          const on = !casters.every(light => lightShadowOn(light))
          for (const light of casters) {
            setLightShadow(light, on)
          }
          notify(`${describeLights(casters)}: shadow ${on ? 'on' : 'off'}`)
        },
        ArrowLeft: () => editEach(lights, light => changeLightIntensity(light, -1), 'intensity', String, ['is dark', 'are dark']),
        ArrowRight: () => editEach(lights, light => changeLightIntensity(light, 1), 'intensity', String, ['is dark', 'are dark']),
        ArrowDown: () => editEach(lights, light => changeLightRange(light, -1), 'range', distance => `${distance.toFixed(1)} m`, ['has no range', 'have no range']),
        ArrowUp: () => editEach(lights, light => changeLightRange(light, 1), 'range', distance => `${distance.toFixed(1)} m`, ['has no range', 'have no range']),
        Numpad7: () => editEach(lights, light => changeLightDecay(light, 1), 'decay', decay => decay.toFixed(2), ['has no decay', 'have no decay']),
        Numpad1: () => editEach(lights, light => changeLightDecay(light, -1), 'decay', decay => decay.toFixed(2), ['has no decay', 'have no decay']),
      }
      const action = actions[event.code]
      if (!action) {
        return
      }
      // Aimed at or with lights selected, these keys belong to the editor instead of the game.
      event.preventDefault()
      event.stopImmediatePropagation()
      action()
    }
    // With the pointer locked, a click picks what the camera aims at; otherwise what is under the pointer.
    const mousedown = (event: MouseEvent) => {
      if (event.button !== 0 || !document.pointerLockElement && event.target !== canvas) {
        return
      }
      let clicked = useLightEdits.getState().aimed
      if (!document.pointerLockElement) {
        const bounds = canvas.getBoundingClientRect()
        pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
        camera.getWorldPosition(origin)
        direction.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(origin).normalize()
        clicked = pick(found, origin, direction)
      }
      const {selected} = useLightEdits.getState()
      if (event.shiftKey) {
        // Shift+clicking a marker adds its light to the selection or takes it out; a Shift+click elsewhere leaves the selection be.
        if (!clicked) {
          return
        }
        const next = new Set(selected)
        const added = !next.delete(clicked)
        if (added) {
          next.add(clicked)
        }
        useLightEdits.setState({selected: next})
        notify(`${added ? 'Selected' : 'Deselected'} ${describeObject(clicked)}${next.size > 1 ? `, ${next.size} lights selected` : ''}`)
      } else {
        if (clicked ? selected.size === 1 && selected.has(clicked) : !selected.size) {
          return
        }
        useLightEdits.setState({selected: new Set(clicked ? [clicked] : [])})
        notify(clicked ? `Selected ${describeObject(clicked)}` : `Deselected ${describeLights([...selected])}`)
      }
      // A click on a marker belongs to the editor; a click elsewhere only deselects on its way to the game.
      if (clicked) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    globalThis.addEventListener('keydown', keydown, {capture: true})
    globalThis.addEventListener('mousedown', mousedown, {capture: true})
    return () => {
      globalThis.removeEventListener('keydown', keydown, {capture: true})
      globalThis.removeEventListener('mousedown', mousedown, {capture: true})
      useLightEdits.setState({
        aimed: null,
        selected: new Set,
      })
    }
  }, [camera, canvas])
  return null
}
