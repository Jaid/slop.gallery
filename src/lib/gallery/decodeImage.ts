/** A bitmap or an SVG decoded for drawing, with its intrinsic size. The caller closes it after drawing. SVGs load as images, with scripts and external resources disabled. */
export default async function decodeImage(file: Blob) {
  if (file.type !== 'image/svg+xml') {
    const bitmap = await createImageBitmap(file)
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      vector: false,
      close: () => bitmap.close(),
    }
  }
  const url = URL.createObjectURL(file)
  const element = new Image
  try {
    element.src = url
    await element.decode()
    if (!(element.naturalWidth && element.naturalHeight)) {
      throw new Error('This SVG has no size of its own. Give its root a width and a height.')
    }
    return {
      source: element as CanvasImageSource,
      width: element.naturalWidth,
      height: element.naturalHeight,
      vector: true,
      close: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}
