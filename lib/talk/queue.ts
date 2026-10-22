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
