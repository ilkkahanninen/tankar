import {
  AbortedResource,
  CompleteResource,
  emptyResource,
  FailedResource,
  LoadingResource,
  NilResource,
  resource,
} from "./Resource";

export const FetchKind = "fetch";
export type FetchKind = typeof FetchKind;

export type FetchError<E> = {
  status: number;
  statusText: string;
  response: E;
};

export type FetchResource<T, E> =
  | NilFetchResource
  | LoadingFetchResource
  | CompleteFetchResource<T>
  | FailedFetchResource<E>
  | AbortedFetchResource;

export type NilFetchResource = NilResource<FetchKind>;
export type LoadingFetchResource = LoadingResource<FetchKind>;
export type CompleteFetchResource<T> = CompleteResource<FetchKind, T>;
export type FailedFetchResource<E> = FailedResource<FetchKind, E>;
export type AbortedFetchResource = AbortedResource<FetchKind>;

export const emptyFetchResource: NilFetchResource = emptyResource("fetch");

export const fetchResource = <T, E>(
  input: RequestInfo | URL,
  init?: RequestInit,
  responseResolver: (resp: Response) => Promise<T> = jsonResolver,
  errorResponseResolver: (resp: Response) => Promise<E> = jsonResolver
) =>
  resource<FetchKind, T, FetchError<E>>(
    FetchKind,
    async ({ reject, abortController }) => {
      try {
        const response = await fetch(input, {
          ...init,
          signal: abortController.signal,
        });
        if (response.ok) {
          return responseResolver(response);
        } else {
          reject({
            status: response.status,
            statusText: response.statusText,
            response: await errorResponseResolver(response),
          });
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          throw e;
        }
      }
    }
  );

export const jsonResolver = <T>(response: Response): Promise<T> =>
  response.json() as any as Promise<T>;

export const textResolver = <T extends string>(
  response: Response
): Promise<T> => response.text() as Promise<T>;
