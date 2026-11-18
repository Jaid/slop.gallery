import type {Node} from 'three/webgpu'

import {array, Break, exp, float, If, Loop, max, mix, mx_noise_float, screenSize, screenUV, smoothstep, vec2, vec3, vec4} from 'three/tsl'
import {Color, SRGBColorSpace} from 'three/webgpu'

import MoodScreen from '../base/MoodScreen.ts'
import {strokeMargin, strokeRounds, vignettePaints, vignetteStrokes} from './vignetteStrokes.ts'

type Float = Node<'float'>

/** how far apart the grooves the bristles drag into the paint lie, coarse and fine, in screen heights, so a broad brush leaves more of them than a slender one */
const grooves = [0.014, 0.005] as const
/** how far apart the bristles are that touch down early or trail on where a stroke begins and ends, in screen heights */
const tipSpacing = 0.007
/** how thick the paint lies at its thickest, in its half widths, which sets how steeply its ridges and grooves catch the light */
const impasto = 0.3
/** where the light rakes over the paint from: the upper left, a little in front of the screen */
const light = vec3(-0.5, 0.62, 0.6).normalize()
/** halfway between the light and the viewer, which the paint glints toward */
const halfway = light.add(vec3(0, 0, 1)).normalize()
/** how far apart the paint’s height is sampled to find which way its surface faces, across and along, in screen heights */
const normalStep = [0.0015, 0.003] as const
/** where a stroke’s shadow falls on what lies beneath it, in screen heights, down and to the right, away from the light, and how dark it gets there at most */
const shadow = {
  offset: [0.006, -0.008] as const,
  strength: 0.2,
}
const castBy = vec2(...shadow.offset)
/** how far past a stroke its shadow reaches */
const shadowReach = Math.hypot(...shadow.offset)
/** how far a stroke reaches past where the brush set down and lifted off, in its widths, with room for its round ends */
const caps = 0.75
/** how far out the strokes’ paint and shadows begin at the nearest, 1 on the ellipse through the middles of the screen’s edges; nothing nearer the middle is worked out (see `paint-vignette.test.ts`) */
const clear = 0.66
/** how much of the frame shows through the thin glaze of umber the corners are toned with before the strokes go on, at most */
const wash = {
  color: '#2a1a12',
  strength: 0.42,
}
const rgb = new Color
/** a color in display space, as the frame is after the output transform */
const display = (hex: string) => {
  const {r, g, b} = rgb.set(hex).getRGB({
    r: 0,
    g: 0,
    b: 0,
  }, SRGBColorSpace)
  return vec3(r, g, b)
}
const paints = array(vignettePaints.map(display))
const anchors = array(vignetteStrokes.map(({anchorFrom, anchorTo}) => vec4(...anchorFrom, ...anchorTo)))
const offsets = array(vignetteStrokes.map(({from, to}) => vec4(...from, ...to)))
const shapes = array(vignetteStrokes.map(({bow, duration, start, width}) => vec4(width, bow, start, duration)))
const looks = array(vignetteStrokes.map(({dryness, paint, phase, second}) => vec4(paint, second, phase, dryness)))
const rounds = array(vignetteStrokes.map(({lead, period}) => vec2(period, lead)))
/** how long a stroke keeps its wet gloss after the brush laid it and by when it has gone matte, in arrivals */
const glossy = [1, 2.2] as const
/** how much of its gloss paint keeps once it has gone matte */
const matte = 0.15
/** how much drier a stroke is by the end of its round than the brush left it, where it dries the most: enough to leave nothing of its far end and streaks of its middle */
const weathering = 0.95

/**
 * The Atelier’s vignette: as the mood comes in, unseen brushes paint the edges of the view one stroke after another, the dark ground hatched across the corners and brushed along the edges, earth tones over it and last a few bright accents on the inner rim, leaving the middle clear (see `vignetteStrokes.ts`).
 * None of them stays as it is: each goes matte and dries into bristle streaks after a while, from where the brush lifted off back toward where it set down, until the brush comes back and lays it again over what is left of it, round after round and every stroke at a pace of its own, so somewhere along the edges a brush is always at work while the mood holds (see `strokeAt`).
 * Every stroke grows from a blunt round start behind the wet bead of paint the bristles push ahead, pressed down where it sets out and tapering where the brush lifts off, its edges ragged where single bristles reach out or fall short, its paint dragged into grooves and breaking up into dry streaks toward its end, and lit like impasto from the upper left, so every ridge and groove catches the light and glints wet, and its body shades what it was laid over. As the mood leaves, the strokes dry away into bristle streaks in the opposite order they were laid in.
 * The strokes are composited front to back, the last one laid first, so a pixel stops working out the strokes beneath once the paint above covers it.
 */
