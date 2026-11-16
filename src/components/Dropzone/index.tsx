import type {PropsWithChildren} from 'react'
import type {DropEvent} from 'react-dropzone'

import Branch from 'branch-component'
import {useEffect, useSyncExternalStore} from 'react'
import {useDropzone} from 'react-dropzone'

import ArtworkDropOverlay from '#component/ArtworkDropOverlay'
import {dragPose, galleryEvents, notify, useGallery} from '#src/lib/gallery.ts'
import {imageExtensions, maximumImageBytes} from '#src/lib/gallery/imagePolicy.ts'
import worldClock from '#src/lib/worldClock.ts'

import css from './style.module.sass'

export default function Dropzone({children}: PropsWithChildren) {
  const placement = useGallery(s => s.placement)
  // Under the pause menu, an image dragged in goes into the collection instead of aiming into the frozen scene, which stays as it is.
  const frozen = useSyncExternalStore(worldClock.subscribe, worldClock.getSnapshot)
  const handleDrop = (files: Array<File>, event: DropEvent) => {
    if (event.type === 'drop') {
      const {clientX: x, clientY: y} = event as DragEvent
      galleryEvents.dispatchEvent(new CustomEvent('drop-files', {
        detail: {
          files,
          x,
          y,
        },
      }))
    } else {
      const importFiles = useGallery.getState().importFiles
      if (importFiles) {
        void importFiles(files).catch(() => notify('The images could not be imported.'))
      }
    }
  }
  const {getRootProps, getInputProps, isDragActive, isDragReject} = useDropzone({
    noClick: true,
    noKeyboard: true,
    onDropAccepted: handleDrop,
    accept: imageExtensions,
    maxSize: maximumImageBytes,
    onDragOver: event => {
      dragPose.x = event.clientX
      dragPose.y = event.clientY
    },
  })
  const aiming = isDragActive && !frozen
  useEffect(() => {
    dragPose.active = aiming
    useGallery.setState({dragging: aiming})
    if (!aiming) {
      useGallery.setState({placement: null})
    }
    return () => {
      dragPose.active = false
    }
  }, [aiming])
  return <div {...getRootProps({className: css.container})}>
    <input {...getInputProps()} aria-label='Import artworks' data-artwork-input />
    {children}
    <Branch if={isDragActive}><ArtworkDropOverlay collecting={frozen} rejected={isDragReject} valid={Boolean(placement?.valid)} /></Branch>
  </div>
}
