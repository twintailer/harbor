/** Bound the entire operation, including bridges that don't consume AbortSignal. */
export function withDeadline<T>(operation: Promise<T>, milliseconds = 12000, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => finish(() => reject(signal?.reason ?? new DOMException("Request cancelled", "AbortError")));
    const timer = setTimeout(() => finish(() => reject(new DOMException("Request timed out", "TimeoutError"))), milliseconds);
    const finish = (settle: () => void) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      settle();
    };
    operation.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
  });
}
