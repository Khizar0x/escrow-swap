import { describe, expect, it, vi } from "vitest";
import { createInFlightGuard } from "./inFlightGuard";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("createInFlightGuard", () => {
  it("runs a second call made while the first is still running, not at all", async () => {
    const guard = createInFlightGuard();
    const first = deferred<string>();
    const fn = vi.fn(() => first.promise);

    const firstCall = guard(fn);
    const secondCall = guard(fn); // made synchronously, before the first resolves

    expect(fn).toHaveBeenCalledTimes(1);

    first.resolve("done");
    await expect(firstCall).resolves.toBe("done");
    await expect(secondCall).resolves.toBeNull();
  });

  it("allows a new call once the previous one has finished", async () => {
    const guard = createInFlightGuard();
    await guard(async () => "one");
    const second = await guard(async () => "two");
    expect(second).toBe("two");
  });

  it("clears the guard even when the call throws, so the next call can still proceed", async () => {
    const guard = createInFlightGuard();
    await expect(
      guard(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const next = await guard(async () => "ok");
    expect(next).toBe("ok");
  });

  it("two separate guards don't block each other", async () => {
    const guardA = createInFlightGuard();
    const guardB = createInFlightGuard();
    const pending = deferred<string>();

    const a = guardA(() => pending.promise);
    const b = await guardB(async () => "b-done");

    expect(b).toBe("b-done");
    pending.resolve("a-done");
    await expect(a).resolves.toBe("a-done");
  });
});
