# Moods

A mood (`base/Mood.ts`) is a spell over the whole world while something casts it. Every mood lives in a folder of its own, `src/moods/<id>`, with whatever only it needs, like its ambience, and `index.ts` holds one of each by its id, which is how everything else refers to them: rooms name `mood: 'bastion'`, orbs `mood: 'horror'`, and `?mood` takes any of the ids.

A mood contributes any of five kinds of transformation, all optional, all fading in and out together at the mood’s strength:

| Kind | Members | Where it applies |
| --- | --- | --- |
| Color filters | `grade`, `lamps`, `fill` | `src/lib/rendering/moodGrade.ts` lays the gradient map over the finished frame after `renderOutput`; `lightLevels.ts` multiplies every light’s color by the tint of its kind. |
| Screen | `screen` | A `MoodScreen` (`base/MoodScreen.ts`) of the mood’s own, a shader drawn over the finished frame in display space, like the Atelier’s vignette of brush strokes. `src/lib/rendering/moodScreens.ts` builds every mood’s screen into the render pipeline once, after the gradient maps and before the dither, and runs each only while its mood shows, so a mood coming over the world compiles nothing. It takes the frame’s color in display space and returns it with the screen drawn over; the frame’s alpha stays as it is. Screens show in every graphics mode; `?show_wireframe` and `?albedo` replace the pipeline and show none. |
| Ambience | `ambience` | A centered `AmbienceLoop` class, made anew each time the mood begins, on the effects master. |
| Sound transformer | `transformer` | A `SoundTransformer` in `SoundEngine.transformers`, which every sound of the world passes through, like a room’s `reverberation`. |
| View | `fov` | Degrees the player’s own view gets wider by, or narrower where negative, like the Corridor’s 10°. `lib/MoodLens.ts` adds them to the camera’s field of view only while the view is drawn, each frame and every capture of one, so the zoom, V-viewing and the world tuning never see them; zooming in gives them up along the way, and a camera taken from the player, like V-viewing’s or the intro’s, keeps its own. Captures fly the player itself (`slopGallery.fly`), so a camera bookmark’s and a film recipe’s field of view widen like any player’s view. `?fov` (the captures’ `--fov`) keeps the widening off: nothing but the player’s zoom and V-viewing changes that field of view. |

Two things cast moods, both asked for by `#component/Moods` every frame:

- The room the player is in, through its `mood` option, the id of a `RoomMood` (`base/RoomMood.ts`), usually the room’s own with its acoustics. Room moods come and go in 0.5 s both ways (`roomMoodFade`), so two rooms’ moods cross over evenly in a doorway, and a mood that both rooms name holds on.
- The mood cast over the world: `?mood` or the one the `cast_mood` WebMCP tool cast since, otherwise the fusion’s while any portal is open, otherwise that of the prop held or viewed with V (an orb’s). In the Forge, a held magic item also casts the mood of the orb it steers the alchemy machine to: helmet → Spook, hatchet → Horror, painting set → Atelier, palette knife → Impasto and pumpkin → Halloween. Picking one up there or entering while holding one fades its mood in; releasing it or leaving fades it out. Inspection alone does not activate these items. The mapping lives in `src/lib/gallery/alchemy/steering.ts`, shared with the machine. These take turns: the next one fades in only once the last one is gone.

`MoodMixer` (`lib/MoodMixer.ts`) stacks every mood showing, the room’s beneath the cast one, each at its own eased progress: gradient maps one over the other (four at most, the faintest left out beyond), screens over them in the same order, light tints multiplied, loops summed, the views’ degrees added up and transformers chained (six links, see `src/lib/audio/readme.md`). N under `?development` cuts every mood at once, the rooms’ included, and brings the ones due back in full when lifted. `?fade=false` (`src/lib/fade.ts`) makes every fade a hard cut, so captures taken right after the camera jumped to another room show it as it is: each mood shows in full or not at all from one frame to the next, the cast ones swap within a frame instead of taking turns, and their loops and transformers cut in and out along with them, as do the ambience emitters.

A screen can do more than fade with its mood: `MoodMixer` tells it every frame how far its mood has come, in uniforms it reads on the GPU, and where in the stack of the screens showing it draws, so a mood coming or going only changes uniforms:

