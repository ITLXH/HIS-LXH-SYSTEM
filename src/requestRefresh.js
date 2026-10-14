// Serialize refreshes and keep one trailing refresh when events arrive during a read.
// Callers share the promise for the complete burst, including its trailing read.
export function createCoalescedRefresh(task, { delayMs = 150, shouldRun = () => true } = {}) {
  let pending = null;
  let again = false;
  let latestArgs = [];
  let latestThis;
  return function (...args) {
    latestArgs = args;
    latestThis = this;
    if (pending) {
      again = true;
      return pending;
    }
    pending = (async () => {
      let result;
      do {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        again = false;
        if (!shouldRun()) return;
        result = await task.apply(latestThis, latestArgs);
      } while (again);
      return result;
    })().finally(() => { pending = null; });
    return pending;
  };
}
