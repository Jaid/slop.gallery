import type {ThreeElements} from '@react-three/fiber'

import useArtworkTexture, {artworkPlaceholders} from '#src/lib/useArtworkTexture.ts'

export default function DynamicImageMaterial({priority, source, ...props}: Omit<ThreeElements['meshBasicNodeMaterial'], 'map'> & {
  priority?: number
  source?: Blob | string | null
}) {
  const {texture, failed} = useArtworkTexture(source, priority)
  // Switching between opaque and transparent needs a fresh material, so the transparency is part of the key.
  return <meshBasicNodeMaterial key={`${texture?.uuid ?? 'loading'}-${String(props.transparent)}`} {...props} color={texture ? '#ffffff' : (failed ? artworkPlaceholders.failed : artworkPlaceholders.loading)} map={texture} />
}
