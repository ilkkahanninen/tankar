import { Store } from "./Store";
import { TransactionInterface } from "./Transaction";

describe("Store", () => {
  describe("Dispatching", () => {
    it("Store state can be updated by dispatching patches", () => {
      const { store, history } = createStore(0);
      store.dispatch(add(5));
      store.dispatch(add(3));
      expect(history).toEqual([0, 5, 8]);
    });

    it("Dispatch functions can be declared using a convience function", async () => {
      const { store, history } = createStore(0);
      const addCounter = store.dispatchFn(add);
      addCounter(8);
      addCounter(-10);
      expect(history).toEqual([0, 8, -2]);
    });
  });

  describe("Transactions", () => {
    it("Updates the state according to the dispatched patches", async () => {
      const { store, history } = createStore(0);
      const { dispatch, done } = await createAsyncWorker(store);
      dispatch(add(5));
      dispatch(add(2));
      done();

      await until(() => store.hasSettled());

      expect(store.transactions.map((tx) => tx.state)).toEqual(["completed"]);
      expect(history).toEqual([0, 5, 7]);
    });

    it("Calling `replace` during a transaction resets the transaction's changes and starts patching from clean slate", async () => {
      const { store, history } = createStore(0);
      const { dispatch, replace, done } = await createAsyncWorker(store);
      dispatch(add(5));
      replace(add(13));
      done();

      await until(() => store.hasSettled());

      expect(store.transactions.map((tx) => tx.state)).toEqual(["completed"]);
      expect(history).toEqual([0, 5, 13]);
    });

    describe("Aborting a transaction", () => {
      it("Aborting transaction inside the worker code", async () => {
        const { store, history } = createStore("initial");
        const { dispatch, abortController } = await createAsyncWorker(store);
        dispatch(set("new value"));
        abortController.abort();

        await until(() => store.hasSettled());

        expect(store.transactions.map((tx) => tx.state)).toEqual(["aborted"]);
        expect(history).toEqual(["initial", "new value", "initial"]);
      });

      it("Aborting transaction using the returned abort function", async () => {
        const { store, history } = createStore("initial");
        const { dispatch, abort } = await createAsyncWorker(store);
        dispatch(set("new value"));
        abort();

        await until(() => store.hasSettled());

        expect(store.transactions.map((tx) => tx.state)).toEqual(["aborted"]);
        expect(history).toEqual(["initial", "new value", "initial"]);
      });
    });
  });
});

// Utils

const add = (a: number) =>
  function add(b: number) {
    return a + b;
  };

const set = (a: string) => (_: string) => a;

const eventually = async <T>(
  test: () => T,
  timeoutMs: number = 100
): Promise<T | null> => {
  let result: T | null = null;
  let error: any;
  try {
    await until(() => {
      try {
        result = test();
        return true;
      } catch (e) {
        error = e;
        return false;
      }
    }, timeoutMs);
  } catch (e) {
    throw error || e;
  }
  return result;
};

const until = (
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

const createStore = <T>(initial: T) => {
  const { subscriber, history } = createTestSubscriber<T>();
  const store = new Store(initial).subscribe(subscriber);
  return { store, history };
};

const createTestSubscriber = <T>() => {
  const history: T[] = [];
  return {
    history,
    subscriber: (state: T) => history.push(state),
  };
};

const createAsyncWorker = async <T>(store: Store<T>) => {
  let iface: TransactionInterface<T> | null = null;
  let done = false;

  const abort = store.startTransaction(async function asyncWorker(
    i: TransactionInterface<T>
  ) {
    iface = i;
    i.abortController.signal.addEventListener("abort", () => {
      done = true;
    });
    await until(() => done);
  });

  await until(() => iface !== null);
  return {
    ...iface!,
    abort,
    done: () => {
      done = true;
    },
  };
};
