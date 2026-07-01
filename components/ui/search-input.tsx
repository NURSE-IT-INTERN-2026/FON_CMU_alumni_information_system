"use client";

import { useState, type FormEvent } from "react";

interface SearchInputProps {
  /** The APPLIED search term — the value the page actually queries on (feeds the
   *  react-query key). Kept separate from the in-flight text the user is typing
   *  so the query only runs on submit, not on every keystroke. */
  value: string;
  /** Fired on Enter or ค้นหา-button click with the current input text. The page
   *  applies it (e.g. `setSearch(term); setPage(1)`). */
  onSearch: (term: string) => void;
  placeholder?: string;
  /** The `<form>` wrapper's className — controls the box's OUTER width in its
   *  parent (e.g. `flex-1` to grow next to a search-field `<select>`, or
   *  `w-full sm:max-w-md` to cap it). Omit for a full-width standalone box. */
  formClassName?: string;
  /** Extra classes appended to the `<input>` (it always carries `flex-1 min-w-0`
   *  + the default border/padding/focus styling so it grows within the form). */
  inputClassName?: string;
}

/**
 * A search box that only runs a query when the user presses Enter or clicks the
 * ค้นหา button — NOT on every keystroke. The visible text lives in local state;
 *  the parent's `value` (the applied term) is the source of truth and is mirrored
 *  back into the box whenever it changes externally (e.g. the search-**field**
 *  selector clearing the term). That sync uses the "adjust state when a prop
 *  changes" pattern (a ref holding the last applied value) rather than an effect,
 *  so it never clobbers text the user is mid-typing.
 *
 * Replaces the old per-keystroke pattern `<input value={search} onChange={(e) =>
 * applySearch(e.target.value)} />` across the management tables.
 */
export default function SearchInput({
  value,
  onSearch,
  placeholder,
  formClassName,
  inputClassName,
}: SearchInputProps) {
  const [input, setInput] = useState(value);
  // Track the last applied value we synced from. When the parent's `value`
  // changes (external clear/reset, or the applied term landing after a submit),
  // mirror it into the input — done during render (not in an effect) so it
  // can't trigger cascading renders. Ordinary typing never changes `value`, so
  // this branch is skipped while the user is typing.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setInput(value);
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(input);
  };

  return (
    <form onSubmit={submit} className={`flex items-center gap-2 ${formClassName ?? ""}`}>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 min-w-0 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] ${inputClassName ?? ""}`}
      />
      <button
        type="submit"
        className="shrink-0 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
      >
        ค้นหา
      </button>
    </form>
  );
}
