# Moods

A mood (`base/Mood.ts`) is a spell over the whole world while something casts it. Every mood lives in a folder of its own, `src/moods/<id>`, with whatever only it needs, like its ambience, and `index.ts` holds one of each by its id, which is how everything else refers to them: rooms name `mood: 'bastion'`, orbs `mood: 'horror'`, and `?mood` takes any of the ids.

A mood contributes any of four kinds of transformation, all optional, all fading in and out together at the mood’s strength:

| Kind | Members | Where it applies |
| --- | --- | --- |
| Color filters | `grade`, `lamps`, `fill` | `src/lib/rendering/moodGrade.ts` lays the gradient map over the finished frame after `renderOutput`; `lightLevels.ts` multiplies every light’s color by the tint of its kind. |
| Ambience | `ambience` | A centered `AmbienceLoop` class, made anew each time the mood begins, on the effects master. |
| Sound transformer | `transformer` | A `SoundTransformer` in `SoundEngine.transformers`, which every sound of the world passes through, like a room’s `reverberation`. |
| View | `fov` | Degrees the player’s own view gets wider by, or narrower where negative, like the Corridor’s 10°. `lib/MoodLens.ts` adds them to the camera’s field of view only while the view is drawn, each frame and every capture of one, so the zoom, V-viewing and the tuning panel never see them; zooming in gives them up along the way, and a camera taken from the player, like V-viewing’s, a bookmark’s or a capture’s, keeps its own. |

Two things cast moods, both asked for by `#component/Moods` every frame:

- The room the player is in, through its `mood` option, the id of a `RoomMood` (`base/RoomMood.ts`), usually the room’s own with its acoustics. Room moods come and go in 0.5 s both ways (`roomMoodFade`), so two rooms’ moods cross over evenly in a doorway, and a mood that both rooms name holds on.
- The mood cast over the world: `?mood`, otherwise the fusion’s while any portal is open, otherwise that of the prop held or viewed with V (an orb’s, or a magic item’s in the Forge, where it casts that of the orb it belongs to — see `lib/propMood.ts`). These take turns: the next one fades in only once the last one is gone.

`MoodMixer` (`lib/MoodMixer.ts`) stacks every mood showing, the room’s beneath the cast one, each at its own eased progress: gradient maps one over the other (four at most, the faintest left out beyond), light tints multiplied, loops summed, the views’ degrees added up and transformers chained (six links, see `src/lib/audio/readme.md`). N under `?development` cuts every mood at once, the rooms’ included, and brings the ones due back in full when lifted. `?fade=false` (`src/lib/fade.ts`) makes every fade a hard cut, so captures taken right after the camera jumped to another room show it as it is: each mood shows in full or not at all from one frame to the next, the cast ones swap within a frame instead of taking turns, and their loops and transformers cut in and out along with them, as do the ambience emitters.
