/**
 * Runs async jobs one at a time in the order they were added, so a second sentence never overtakes the first.
 * clear() drops the jobs still waiting and tells the running one it is stale (via isCurrent()).
 */
export function createSerialQueue() {
  let tail: Promise<void> = Promise.resolve();
  let generation = 0;
  let pending = 0;

  function push(job: (isCurrent: () => boolean) => Promise<void> | void): Promise<void> {
    const gen = generation;
    const isCurrent = () => gen === generation;
    pending++;
    const run = tail.then(async () => {
      try { if (isCurrent()) await job(isCurrent); } catch { /* a failed job must not block the next one */ } finally { pending--; }
    });
    tail = run;
    return run;
  }

  return {
    push,
    /** Jobs waiting or running. */
    size: () => pending,
    clear() { generation++; },
  };
}

/** At most `max` async jobs running at once; the rest wait in order. Used to start speech-to-text early (pipelining). */
export function createLimiter(max: number) {
  let running = 0;
  const waiting: (() => void)[] = [];
  const next = () => { running--; waiting.shift()?.(); };
  return {
    run<T>(job: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const go = () => { running++; job().then(resolve, reject).finally(next); };
        if (running < max) go(); else waiting.push(go);
      });
    },
    active: () => running + waiting.length,
  };
}
