/**
 * Calls the listener before every frame the browser paints, for `useSyncExternalStore` to read what changes without telling anyone, like the camera’s pose and the bodies of the physics. Returns how to stop.
 */
export default function subscribeToFrames(listener: () => void) {
  let frame = requestAnimationFrame(function follow() {
    listener()
    frame = requestAnimationFrame(follow)
  })
  return () => cancelAnimationFrame(frame)
}