| Uniform | What it tells |
| --- | --- |
| `strength` | The eased amount the color filters follow, 0–1. |
| `arrival` | The furthest the fade has come since the mood began showing, 0–1 and linear in time: it rises in step with the fade in and holds while the mood leaves, so whatever plays out along it, like strokes being painted, stays as it was. |
| `stay` | Seconds since the mood arrived in full, 0 until then, counted by the shaders’ `time`: whatever played out along `arrival` goes on along it without a seam for as long as the mood holds, like the strokes drying and being painted again. |
| `presence` | 1 until the mood leaves, then falling linearly to 0, for a way of going of its own, like the strokes drying away into bristle streaks. |

A mood asked back before it is gone picks up where it was instead of playing out anew. Under `?fade=false`, a screen shows nothing or the state it is in as its mood has just arrived, from which it goes on. Whatever a screen moves follows `stay` or TSL’s `time`, both of which stand still with the frozen world and under `?frozen_time`, so captures of the same view match.

To add a screen to a mood, subclass `MoodScreen` in the mood’s folder, build the frame’s color with the screen drawn over it in `draw`, and give the mood an instance as its `screen`; `moodScreens` in `index.ts` picks it up. To look at one without a held orb, `?mood=<id>` casts its mood for the whole session; `?mood=impasto&fade=false&frozen_time=0` shows the Impasto Orb’s vignette as it stands when its mood has arrived, every stroke laid and wet. The `cast_mood` WebMCP tool casts a mood or none at any time, which is how film recipes show one coming and going:

```json
[
  {"time": 0, "position": [-4.87, 4.71, -31.34], "yaw": -150, "pitch": -7.5, "fov": 50},
  {"time": 1, "tools": {"cast_mood": {"mood": "paint"}}},
  {"time": 21, "tools": {"cast_mood": {"mood": null}}},
  {"time": 23, "yaw": -150}
]
```

## Atelier

The Paint Orb (`paint`) casts Tide Lines (`paint/TideLines.ts`). A wet brush lays translucent washes in the corners of the view. Pigment gathers at their rims, and fresh water keeps blooming through them while the mood holds. The middle stays clear. The sound is the Atelier’s brushwork, palette scrapes and taps against the glass jar.

## Impasto

The mood of the Impasto Orb (`impasto`) leaves the world’s colors alone and paints a vignette over the view instead (`impasto/ImpastoScreen.ts`, its strokes in `impasto/vignetteStrokes.ts`). As it comes in, unseen brushes lay strokes of oil paint into the corners one after another, the dark ground first, earth tones over it and a few bright accents last, each behind the wet bead of paint the bristles push ahead. From then on the brushes never rest: every stroke goes matte and dries into bristle streaks from its far end back, and the brush comes back to lay it again over what is left of it, round after round, each stroke at a pace of its own, the broad ones more slowly. As the mood leaves, all of them dry away, the accents first and the ground last. The middle of the view stays clear on every screen from 4:3 to 21:9, which `test/unit/impasto-vignette.test.ts` checks along with the rounds. On an RX 9060 XT, it costs about 1.1 ms a frame at 2160p while it shows and nothing while it doesn’t.

Its own workshop ambience (`impasto/ImpastoAmbience.ts`) pairs palette-knife strokes on linen with stiff bristles and the flex of the steel blade.

## Blizzard

The Frost Orb’s mood (`frost`) turns the world to a winter night: deep blue shadows, cold pale lamps and a gradient map toward ice. Its screen (`frost/Hoarfrost.ts`) frosts the view over like a window pane. As the mood comes in, hoarfrost creeps in out of the corners, farthest there and thinly along the edges. Hair-thin ferns of ice rooted beyond the edges grow in toward the middle, densest toward the corners. Behind them the pane frosts over in a mottled crust grained with rime crystals, which appear one after another as the front reaches them and wash out the view behind. Now and then a facet glints. Snow blows across the view in gusts, slanting down with the wind: the far flakes fine and smeared into streaks, the nearest large and out of focus. While the mood holds, the frost’s front breathes a little. As it leaves, the frost melts back into the corners and the snow dies down. The middle of the view stays clear: nothing of the frost is worked out farther in than it reaches. Everything that takes screen derivatives is worked out outside the screen’s branches, where they are still defined.

Its ambience (`frost/FrostAmbience.ts`) is a blizzard round the walls: a deep roar of wind, two narrow drafts whistling up and down, gusts, the hiss of blown snow, ice crystals tinkling like wind chimes and, far off, the ice of a frozen lake singing as it cracks.
