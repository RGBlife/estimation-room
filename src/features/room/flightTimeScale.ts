// Stretches the paper aeroplane's flight for inspection in the dev harness.
//
// Its own module rather than an export from ThrowOverlay.tsx: that file
// exports a component, and mixing component and non-component exports breaks
// React Fast Refresh for the whole file.
//
// Always 1 in the app itself -- only src/dev calls the setter -- so the
// multiplication in the flight loop is a no-op in production.
let scale = 1;

export function setFlightTimeScale(next: number) {
  scale = Math.max(1, next);
}

export function flightTimeScale() {
  return scale;
}
