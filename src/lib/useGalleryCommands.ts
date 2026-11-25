import {useEffect} from 'react'

import {galleryEvents, handleGalleryKey, importDroppedFiles, isTextInput, notify, useGallery} from './gallery.ts'
import ImageImporter from './gallery/ImageImporter.ts'

export default function useGalleryCommands() {
  useEffect(() => {
    const importer = new ImageImporter(p => galleryEvents.dispatchEvent(new CustomEvent('imported', {detail: p})))
    useGallery.setState({importFiles: (files, target) => importer.import(files, target)})
    const drop = (event: Event) => {
      const {files, x, y} = (event as CustomEvent<{
        files: Array<File>
        x: number
        y: number
      }>).detail
      void importDroppedFiles(files, x, y).catch(() => notify('The files could not be imported.'))
    }
    const paste = (event: ClipboardEvent) => {
      if (isTextInput(event.target)) {
        return
      }
      const files = [...event.clipboardData?.files ?? []]
      if (files.length) {
        event.preventDefault()
        void importer.import(files).catch(() => notify('The files could not be imported.'))
      }
    }
    document.addEventListener('paste', paste)
    globalThis.addEventListener('keydown', handleGalleryKey)
    galleryEvents.addEventListener('drop-files', drop)
    return () => {
      importer.dispose()
      document.removeEventListener('paste', paste)
      globalThis.removeEventListener('keydown', handleGalleryKey)
      galleryEvents.removeEventListener('drop-files', drop)
      useGallery.setState({importFiles: null})
    }
  }, [])
}
