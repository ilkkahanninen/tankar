import { useEffect, useState } from "react";
import type { Store, Subscriber } from "../../tankar/lib";

export type Selector<T, S> = (t: T) => S;

export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, select: Selector<T, S>): S;

export function useStore<T, S>(
  store: Store<T>,
  select: Selector<T, T | S> = identity
): any {
  const [state, setState] = useState(select(store.currentState));

  useEffect(() => {
    const setter: Subscriber<T> = (state: T) => setState(select(state));
    store.subscribe(setter);
    return () => {
      store.unsubscribe(setter);
    };
  }, [select]);

  return state;
}

function identity<T>(t: T): T {
  return t;
}
