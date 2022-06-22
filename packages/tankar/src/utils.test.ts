import { recursiveMerge, RecursivePartial, splitWhen } from "./utils";

describe("Utils", () => {
  it("recursiveMerge works", () => {
    type State = {
      name: string;
      author: {
        name: string;
        city: string;
      };
    };

    const past: State = {
      name: "Chainstore",
      author: {
        name: "Ilkka Hänninen",
        city: "Kokkola",
      },
    };

    const present: RecursivePartial<State> = {
      name: "Tankar",
      author: {
        city: "Helsinki",
      },
    };

    expect(recursiveMerge(past, present)).toEqual({
      name: "Tankar",
      author: {
        name: "Ilkka Hänninen",
        city: "Helsinki",
      },
    });
  });

  describe("splitWhen", () => {
    const arr = [0, 1, 2, 3, 4];
    it("splits at beginning", () => {
      expect(splitWhen((n) => n === 0, arr)).toEqual([[], [0, 1, 2, 3, 4]]);
    });
    it("splits at middle", () => {
      expect(splitWhen((n) => n === 3, arr)).toEqual([
        [0, 1, 2],
        [3, 4],
      ]);
    });
    it("splits at end", () => {
      expect(splitWhen((n) => false, arr)).toEqual([[0, 1, 2, 3, 4], []]);
    });
  });
});
