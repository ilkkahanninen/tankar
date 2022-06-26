import { TransactionInterface } from "tankar";

export type Resource<K extends string, T, E> =
  | NilResource<K>
  | LoadingResource<K>
  | CompleteResource<K, T>
  | FailedResource<K, E>
  | AbortedResource<K>
  | ThrownResource<K>;

export type NilResource<K extends string> = {
  kind: K;
};

export type LoadingResource<K extends string> = {
  kind: K;
  isLoading: true;
};

export type CompleteResource<K extends string, T> = {
  kind: K;
  data: T;
};

export type FailedResource<K extends string, E> = {
  kind: K;
  error: E;
};

export type AbortedResource<K extends string> = {
  kind: K;
  aborted: true;
};

export type ThrownResource<K extends string> = {
  kind: K;
  thrown: any;
};

export type ResourceTransactionInterface<T, E> = {
  reject: (error: E) => void;
  abortController: AbortController;
};

export const isKind =
  <K extends string>(kind: K) =>
  <T, E>(resource: Resource<K, T, E>): boolean =>
    resource.kind === kind;

export const isLoading = <K extends string, T, E>(
  resource: Resource<K, T, E>
): resource is LoadingResource<K> =>
  (resource as LoadingResource<K>).isLoading === true;

export const isComplete = <K extends string, T, E>(
  resource: Resource<K, T, E>
): resource is CompleteResource<K, T> =>
  (resource as CompleteResource<K, T>).data !== undefined;

export const isFailed = <K extends string, T, E>(
  resource: Resource<K, T, E>
): resource is FailedResource<K, E> =>
  (resource as FailedResource<K, E>).error !== undefined;

export const isAborted = <K extends string, T, E>(
  resource: Resource<K, T, E>
): resource is AbortedResource<K> =>
  (resource as AbortedResource<K>).aborted === true;

export const isThrown = <K extends string, T, E>(
  resource: Resource<K, T, E>
): resource is ThrownResource<K> =>
  (resource as ThrownResource<K>).thrown !== undefined;

export const getData = <K extends string, T, E>(
  resource: Resource<K, T, E>
): T | undefined => (isComplete(resource) ? resource.data : undefined);

export const getGracefulError = <K extends string, T, E>(
  resource: Resource<K, T, E>
): E | undefined => (isFailed(resource) ? resource.error : undefined);

export const getUnexpectedError = <K extends string, T, E>(
  resource: Resource<K, T, E>
): any => (isThrown(resource) ? resource.thrown : undefined);

export const emptyResource = <K extends string>(kind: K): NilResource<K> => ({
  kind,
});

export const resource =
  <K extends string, T, E>(
    kind: K,
    getData: (
      iface: ResourceTransactionInterface<T, E>
    ) => Promise<T | undefined>
  ) =>
  async ({
    dispatch,
    abortController,
  }: TransactionInterface<Resource<K, T, E>>) => {
    const set = stateSetter(kind);

    dispatch(set({ isLoading: true }));
    abortController.signal.addEventListener("abort", () =>
      dispatch(set({ aborted: true }))
    );

    try {
      const data = await getData({
        reject(error) {
          dispatch(set({ error }));
        },
        abortController,
      });
      if (data !== undefined) {
        dispatch(set({ data }));
      }
    } catch (error) {
      dispatch(set({ thrown: error }));
    }
  };

const stateSetter =
  <K extends string>(kind: K) =>
  <T, E>(resource: Omit<Resource<K, T, E>, "kind">) =>
  (): Resource<K, T, E> => ({ kind, ...resource });
