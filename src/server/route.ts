import { asJson, assertOrigin } from "@/server/http";

export function apiGet<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return asJson(error);
    }
  };
}

export function apiPost<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<Response>,
) {
  return async (request: Request, ...args: Args) => {
    try {
      assertOrigin(request);
      return await handler(request, ...args);
    } catch (error) {
      return asJson(error);
    }
  };
}
