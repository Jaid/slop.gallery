# telemethree-ego

Player position, velocity and aim metrics for a `victoria-browser-client`.

```tsx
import useEgoTelemetry from 'telemethree-ego/react'

useEgoTelemetry({
  telemetry,
  intervalMs: 0,
  read: () => ({
    position: player.position,
    velocity: player.velocity,
    aim: {origin: cameraPosition, direction: cameraDirection},
  }),
  readAimHit: () => inspector.getAim().hit,
})
```

The framework-independent `EgoTelemetry` accepts the same options. Call `update()` each frame. `intervalMs` defaults to 1000; zero records every update. `read` should only read cheap position, velocity and aim vectors. The expensive `readAimHit` callback has its own `aimHitIntervalMs` cadence (1000 by default). The React hook samples at frame finish, skips hidden pages and resets on visibility changes.

`ego.position.x/y/z` measure world-space feet position in meters and `ego.velocity.x/y/z` measure physical velocity in meters per second. `ego.aim.yaw` and `ego.aim.pitch` describe viewing rotation in radians, with zero facing −Z, positive yaw toward −X and positive pitch upward. Aim origin/direction, speed and validity flags share the frame cadence. Hit, distance and hit-point metrics use the slower raycast cadence. All components of a frame share one capture timestamp, and coordinates are values, never labels.

`record(sample, monotonicTimeMs?)` and `recordAimHit(hit)` bypass their respective cadence gates for externally scheduled sampling. Browser delivery and lifecycle are owned by the Victoria client. Every frame is retained as a separate observation until delivery; native Victoria timestamps have millisecond precision. Size the client’s bounded outbox for the frame rate and delivery interval: each frame emits 17 observations, so the default 2048-item queue is too small for a one-second interval at high refresh rates.
