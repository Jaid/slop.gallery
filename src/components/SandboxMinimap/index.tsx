import type {MinimapPose} from '#src/lib/minimapPlayer.ts'
import type {MinimapProps} from '#src/worlds/base/World.ts'

import Branch from 'branch-component'
import {useEffect, useRef} from 'react'

import {playerTransform} from '#src/lib/minimapPlayer.ts'
import sandbox from '#src/worlds/sandbox/index.ts'

import css from './style.module.sass'

const cell = sandbox.room('cell')
const [x, z] = cell.center
const [frameX, frameZ, frameWidth, frameDepth] = cell.map!.placedFrame(cell.center)
const margin = 1
const viewBox = [frameX - margin, frameZ - margin, frameWidth + margin * 2, frameDepth + margin * 2].join(' ')

/** The Cell’s floor plan with the player on it, on the map’s upper side only, as the Sandbox has a single floor. */
export default function SandboxMinimap({lower, pose}: Pick<MinimapProps, 'lower' | 'pose'>) {
  return <Branch not={lower}><CellMap pose={pose} /></Branch>
}

function CellMap({pose}: {pose: MinimapPose}) {
  const player = useRef<SVGPathElement>(null)
  useEffect(() => {
    // Read the live camera without rerendering the menu every frame.
    let frame: number
    const update = () => {
      player.current?.setAttribute('transform', playerTransform(pose))
      frame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(frame)
  }, [pose])
  return <svg className={css.container} aria-label={`${sandbox.title} map`} role='img' viewBox={viewBox}>
    <g dangerouslySetInnerHTML={{__html: cell.map!.markup}} data-room={cell.id} opacity={sandbox.mapOpacity(cell, cell.id)} transform={`translate(${x} ${z})`} />
    <path className={css.player} aria-label='Your position' d='M 0 -0.8 L 0.45 0.5 L 0 0.28 L -0.45 0.5 Z' transform={playerTransform(pose)} ref={player} />
  </svg>
}
