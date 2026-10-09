// A synchronous guard against a second call starting while one is already
// running. The flag is read and set before any await, so two calls made in
// the same tick — like a fast double-click on a submit or confirm button —
// can't both get through: the first call runs as normal, and any other call
// made while it's still in flight returns null immediately, without even
// calling fn. This has to be synchronous (a plain boolean, not React state)
// because a disabled-while-busy button only takes effect after a render,
// which is too late to stop a second click made in the same tick.
export function createInFlightGuard() {
  let inFlight = false;

  return async function guard<T>(fn: () => Promise<T>): Promise<T | null> {
    if (inFlight) {
      return null;
    }
    inFlight = true;
    try {
      return await fn();
    } finally {
      inFlight = false;
    }
  };
}

export type InFlightGuard = ReturnType<typeof createInFlightGuard>;
