/**
 * Calls `callback` once the clock of `context` reaches `time`, in its own seconds, or at once if it already did: on time however fast the context renders, unlike a timer on the wall clock, which fires too early for a context that renders slower than real time, like a film’s offline one, and too late for a suspended one’s sound that resumes.
 * A silent constant source, rendered into the destination so it ends exactly on time, carries it. Returns how to cancel it.
 */
export default function atContextTime(context: BaseAudioContext, time: number, callback: () => void) {
  const timer = context.createConstantSource()
  timer.offset.value = 0
  timer.connect(context.destination)
  let pending = true
  timer.addEventListener('ended', () => {
    timer.disconnect()
    if (pending) {
      pending = false
      callback()
    }
  }, {once: true})
  timer.start()
  timer.stop(Math.max(time, context.currentTime))
  return () => {
    if (pending) {
      pending = false
      // A later call replaces the stop scheduled before, which frees the source right away.
      timer.stop()
    }
  }
}
