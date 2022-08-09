import { Config } from "../config";
import { Deferred } from "../Deferred";
import { Store } from "../Store";
import { TransactionInterface } from "../Transaction";
import { RecursivePartial } from "../utils";

export const add = (a: number) =>
  function add(b: number) {
    return a + b;
  };

export const set =
  <T>(a: T) =>
  (_: T) =>
    a;

export const until = (
  condition: () => boolean,
  timeoutMs: number = 100
): Promise<void> =>
  new Promise((resolve, reject) => {
    const startTime = new Date().getTime();
    const testCondition = () => {
      if (startTime + timeoutMs >= new Date().getTime()) {
        if (condition()) {
          resolve();
        } else {
          setTimeout(testCondition, 0);
        }
      } else {
        reject(`Timeout (${timeoutMs} ms)`);
      }
    };
    testCondition();
  });

export const createStore = <T>(
  initial: T,
  config: RecursivePartial<Config> = {}
) => {
  const { subscriber, history } = createTestSubscriber<T>();
  const store = new Store(initial, config).subscribe(subscriber);
  return { store, history };
};

export const createTestSubscriber = <T>() => {
  const history: T[] = [];
  return {
    history,
    subscriber: (state: T) => history.push(state),
  };
};

export const createAsyncWorker = async <T>(store: Store<T>) => {
  let iface: TransactionInterface<T> | null = null;
  const txInitialized = new Deferred();
  const txCanFinish = new Deferred();
  const txHasFinished = new Deferred();

  const abort = store.run(async function asyncWorker(
    i: TransactionInterface<T>
  ) {
    iface = i;
    i.abortController.signal.addEventListener("abort", () => {
      txCanFinish.resolve();
    });
    txInitialized.resolve();
    await txCanFinish.promise;
    txHasFinished.resolve();
  });

  await txInitialized.promise;

  return {
    ...iface!,
    abort,
    done: async () => {
      txCanFinish.resolve();
      await txHasFinished.promise;
    },
  };
};
