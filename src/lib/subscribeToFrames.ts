/** Samples mutable Three.js state for a DOM external-store subscriber, without drawing or advancing any canvas. */
export default function subscribeToFrames(listener: () => void) {
  let frame = requestAnimationFrame(function follow() {
    listener()
    frame = requestAnimationFrame(follow)
  })
  return () => cancelAnimationFrame(frame)
}
