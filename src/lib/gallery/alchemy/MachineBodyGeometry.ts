import type {BufferGeometry} from 'three/webgpu'

import {CircleGeometry, CylinderGeometry, SphereGeometry, TorusGeometry} from 'three/webgpu'

import {mergeParts} from '../../geometry.ts'
import {place, roundedBox} from '../lodgeInterior/place.ts'
import {alchemyPipe, alchemySink, machineBody} from './alchemyMachine.ts'

/** how far the plinth band round its foot and the lid’s band round its top stand out of its sides, and how tall either is */
const band = [0.018, 0.045] as const
/** the radius of the round window in its front, inside the brass bezel round it */
const windowRadius = 0.16
/** how far apart the rivets along its bands stand at most */
const rivetPitch = 0.075
const rivetRadius = 0.007

/**
 * The body of the alchemy machine, see {@link machineBody}, in its own frame on the floor under its middle, its front toward the room, along −z: an iron chest with riveted bands, a collar round its side intake, a flange where its pipe leaves its back, four squat feet and a round window in its front behind a brass bezel.
 * The window’s `glass` is a disc of its own, which glows while the machine works on an orb.
 */
export default class MachineBodyGeometry {
  readonly brass: BufferGeometry
  readonly glass: BufferGeometry
  readonly iron: BufferGeometry

  constructor() {
    const [width, height, depth] = machineBody.size
    const [out, tall] = band
    const feet = 0.025
    const chest = height - feet
    const iron: Array<BufferGeometry> = [
      place(roundedBox([width, chest, depth], 0.02), 0, feet + chest / 2, 0),
      place(roundedBox([width + out * 2, tall, depth + out * 2], 0.008, 2), 0, feet + tall / 2, 0),
      place(roundedBox([width + out * 2, tall, depth + out * 2], 0.008, 2), 0, height - tall / 2, 0),
    ]
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        iron.push(place(new CylinderGeometry(0.035, 0.045, feet, 16), x * (width / 2 - 0.04), feet / 2, z * (depth / 2 - 0.04)))
      }
    }
    // Rivets round both bands, on all four sides
    for (const y of [feet + tall / 2, height - tall / 2]) {
      for (const [length, along, face] of [[width, 'x', depth / 2 + out], [depth, 'z', width / 2 + out]] as const) {
        const count = Math.floor(length / rivetPitch)
        for (let index = 0; index <= count; index++) {
          const at = -length / 2 + 0.03 + (length - 0.06) * index / count
          for (const side of [-1, 1]) {
            const rivet = new SphereGeometry(rivetRadius, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2)
            rivet.rotateX(along === 'x' ? side * Math.PI / 2 : 0).rotateZ(along === 'z' ? -side * Math.PI / 2 : 0)
            iron.push(along === 'x' ? place(rivet, at, y, side * face) : place(rivet, side * face, y, at))
          }
        }
      }
    }
    this.iron = mergeParts(iron)
    const throat = alchemySink.throat + alchemySink.thickness
    const pipe = alchemyPipe.radius
    const windowY = feet + chest * 0.52
    const bezel = new TorusGeometry(windowRadius + 0.012, 0.016, 10, 48)
    const inlet = new CylinderGeometry(throat + 0.03, throat + 0.04, 0.035, 48)
    const outlet = new CylinderGeometry(pipe + 0.035, pipe + 0.035, 0.03, 48)
    const glass = new CircleGeometry(windowRadius + 0.004, 48)
    this.brass = mergeParts([
      // The side collar at the end of the sloping intake
      place(inlet.rotateZ(-Math.PI / 2), width / 2 + 0.0175, machineBody.inletY, 0),
      // The flange where the pipe leaves through the back
      place(outlet.rotateX(Math.PI / 2), 0, machineBody.outletY, depth / 2 + 0.015),
      place(bezel, 0, windowY, -depth / 2 - 0.004),
    ])
    this.glass = place(glass.rotateY(Math.PI), 0, windowY, -depth / 2 - 0.002)
  }

  dispose() {
    for (const geometry of [this.brass, this.glass, this.iron]) {
      geometry.dispose()
    }
  }
}
