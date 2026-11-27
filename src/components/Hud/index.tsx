import Branch from 'branch-component'
import {useSyncExternalStore} from 'react'
import useNarrator, {narrationState, narrationStates} from 'use-narrator'
import {useShallow} from 'zustand/react/shallow'

import AimDot from '#component/AimDot'
import ArtworkOverlay from '#component/ArtworkOverlay'
import InteractionHint from '#component/InteractionHint'
import {NarrationIndicatorStack} from '#component/NarrationIndicator'
import NarrationSubtitles from '#component/NarrationSubtitles'
import RoomAnnouncement from '#component/RoomAnnouncement'
import {narrator} from '#src/lib/audio/narration.ts'
import crosshair from '#src/lib/crosshair.ts'
import {useGallery} from '#src/lib/gallery.ts'
import {isAnnouncingRooms} from '#src/lib/roomAnnouncements.ts'

export default function Hud() {
  const s = useGallery(useShallow(({dragging, locked}) => ({
    dragging,
    locked,
  })))
  const snapshot = useNarrator(narrator)
  const narrations = narrationStates(snapshot)
  const foreground = narrationState(snapshot)
  // Subtitles take the artwork overlay’s place while they read out the same title and description.
  const subtitled = foreground?.text && foreground.status !== 'preparing' ? {
    ...foreground,
    text: foreground.text,
  } : undefined
  // The subtitles lead with their own narration’s tag and spectrum, so the stack keeps the others.
  const indicated = subtitled ? narrations.filter(narration => narration.instanceId !== subtitled.instanceId) : narrations
  const showCrosshair = useSyncExternalStore(crosshair.subscribe, crosshair.getSnapshot, crosshair.getSnapshot)
  const artwork = useGallery(({activeLabel, held, portraits}) => (held ? undefined : portraits.find(p => p.id === activeLabel && p.hung && !p.reserved)))
  return <Branch if={s.locked} not={s.dragging}>
    <Branch if={showCrosshair} then={AimDot} />
    <Branch if={subtitled}><NarrationSubtitles key={subtitled?.instanceId} narration={subtitled!} /></Branch>
    <Branch if={artwork && !subtitled}><ArtworkOverlay portrait={artwork!} /></Branch>
    <Branch if={isAnnouncingRooms} then={RoomAnnouncement} />
    <InteractionHint />
    <NarrationIndicatorStack narrations={indicated} />
  </Branch>
}
