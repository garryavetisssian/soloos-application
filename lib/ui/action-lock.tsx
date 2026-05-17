"use client";

// App-wide single-action lock.
//
// Goal: only ONE mutating action is in flight across the whole app at
// any time. Prevents weird double-actions (re-check + delete fired
// at once, generate + translate stacking, etc.) and keeps the UI in
// a predictable state.
//
// Usage in a component:
//   const { run, isLocked } = useActionLock();
//   <button
//     onClick={() => run(async () => {
//       const r = await someServerAction(...);
//       if (r.ok) toast.success("Done");
//     })}
//     disabled={isLocked}
//   >…</button>
//
// `run` is a no-op if the lock is already held — the second click is
// silently ignored. `isLocked` is reactive so every button in the app
// can disable while something is running.
//
// Safety nets (added after a "buttons not clickable" bug):
//   - SAFETY_TIMEOUT_MS — every action gets a hard ceiling. If the
//     wrapped function doesn't resolve OR reject inside this window,
//     the lock is force-released so the UI doesn't permanently dead-end.
//   - Route-change reset — navigating to a different URL clears the
//     lock unconditionally. A stuck action from a previous page never
//     follows the user across routes.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";

// Hard cap on how long any single action can hold the lock. Real AI
// generations finish in under 30s; even with the fallback model retry
// and a slow client, 60s is generous. Anything beyond that is treated
// as a hung action and the lock is force-released.
const SAFETY_TIMEOUT_MS = 60_000;

interface ActionLockContextValue {
  isLocked: boolean;
  /**
   * Acquire the lock, run the function, release on success or failure.
   * Returns the function's return value, or undefined if the lock was
   * already held (the second caller is silently ignored).
   */
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

const ActionLockContext = createContext<ActionLockContextValue | null>(null);

export function ActionLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setLocked] = useState(false);
  // Mirror the state in a ref so concurrent calls inside the same
  // render cycle (e.g. two click handlers firing within ms of each
  // other) see the lock as held without waiting for the React update.
  const lockedRef = useRef(false);
  // Track the active timeout so we can clear it on a clean release
  // and not stomp a fresh action with a stale safety-timer.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset helper — used by the safety timeout and the route-change
  // effect. Idempotent.
  const release = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (lockedRef.current) {
      lockedRef.current = false;
      setLocked(false);
    }
  }, []);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
      if (lockedRef.current) return undefined;
      lockedRef.current = true;
      setLocked(true);

      // Safety timeout — if the action doesn't resolve in the budget,
      // force-release so the UI stays usable. Logs a warning in dev so
      // we notice the offending action.
      timeoutRef.current = setTimeout(() => {
        console.warn(
          `[useActionLock] action exceeded ${SAFETY_TIMEOUT_MS}ms — force-releasing the lock.`,
        );
        release();
      }, SAFETY_TIMEOUT_MS);

      try {
        return await fn();
      } finally {
        release();
      }
    },
    [release],
  );

  // Route-change reset. The pathname dependency makes this effect re-
  // run whenever the user navigates to a different page. Belt-and-
  // suspenders: even if `release` somehow doesn't fire, navigating
  // away from a stuck page clears the lock.
  const pathname = usePathname();
  useEffect(() => {
    if (lockedRef.current) {
      release();
    }
    // Cleanup on unmount: clear any pending safety timeout.
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pathname, release]);

  return (
    <ActionLockContext.Provider value={{ isLocked, run }}>
      {children}
    </ActionLockContext.Provider>
  );
}

export function useActionLock(): ActionLockContextValue {
  const ctx = useContext(ActionLockContext);
  if (!ctx) {
    throw new Error("useActionLock must be used within an ActionLockProvider");
  }
  return ctx;
}
