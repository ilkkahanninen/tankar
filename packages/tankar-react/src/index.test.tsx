import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { Store } from "tankar";
import { useStore } from ".";

describe("chainstore-react", () => {
  it("Initializes", () => {
    initTestApp();
    expect(screen.queryByText("Counter: 0")).toBeInTheDocument();
  });

  it("Reacts to patches", () => {
    const { addButton, subtractButton } = initTestApp();

    fireEvent.click(addButton);
    expect(screen.queryByText("Counter: 1")).toBeInTheDocument();

    fireEvent.click(subtractButton);
    expect(screen.queryByText("Counter: 0")).toBeInTheDocument();
  });

  it("transacts", async () => {
    const { loadButton, resolveLoad } = initTestApp();

    expect(screen.queryByText("Counter: 0")).toBeInTheDocument();

    fireEvent.click(loadButton);
    expect(await screen.findByText("Counter: NaN")).toBeInTheDocument();

    act(() => resolveLoad(5));
    expect(await screen.findByText("Counter: 5")).toBeInTheDocument();
  });
});

const initTestApp = () => {
  const store = new Store(0);
  const addCounter = (b: number) => store.dispatch((a) => a + b);

  let resolveLoad: ((n: number) => void) | null = null;
  let rejectLoad: (() => void) | null = null;
  const numberLoading = new Promise<number>((resolve, reject) => {
    resolveLoad = resolve;
    rejectLoad = reject;
  });

  const loadNumber = () =>
    store.run(async () => {
      store.dispatch(() => NaN);
      const number = await numberLoading;
      store.dispatch(() => number);
    });

  const App = () => {
    const counter = useStore(store);

    return (
      <div>
        <span>Counter: {counter}</span>
        <button onClick={() => addCounter(-1)}>Subtract</button>
        <button onClick={() => addCounter(1)}>Add</button>
        <button onClick={() => loadNumber()}>Load</button>
      </div>
    );
  };

  render(<App />);

  return {
    addButton: screen.getByText("Add"),
    subtractButton: screen.getByText("Subtract"),
    loadButton: screen.getByText("Load"),
    resolveLoad: resolveLoad!,
    rejectLoad: rejectLoad!,
  };
};
