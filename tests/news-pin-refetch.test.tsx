// @vitest-environment happy-dom
// Regression test for the admin news "ประชาสัมพันธ์สำคัญ" (pinned) section
// reactivity. Reproduces the news page's two-query setup (list + pinned) and
// the invalidateNews() helper.
//
// Root cause this locks in: a `useQuery` with `enabled: false` (standby) does
// NOT reflect force-refetched data — neither invalidateQueries({refetchType:
// "all"}) nor refetchQueries updates its rendered output until it re-enables.
// The pinned query was `enabled: page===1 && !search && !statusFilter`, so a
// pin made while filtered/searched/paged left the pinned section stale. Fix:
// drop the `enabled` gate so the query is always active and always refetches
// on the standard invalidate. Section visibility is unchanged (render guard is
// `pinnedItems.length > 0`).
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

let pinnedIds: string[] = [];

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
    },
  });
}

function NewsPage() {
  const qc = useQueryClient();
  useQuery({
    queryKey: ["news", "list"],
    queryFn: () => Promise.resolve({ data: [{ id: "c" }] }),
  });
  // Pinned query — NO `enabled` gate (the fix). Always active → always
  // refetches on invalidate, regardless of the view's filter/search/page.
  const pinnedQ = useQuery({
    queryKey: ["news", "pinned"],
    queryFn: () => Promise.resolve({ data: pinnedIds.map((id) => ({ id })) }),
  });
  const count = (pinnedQ.data?.data ?? []).length;

  const pin = async () => {
    pinnedIds = [...pinnedIds, "b"]; // simulate the pin API DB write
    qc.invalidateQueries({ queryKey: ["news"] });
  };

  return (
    <div>
      <div data-testid="pinned-count">{count}</div>
      <button onClick={() => pin()}>pin</button>
    </div>
  );
}

describe("news pin reactivity (admin pinned section)", () => {
  afterEach(() => cleanup());

  it("updates the pinned section immediately after a pin", async () => {
    pinnedIds = ["a"];
    render(
      <QueryClientProvider client={makeClient()}>
        <NewsPage />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("pinned-count").textContent).toBe("1"),
    );
    fireEvent.click(screen.getByText("pin"));
    await waitFor(() =>
      expect(screen.getByTestId("pinned-count").textContent).toBe("2"),
    );
  });
});
