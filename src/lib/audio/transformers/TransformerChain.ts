/**
 * How a mood transforms every sound of the world, like the walls of a room ringing on: wires `input` to `output` through nodes of its own, the dry sound included, returning how to disconnect them again.
 * It is built anew whenever its mood begins to show, so it may keep state, but `input` belongs to the caller.
 */
export type SoundTransformer = (context: BaseAudioContext, input: AudioNode, output: AudioNode) => () => void

/** a transformer built on a link for the one who keys it */
type Hold = {
  key: object
  /** when it last stopped taking any sound, in the context’s time */
  left: number
  release: () => void
  /** the timer that releases it once it has stopped taking any sound and its last echo has died */
  timer?: ReturnType<typeof setTimeout>
}
/** one link of the chain: what reaches it passes on dry by the share its transformer leaves and through its transformer by the share it takes */
type Link = {
  /** the share the link’s transformer takes, as last set */
  amount: number
  dry: GainNode
  hold?: Hold
  outlet: GainNode
  send: GainNode
}

/** how many transformers can take the world’s sound at once, stacked one after the other, those still ringing out included */
const length = 6
/** the time constant in seconds by which a link follows a new share by default, short enough to keep up with a mood’s eased fade frame by frame */
const linkSmoothing = 0.03
/** how long a transformer stays built after it stopped taking any sound, in seconds: long enough for any echo to die and for a mood coming back, like a room stepped back into through its doorway, to find it still there */
const linger = 8

/**
 * Hears the world through every transformer the moods showing contribute, stacked one after the other, each taking as much of the sound as its mood shows and passing the rest on dry, so they fade in and out on their own.
 * A transformer is fed before its share is applied, so what it took rings out on its own while its mood fades, like the room left behind, and everything new reaches the transformers taking over.
 * The links are wired once and only ever pass dry when free, so no transformer coming or going breaks the sound passing through.
 */
export default class TransformerChain {
  private readonly links: ReadonlyArray<Link>

  constructor(private readonly context: BaseAudioContext, input: AudioNode, output: AudioNode) {
    let inlet = input
    this.links = Array.from({length}, () => {
      const dry = context.createGain()
      const send = context.createGain()
      const outlet = context.createGain()
      send.gain.value = 0
      inlet.connect(dry).connect(outlet)
      inlet.connect(send)
      inlet = outlet
      return {
        amount: 0,
        dry,
        outlet,
        send,
      }
    })
    inlet.connect(output)
  }

  /**
   * Lets the transformer keyed by `key` take `amount` (0–1) of the world’s sound from now on, building `transformer` on a free link first if it has none.
   * At 0, what it took rings out and it is released 8 s later unless it takes some again before. With every link taken, a new transformer replaces the one that has rung out the longest, or else stays out.
   * The link follows the new share with `smoothing` as its time constant in seconds; 0 switches it at once.
   */
  transform(key: object, transformer: SoundTransformer, amount: number, smoothing = linkSmoothing) {
    let link = this.links.find(candidate => candidate.hold?.key === key)
    if (!link) {
      if (amount <= 0) {
        return
      }
      link = this.vacant()
      if (!link) {
        return
      }
      link.hold = {
        key,
        left: this.context.currentTime,
        release: transformer(this.context, link.send, link.outlet),
      }
    }
    if (amount === link.amount) {
      return
    }
    const hold = link.hold!
    const now = this.context.currentTime
    link.amount = amount
    link.send.gain.setTargetAtTime(amount, now, smoothing)
    link.dry.gain.setTargetAtTime(1 - amount, now, smoothing)
    clearTimeout(hold.timer)
    hold.timer = undefined
    if (amount === 0) {
      hold.left = now
      const ringing = link
      hold.timer = setTimeout(() => this.release(ringing), linger * 1000)
    }
  }

  private release(link: Link) {
    const {hold} = link
    if (!hold) {
      return
    }
    clearTimeout(hold.timer)
    hold.release()
    link.send.disconnect()
    link.hold = undefined
  }

  /** A link to build a transformer on: a free one, or else the one whose transformer has rung out the longest, released for it. */
  private vacant() {
    const free = this.links.find(link => !link.hold)
    if (free) {
      return free
    }
    const ringing = this.links.filter(link => link.amount === 0).toSorted((a, b) => a.hold!.left - b.hold!.left).at(0)
    if (ringing) {
      this.release(ringing)
    }
    return ringing
  }
}
