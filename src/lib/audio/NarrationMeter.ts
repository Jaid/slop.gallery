type Connection = {
  analyser: AnalyserNode
  disconnect: () => void
  /** whether the narration can be heard right now */
  sounding: () => boolean
}

export const narrationBands = [[20, 120], [120, 500], [500, 2000], [2000, 6000], [6000, 12_000]] as const

/** RMS of the analyser’s normalized frequency magnitudes, grouped like the reference visualizer. */
export function frequencyLevels(frequencies: Uint8Array, sampleRate: number, fftSize: number, output = new Float32Array(narrationBands.length)) {
  const binHz = sampleRate / fftSize
  for (const [band, [minimum, maximum]] of narrationBands.entries()) {
    const first = Math.max(0, Math.ceil(minimum / binHz))
    const last = Math.min(frequencies.length, Math.ceil(maximum / binHz))
    let squares = 0
    for (let i = first; i < last; i++) {
      squares += (frequencies[i] / 255) ** 2
    }
    output[band] = last > first ? Math.sqrt(squares / (last - first)) : 0
  }
  return output
}

/** Analyses narration only. Each narrator instance retains its own meter while async voices overlap. */
export default class NarrationMeter {
  private readonly bands = new Float32Array(narrationBands.length)
  private connections = new Map<string, Connection>
  private frequencies = new Uint8Array(1024)
  private readonly levels = new Float32Array(narrationBands.length)

  /** Routes a narration through its own analyser to `destination`: a media element, or the node its decoded audio leaves, which sounds whenever it plays. Returns the cleanup. */
  connect(instanceId: string, audio: AudioNode | HTMLAudioElement, context: BaseAudioContext, destination: AudioNode = context.destination) {
    const decoded = 'connect' in audio
    const source = decoded ? audio : (context as AudioContext).createMediaElementSource(audio)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.72
    analyser.minDecibels = -90
    analyser.maxDecibels = -10
    source.connect(analyser)
    analyser.connect(destination)
    const connection = {
      analyser,
      sounding: decoded ? () => true : () => !(audio.paused || audio.ended || audio.muted || audio.volume === 0),
      disconnect: () => {
        source.disconnect()
        analyser.disconnect()
      },
    }
    this.connections.get(instanceId)?.disconnect()
    this.connections.set(instanceId, connection)
    return () => {
      if (this.connections.get(instanceId) !== connection) {
        return
      }
      this.connections.delete(instanceId)
      connection.disconnect()
    }
  }

  read(instanceId?: string) {
    this.levels.fill(0)
    if (instanceId) {
      const connection = this.connections.get(instanceId)
      if (connection) {
        this.measure(connection)
      }
      return this.levels
    }
    for (const connection of this.connections.values()) {
      this.measure(connection, true)
    }
    return this.levels
  }

  private measure({analyser, sounding}: Connection, merge = false) {
    if (!sounding() || analyser.context.state !== 'running') {
      return
    }
    analyser.getByteFrequencyData(this.frequencies)
    frequencyLevels(this.frequencies, analyser.context.sampleRate, analyser.fftSize, this.bands)
    if (!merge) {
      this.levels.set(this.bands)
      return
    }
    for (let band = 0; band < this.levels.length; band++) {
      this.levels[band] = Math.max(this.levels[band], this.bands[band])
    }
  }
}

export const narrationMeter = new NarrationMeter
