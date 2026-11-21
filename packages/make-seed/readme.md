# roll-seed

`rollSeed()` returns a uniformly random integer from 1 through 65 536 inclusive, using one 16-bit draw from Web Crypto. Pass an input for a repeatable seed instead.

```ts
import rollSeed from 'roll-seed'

rollSeed(42)                 // 42
rollSeed('65537')            // 1
rollSeed(0)                  // 65536
rollSeed('Hanover')          // always the same seed for this text
rollSeed(Uint8Array.of(42))  // always the same seed for these bytes
```

Integers wrap every 65 536 values. Signed decimal integer strings wrap exactly, even when too large for a JavaScript `number`. Other text, non-integer numbers and bytes (`Uint8Array` or `ArrayBuffer`) are hashed with MurmurHash3 (x86, 32-bit) and folded into 16 bits, which spreads them evenly over the range. Text is hashed as UTF-8 and a non-integer number as its text, so `2.5` gives the seed of `'2.5'`. Text and bytes use different hash seeds, so a string never gives the seed of its own UTF-8 bytes. A byte view uses only the bytes it covers.

There are no dependencies. Hashed seeds are pinned by a test, as saved seeds rely on them, so an update that changes them is a breaking one.
