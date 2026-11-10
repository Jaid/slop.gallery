/** `date` as file names carry it, like `2026-11-09T20-56-05`: UTC to the second, without colons. */
export function fileTimestamp(date = new Date) {
  return date.toISOString().replaceAll(/[.:]/gu, '-').replace(/-\d{3}Z$/u, '')
}

/** Saves `blob` as a browser download named `fileName`. */
export default function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Revoking right after the click can cancel the download before Chromium has read the blob.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}
