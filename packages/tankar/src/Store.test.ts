import { Config } from "./config";
import { Deferred } from "./Deferred";
import { Store } from "./Store";
import { TransactionInterface } from "./Transaction";
import { RecursivePartial } from "./utils";

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

      expect(history).toEqual([0, 5, 7]);
    });

    it("Calling `replace` during a transaction resets the transaction's changes and starts patching from clean slate", async () => {
      const { store, history } = createStore(0);
      const { dispatch, replace, done } = await createAsyncWorker(store);
      dispatch(add(5));
      replace(add(13));
      done();

      await until(() => store.hasSettled());

      expect(history).toEqual([0, 5, 13]);
    });

    describe("Aborting a transaction", () => {
      it("Aborting transaction inside the worker code", async () => {
        const { store, history } = createStore("initial");
        const { dispatch, abortController } = await createAsyncWorker(store);
        dispatch(set("new value"));
        abortController.abort();

        await until(() => store.hasSettled());

        expect(store.transactions.map((tx) => tx.state)).toEqual([]);
        expect(history).toEqual(["initial", "new value", "initial"]);
      });

      it("Aborting transaction using the returned abort function", async () => {
        const { store, history } = createStore("initial");
        const { dispatch, abort } = await createAsyncWorker(store);
        dispatch(set("new value"));
        abort();

        await until(() => store.hasSettled());

        expect(store.transactions.map((tx) => tx.state)).toEqual([]);
        expect(history).toEqual(["initial", "new value", "initial"]);
      });
    });

    describe("Requesting the store state inside a worker", () => {
      it("Requesting prior settled state", async () => {
        const { store, history } = createStore("initial");

        const longProcess = new Deferred();
        store.startTransaction(async ({ dispatch }) => {
          dispatch(set("started"));
          await longProcess.promise;
          dispatch(set("completed"));
        });

        const waiting = new Deferred();
        store.startTransaction(async ({ dispatch, settledState }) => {
          dispatch(set("waiting"));
          waiting.resolve();
          const state = await settledState; // Tää ei nyt etene tästä, tutki mikä vikana.... :---(
          dispatch(set(`got state: ${state}`));
        });

        await waiting.promise;
        longProcess.resolve();
        await until(() => store.hasSettled());

        expect(history).toEqual([
          "initial",
          "started", // First worker: dispatch(set("started"));
          "waiting", // Second worker: dispatch(set("waiting"));
          "waiting", // First worker: dispatch(set("completed"));
          "got state: completed", // Second worker: dispatch(set(`got state: ${state}`));
        ]);
      });
    });
  });

  describe("State reliability", () => {
    it("Keeps history correct before and after compaction ", async () => {
      const { store, history } = createStore("Initial");
      const { dispatch, done } = await createAsyncWorker(store);

      dispatch(set("Transaction started"));
      store.dispatch(set("Patched"));
      dispatch(set("Transaction ended"));

      expect(history).toEqual([
        "Initial",
        "Transaction started",
        "Patched",
        "Patched", // "Patched" is newer than async worker in the transaction list
      ]);

      expect(store.settledState).toEqual("Initial");
      expect(store.transactions.length).toEqual(2);

      // The state will not compact yet because the async worker is still running
      store.compact();
      expect(store.transactions.length).toEqual(2);

      // Complete worker, the state should compact to empty transaction list
      await done();
      store.compact();
      expect(store.transactions).toEqual([]);
      expect(store.settledState).toEqual("Patched");
    });
  });

  it("Compacts state automatically", () => {
    const { store, history } = createStore(0);

    for (let i = 0; i < 8; i++) {
      store.dispatch(add(1));
    }

    expect(history).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(store.settledState).toEqual(8);
    expect(store.transactions.length).toEqual(0);
  });
});

describe("Sync two stores", () => {
  it("Generate updates to a store from another store with a long running transaction", async () => {
    const counter = new Store(0);
    const { store: tensAccumulator, history } = createStore(NaN);

    const bridge = (count: number) => {
      if (count % 10 === 0) {
        tensAccumulator.dispatch(() => count);
      }
    };

    counter.subscribe(bridge);
    counter.startTransaction(({ replace }) => {
      for (let i = 1; i <= 100; i++) {
        replace(set(i));
      }
    });

    await until(() => counter.hasSettled());

    expect(history).toEqual([NaN, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });
});

// Utils

const add = (a: number) =>
  function add(b: number) {
    return a + b;
  };

const set =
  <T>(a: T) =>
  (_: T) =>
    a;

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

const createStore = <T>(initial: T, config: RecursivePartial<Config> = {}) => {
  const { subscriber, history } = createTestSubscriber<T>();
  const store = new Store(initial, config).subscribe(subscriber);
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
  const txInitialized = new Deferred();
  const txCanFinish = new Deferred();
  const txHasFinished = new Deferred();

  const abort = store.startTransaction(async function asyncWorker(
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
