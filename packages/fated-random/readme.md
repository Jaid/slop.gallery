# fated-random

Random rolls that are decided in advance. A roll only depends on a seed, a chain of IDs and an index, never on when, how often or in which order something rolls, so a world built from a seed comes out the same every time, however its parts load.

```typescript
import FatedRandom from 'fated-random'

const random = new FatedRandom({
  id: 'slop-gallery',
  seed: 123,
})

const vesperRandom = random.makeChild(['vesper', 'orbs'])
const orbIds = vesperRandom.rollItem(['ghost', 'halloween', 'painting'], {count: 4})

random.roll() // a float from 0 up to, but not including, 1
random.rollBoolean() // true or false
random.rollInteger(5) // an integer from 0 to 5
random.rollInteger(1, 10) // an integer from 1 to 10
random.rollItems(['apple', 'banana', 'cherry'], 2, {count: 5}) // 5 arrays of 2 different items each
random.rollRadius(2) // a float from −2 up to, but not including, 2
random.rollIntegerRadius(2) // −2, −1, 0, 1 or 2
random.next() // moves on to the next index, which rolls everything anew
```

No dependencies, no global state and no `Math.random()`. It is not meant for cryptography.

## Ingredients

Every roll is made from the same ingredients:

- the `seed`: a number, a string or a `Uint8Array`, or none at all. It is what all rolls of a game, a world or a session share.
- the chain of IDs: the `id` of the constructor, one or several, followed by those of every `makeChild`. An ID is a number or a string and names what is rolled for.
- the index, which is 0 until `next()` moves on.

In the example above, `vesperRandom` rolls from `'slop-gallery'`, `'vesper'`, `'orbs'`, `123` and `0`.

Each ingredient counts on its own, so `['ab', 'c']` and `['a', 'bc']` are different chains, an ID never stands in for a seed, and bytes never equal a string. A number counts as its decimal text, so the ID `7` is the ID `'7'` and the seed `123` is the seed `'123'`, like a seed read from a URL.

## Rolling

Without `next()`, a roll returns the same result forever. The methods share their numbers, so `rollBoolean()` is `roll() < 0.5` and `rollItem(items)` is the item at `rollInteger(items.length - 1)`. Whatever needs rolls of its own gets a child or moves on with `next()`.

Every method takes `count` as an option and then returns an array of that many results rolled in a row, the first of which is the result without `count`.

| Method | Returns |
| --- | --- |
| `roll(options?)` | a float from 0 up to, but not including, 1, with all 53 bits a float holds |
| `rollBoolean(options?)` | `true` or `false`; `chance` (0–1, default 0.5) says how likely `true` is |
| `rollInteger(limit, options?)` | an integer from 0 to `limit`, both included |
| `rollInteger(from, to, options?)` | an integer between `from` and `to`, both included, in either order |
| `rollIntegerRadius(radius, options?)` | an integer from −`radius` to `radius`, both included |
| `rollRadius(radius, options?)` | a float from −`radius` up to, but not including, `radius` |
| `rollItem(items, options?)` | one of the items, typed as the union of a literal array’s items |
| `rollItems(items, amount, options?)` | an array of `amount` different items |

Integers are rolled without modulo bias. `rollItem` and `rollItems` take `weights`, either a number per item or a function `(item, index) => number`, which make an item as likely as its share of all weights; an item of weight 0 is never rolled. `rollItems` returns the items in the order they were rolled in, so rolling as many as there are shuffles them, unless `keepOrder` keeps the order they have among `items`.

```typescript
const rarity = random.makeChild('rarity').rollItem(['common', 'rare', 'epic'], {weights: [16, 4, 1]})
const toppings = random.makeChild('toppings').rollItems(['basil', 'garlic', 'olives', 'onions'], 2, {keepOrder: true})
```

## Children

`makeChild(id)` returns another `FatedRandom` of the same seed with the given IDs after its parent’s. Several IDs at once make the same child as one child after the other, so `random.makeChild(['vesper', 'orbs'])` is `random.makeChild('vesper').makeChild('orbs')`.

A child starts at index 0, whatever the index of its parent, so it only depends on its IDs and never on when it was made. To give every round, wave or item rolls of its own, make it an ID:

```typescript
const waveRandom = random.makeChild(['wave', waveNumber])
```

`ids`, `seed` and `index` tell what an instance rolls from.

## Stability

The same ingredients roll the same results on every machine and in every runtime. A test pins them, as saved seeds rely on them; an update that changes them is a breaking one.

The ingredients are hashed to 128 bits with [cyrb128](https://github.com/bryc/code/blob/master/jshash/PRNGs.md), from which [sfc32](https://pracrand.sourceforge.net/RNG_engines.txt) draws the numbers of a roll.
