import { WorkerFn } from "../Store";
import { Patch, TransactionInterface } from "../Transaction";

export function focused<S, V>(
  get: (state: S) => V,
  set: (value: V) => (state: S) => S,
  worker: WorkerFn<V>
): WorkerFn<S> {
  const bind = bindFocusWith(get, set);
  return (a: TransactionInterface<S>): Promise<void> | void => {
    worker({
      dispatch: bind(a.dispatch),
      replace: bind(a.replace),
      abortController: a.abortController,
      settledState: a.settledState.then(get),
    });
  };
}

function bindFocusWith<S, V>(
  get: (state: S) => V,
  set: (value: V) => (state: S) => S
) {
  return (fn: (...fs: Patch<S>[]) => void) =>
    (...fs: Patch<V>[]) => {
      return fn(
        ...fs.map((patch) => (state: S) => set(patch(get(state)))(state))
      );
    };
}
