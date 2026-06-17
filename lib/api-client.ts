import { BASE_PATH } from "@/lib/constants";

/**
 * Tiny fetch wrapper for client-side API calls used with TanStack Query.
 *
 * React Query wants query/mutation functions to *throw* on failure so the
 * error lands in `isError`/`error` state. This wrapper does that, prepends
 * the app BASE_PATH, and lets callers pass a JSON body via the `json` option
 * instead of manual `JSON.stringify` + Content-Type headers.
 *
 * Usage:
 *   // GET
 *   apiFetch<ApiResponse>(`/api/trash?entity=alumni&page=1`)
 *   // POST with JSON body
 *   apiFetch("/api/trash/restore", { method: "POST", json: { entity, id } })
 */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, headers, ...rest } = init ?? {};
  const res = await fetch(`${BASE_PATH}${path}`, {
    ...rest,
    headers: {
      ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // Non-JSON error body — fall back to the status text above.
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}
