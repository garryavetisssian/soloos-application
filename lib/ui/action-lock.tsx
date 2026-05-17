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

import { createContext, useCallback, useContext, useRef, useState } from "react";

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

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockedRef.current) return undefined;
    lockedRef.current = true;
    setLocked(true);
    try {
      return await fn();
    } finally {
      lockedRef.current = false;
      setLocked(false);
    }
  }, []);

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
