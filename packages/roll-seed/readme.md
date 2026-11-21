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

Integers wrap every 65 536 values. Signed decimal integer strings wrap exactly, even when too large for a JavaScript `number`. Other text, non-integer numbers and bytes (`Uint8Array` or `ArrayBuffer`) seed a roll with `fated-random`. A byte view uses only the bytes it covers.