export default class PaintScreen extends MoodScreen {
  /**
   * @param arrivalTime seconds its mood takes to come in, which the strokes’ rounds are counted in
   */
  constructor(private readonly arrivalTime: number) {
    super()
  }

  draw(frame: Node<'vec3'>): Node<'vec3'> {
    const {arrival, presence} = this
    /** the mood’s time in arrivals: how far it has arrived, counting on from 1 once it has */
    const clock = arrival.add(this.stay.div(this.arrivalTime)).toVar('vignetteClock')
    const aspect = screenSize.x.div(screenSize.y)
    const halfWidth = aspect.mul(0.5)
    /** the pixel in screen heights from the middle, x to the right and y up */
    const point = vec2(screenUV.x.sub(0.5).mul(aspect), float(0.5).sub(screenUV.y)).toVar('vignettePoint')
    /** how far a pixel reaches, in screen heights */
    const pixel = float(1).div(screenSize.y)
    // How far toward the corners the pixel lies, 1 at the middles of the edges: the corners are toned with a thin glaze first, streaked along the edges like a broad brush.
    const toward = point.div(vec2(halfWidth, 0.5)).length().toVar('vignetteToward')
    const streaked = mx_noise_float(point.mul(3).add(0.5)).mul(0.12)
    const glaze = smoothstep(0.88, 1.42, toward.add(streaked)).mul(wash.strength).mul(smoothstep(0, 0.3, arrival)).mul(presence)
    const beneath = mix(frame, display(wash.color), glaze)
    /** the paint laid over the pixel so far, front to back, and how much of what lies beneath still shows through it */
    const laidOver = vec3(0).toVar('vignettePaint')
    const through = float(1).toVar('vignetteThrough')
    // The last streaks go as the mood is all but gone.
    const lingering = smoothstep(0, 0.12, presence)
    // The finer grooves fade out before they get too fine for the pixels to show.
    const fine = smoothstep(2.5, 5, float(grooves[1]).div(pixel)).mul(0.2)
    If(toward.greaterThan(clear), () => {
      Loop({
        start: vignetteStrokes.length - 1,
        end: 0,
        condition: '>=',
      }, ({i}) => {
        const anchor = anchors.element(i)
        const offset = offsets.element(i)
        const shape = shapes.element(i)
        const look = looks.element(i)
        const pace = rounds.element(i)
        const width = shape.x
        const bow = shape.y
        // As `strokeAt` has it: which round the stroke is in, how far into it and how long ago the brush set down for it.
        const since = clock.sub(shape.z)
        const turn = since.div(pace.x).add(pace.y)
        const round = turn.floor()
        /** 0 in the round the stroke is first laid in and 1 in every one after, in which the brush lays it over what dried of it */
        const again = round.min(1)
        const turned = turn.sub(round)
        const passed = turned.sub(pace.y.mul(again.oneMinus())).mul(pace.x)
        const laid = smoothstep(0, shape.w.mul(mix(float(1), float(strokeRounds.patience), again)), passed).mul(since.step(0))
        const dried = smoothstep(strokeRounds.drying, 1, turned)
        // As `strokePoint` lays it out.
        const from = vec2(anchor.x.mul(halfWidth), anchor.y.mul(0.5)).add(offset.xy)
        const to = vec2(anchor.z.mul(halfWidth), anchor.w.mul(0.5)).add(offset.zw)
        const span = to.sub(from)
        const length = span.length()
        const along = span.div(length)
        const left = vec2(along.y.negate(), along.x)
        const relative = point.sub(from)
        /** how far along the stroke the pixel lies, in screen heights from where the brush set down */
        const meters = relative.dot(along)
        const straightAside = relative.dot(left)
        // with room for its shadow
        const reach = width.mul(0.5 * strokeMargin).add(shadowReach)
        const capped = width.mul(caps).add(shadowReach)
        // Only the strokes the brush has begun near the pixel are worked out, as far as it came, or all along once it comes back for what it laid before.
        If(laid.greaterThan(0).and(straightAside.abs().lessThan(reach.add(bow.abs()))).and(meters.greaterThan(capped.negate())).and(meters.lessThan(laid.max(again).mul(length).add(capped))), () => {
          const share = meters.div(length).clamp(0, 1)
          const aside = straightAside.sub(bow.mul(share.mul(Math.PI).sin()))
          const phase = look.z
          // Pressed down as the brush sets out, then easing off and tapering toward where it lifts off, its pressure wavering a little, as `strokeTaper` has it.
          const half = width.mul(0.5).mul(mix(float(0.72), float(1), smoothstep(0, 0.22, share))).mul(mix(float(1), float(0.55), smoothstep(0.45, 1, share))).mul(share.mul(7).add(phase.mul(30)).sin().mul(0.05).add(1))
          const across = aside.div(half)
          // The bristles drag grooves along the stroke, wandering a little, coarse and fine.
          const seed = vec2(phase.mul(17.3), phase.mul(31.7))
          const bristlesAt = (sideways: Float, lengthways: Float) => mx_noise_float(vec2(sideways.div(grooves[0]), lengthways.mul(6)).add(seed)).mul(0.35).add(mx_noise_float(vec2(sideways.div(grooves[1]), lengthways.mul(16)).sub(seed)).mul(fine)).add(0.5).clamp(0.02, 1)
          const bristles = bristlesAt(aside, meters)
          // the wet bead of paint the brush pushes ahead while it moves, gone once it lifted off
          const pushing = float(1).sub(laid.pow(6))
          const head = laid.mul(length)
          // Its outline: ragged along both edges, where single bristles reach out or fall short, rounded where the brush set down and at its head, where single bristles touched down early or trail on, each by a length of its own.
          const crown = float(1).sub(across.mul(across)).max(0).sqrt()
          const ragged = mx_noise_float(vec2(meters.mul(36), across.sign().mul(3)).add(seed)).mul(0.08)
          const edges = ragged.add(1).sub(across.abs()).mul(half)
          const tips = mx_noise_float(vec2(aside.div(tipSpacing), phase.mul(41))).add(0.5).clamp(0, 1)
          const start = meters.add(half.mul(crown.mul(0.7).add(tips.mul(0.12))))
          const front = head.sub(meters).add(half.mul(crown.mul(pushing.mul(0.2).add(0.4)).add(tips.mul(pushing.oneMinus().mul(0.9).add(0.15)))))
          // how close behind the head of a stroke still being laid the pixel lies, where the bead of wet paint the bristles push ahead swells, 1 in its middle
          const beading = exp(head.sub(half.mul(0.3)).sub(meters).div(half.mul(0.45)).pow2().negate()).mul(pushing)
          // where the stroke ended as the brush lifted off in the round before, whose paint still lies there ahead of the brush coming back
          const end = length.sub(meters).add(half.mul(crown.mul(0.4).add(tips.mul(1.05))))
          const sides = edges.min(start)
          /** how much of the pixel this round’s paint covers, behind the brush, and how much the paint of the round before, all along the stroke */
          const fresh = sides.min(front).div(pixel).add(0.5).clamp(0, 1)
          const stale = sides.min(end).div(pixel).add(0.5).clamp(0, 1).mul(again)
          // The brush runs dry toward the stroke’s end and along its edges, leaving bristle streaks; as the mood leaves, the strokes dry away into them in the opposite order they were laid in, the accents first and the ground last, each from where the brush lifted off back to where it set down.
          const leaving = float(1).sub(presence).mul(2.4).sub(shape.z.oneMinus().mul(0.45)).sub(phase.mul(0.25)).sub(share.oneMinus().mul(0.45)).max(0)
          // Left alone, it dries the same way through its round, though never all away: by its end, when the brush comes back, its far end is gone and its middle is streaks, which is what the brush then lays it over.
          const weathered = float(weathering).sub(share.oneMinus().mul(0.45)).max(0)
          const withering = dried.mul(weathering).sub(share.oneMinus().mul(0.45)).max(0)
          const fringe = smoothstep(0.7, 1.05, across.abs()).mul(0.55)
          const dry = smoothstep(0.55, 1, share).mul(0.7).add(fringe).add(leaving).add(look.w).sub(0.12)
          // About a pixel soft, so the streaks don’t crawl.
          const softness = max(float(0.06), pixel.div(half).mul(4))
          const streaks = (dryness: Float) => smoothstep(dryness.sub(softness), dryness.add(softness), bristles)
          const opacity = max(fresh.mul(streaks(dry.add(withering).sub(beading.mul(0.8)))), stale.mul(streaks(dry.add(weathered)))).mul(lingering).toVar()
          If(opacity.greaterThan(0.002), () => {
            // The ridges are never narrower than a couple of pixels, or their glints would flicker along them.
            const ridgeWidth = max(float(0.1), pixel.mul(1.5).div(half))
            // How thick the paint lies: rounded across, pushed up into ridges along both edges, thinner the farther the brush came, grooved by its bristles and swollen into the bead at its head.
            const height = (crosswise: Float, lengthways: Float, grooved: Float) => {
              const rounded = float(1).sub(crosswise.mul(crosswise)).max(0).sqrt().mul(0.7)
              const ridges = exp(crosswise.abs().sub(0.86).div(ridgeWidth).pow2().negate()).mul(0.45)
              const load = mix(float(1), float(0.4), lengthways.div(length).clamp(0, 1))
              const bead = exp(head.sub(half.mul(0.3)).sub(lengthways).div(half.mul(0.45)).pow2().negate()).mul(crown).mul(1.1).mul(pushing)
              return rounded.add(ridges).mul(load).add(grooved.sub(0.5).mul(0.6)).add(bead)
            }
            const surface = height(across, meters, bristles)
            // The slopes per half width, across and along.
            const stepAcross = float(normalStep[0]).div(half)
            const slopeAcross = height(across.add(stepAcross), meters, bristlesAt(aside.add(normalStep[0]), meters)).sub(surface).div(stepAcross)
            const slopeAlong = height(across, meters.add(normalStep[1]), bristlesAt(aside, meters.add(normalStep[1]))).sub(surface).div(normalStep[1]).mul(half)
            // Which way the paint faces on the screen: tilted off it by its slopes across and along the stroke.
            const facing = vec3(left.mul(slopeAcross).add(along.mul(slopeAlong)).mul(-impasto), 1).normalize()
            // Some brushes were dipped into a second paint on one side, which streaks the stroke along its bristles there without mixing in; the paint’s tone wavers along the stroke.
            const wavering = mx_noise_float(vec2(meters.mul(7), across.mul(0.8)).sub(seed))
            const dipped = smoothstep(-0.2, 0.5, across.add(wavering.mul(0.35)))
            const second = smoothstep(-0.08, 0.02, mx_noise_float(vec2(aside.div(grooves[0] * 1.25), meters.mul(4.2)).add(seed.yx))).mul(dipped)
            const pigment = mix(paints.element(look.x.toInt()), paints.element(look.y.toInt()), second).mul(wavering.mul(0.12).add(1))
            // Raking light like on impasto, so every ridge and groove shows, glossy and glinting while wet, which it stays for a while after the brush laid it.
            const lit = max(facing.dot(light), 0).mul(0.72).add(0.45)
            const shine = max(facing.dot(halfway), 0)
            const wet = mix(float(matte), mix(float(1), float(matte), smoothstep(glossy[0], glossy[1], passed)), fresh)
            const gloss = shine.pow(40).mul(0.22).add(shine.pow(8).mul(0.04)).mul(presence).mul(wet)
            laidOver.addAssign(pigment.mul(lit).add(vec3(gloss)).mul(opacity).mul(through))
          })
          // The paint stands off what it was laid over, which its body shades a little down and to the right of it, away from the light.
          const castMeters = meters.sub(castBy.dot(along))
          const castAcross = aside.sub(castBy.dot(left)).div(half)
          const castCrown = float(1).sub(castAcross.mul(castAcross)).max(0).sqrt()
          const castInside = float(1).sub(castAcross.abs()).mul(half).min(castMeters.add(half.mul(castCrown).mul(0.7))).min(head.max(length.mul(again)).sub(castMeters).add(half.mul(castCrown).mul(0.4)))
          // Only as much as there is paint to cast it: little where the brush ran dry toward the end or the paint dried since, and none once it dried away.
          const castDry = smoothstep(0.55, 1, castMeters.div(length).clamp(0, 1)).mul(0.7).add(look.w).add(leaving).add(mix(weathered.mul(again), withering, laid))
          const shade = smoothstep(half.mul(-0.25), half.mul(0.35), castInside).mul(smoothstep(0.3, 0.9, castDry).oneMinus()).mul(shadow.strength).mul(lingering)
          through.mulAssign(opacity.oneMinus().mul(shade.oneMinus()))
        })
        // Nothing beneath shows through any more.
        If(through.lessThan(0.004), () => {
          Break()
        })
      })
    })
    return laidOver.add(beneath.mul(through))
  }
}
