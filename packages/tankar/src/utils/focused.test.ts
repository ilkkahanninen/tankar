import { focused } from "./focused";
import { createStore, until } from "./testUtils";

const initialState: State = { appVersion: 1 };

type State = {
  appVersion: number;
  user?: User;
};

type User = {
  username: string;
  password: string;
};

const getUser = (state: State): User | undefined => state.user;
const setUser =
  (user?: User) =>
  (state: State): State => ({ ...state, user });

describe("Focused transactions", () => {
  it("Updates a nested property", async () => {
    const { store, history } = createStore(initialState);

    store.run(
      focused(getUser, setUser, ({ dispatch }) => {
        dispatch(() => ({ username: "johndoe", password: "hunter2" }));
        dispatch((user) =>
          user ? { ...user, password: "newpassword2022" } : undefined
        );
        dispatch(() => undefined);
      })
    );

    await until(() => store.hasSettled());

    expect(history).toEqual([
      { appVersion: 1 },
      { appVersion: 1, user: { username: "johndoe", password: "hunter2" } },
      {
        appVersion: 1,
        user: { username: "johndoe", password: "newpassword2022" },
      },
      { appVersion: 1 },
    ]);
  });
});
