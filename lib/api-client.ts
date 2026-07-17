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

// Once a 401 triggers a redirect to /login, suppress duplicate redirects from
// concurrent failing requests on the same (unloading) page.
let redirectingToLogin = false;

/**
 * A 401 reaching apiFetch always means the session is gone (expired/missing).
 * The shared login page submits auth via raw `fetch`, never apiFetch, so
 * auth-endpoint 401s (wrong password) don't reach here — redirect to login
 * instead of letting the calling query render a generic "load failed".
 * 403 = logged-in-but-forbidden, so it is intentionally NOT redirected.
 */
function redirectToLogin() {
  if (typeof window === "undefined") return; // SSR — nothing to redirect.
  if (redirectingToLogin) return; // Duplicate guard (several queries 401 at once).
  if (window.location.pathname.startsWith(`${BASE_PATH}/login`)) return; // Loop guard.
  redirectingToLogin = true;
  // The admin + alumni login forms share /login. If the expired request came
  // from the graduates (alumni) area, open the alumni tab; else the admin tab.
  const audience = window.location.pathname.startsWith(`${BASE_PATH}/graduates`)
    ? "&audience=alumni"
    : "";
  window.location.href = `${BASE_PATH}/login?expired=1${audience}`;
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
    // Session expired/missing: bounce to login rather than surfacing a
    // per-query "load failed". Still throw so react-query/callers reject cleanly.
    if (res.status === 401) redirectToLogin();

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
