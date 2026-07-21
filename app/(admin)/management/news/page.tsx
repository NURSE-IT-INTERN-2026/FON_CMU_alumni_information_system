"use client";

import { useState, useRef } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useBulkSelection } from "@/lib/useBulkSelection";
import { canSelect, resolveSelectAllTargetIds, pinToggleKind, type NewsStatus } from "@/lib/news-selection";
import Link from "next/link";
import { BASE_PATH } from "@/lib/constants";
import { assetUrl, prefixUploadsInHtml } from "@/lib/asset-url";
import { ImageEditorDialog } from "@/components/news/ImageEditorDialog";
import RichTextEditor from "@/components/news/RichTextEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiFetch } from "@/lib/api-client";
import { newsFormSchema, type NewsFormData } from "@/lib/validations";
import FormField from "@/components/form/FormField";
import FormInput from "@/components/form/FormInput";
import FormSelect from "@/components/form/FormSelect";
import SearchInput from "@/components/ui/search-input";
import { useCanWrite } from "@/lib/role-context";

// PRD §3.12: news lists show at most 9 cards per page.
const NEWS_PAGE_SIZE = 9;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatThaiDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
  ];
  const d = new Date(dateStr);
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
}

interface NewsItem {
  id: string;
  title: string;
  body: string;
  coverImageUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "DISCONTINUED";
  publishedAt: string | null;
  pinnedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  PUBLISHED: "เผยแพร่",
  DISCONTINUED: "ยุติการเผยแพร่",
};

const EMPTY_FORM: {
  title: string;
  body: string;
  coverImageUrl: string;
  status: "DRAFT" | "PUBLISHED" | "DISCONTINUED";
} = {
  title: "",
  body: "",
  coverImageUrl: "",
  status: "DRAFT",
};

export default function NewsListPage() {
  const canWrite = useCanWrite();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { register, handleSubmit, formState: { errors: formErrors }, reset: formReset, setValue: setFormValue, watch, getValues } = useForm<NewsFormData>({
    resolver: zodResolver(newsFormSchema) as unknown as Resolver<NewsFormData>,
    defaultValues: EMPTY_FORM,
  });

  const {
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    deselectPage,
    isSelected,
    isAllSelected,
    getSelectedArray,
  } = useBulkSelection();
  const [selectMode, setSelectMode] = useState(false);
  // Locked status for the current selection (DRAFT / DISCONTINUED / PUBLISHED).
  // The first card clicked picks the status; cards of any other status are blocked.
  // Reset to null whenever the selection becomes empty (render-phase "adjust state
  // on change" pattern — NOT an effect; mirrors components/ui/search-input.tsx).
  const [selectionStatus, setSelectionStatus] = useState<NewsStatus | null>(null);
  const [prevSelectedCount, setPrevSelectedCount] = useState(selectedCount);
  if (selectedCount !== prevSelectedCount) {
    setPrevSelectedCount(selectedCount);
    if (selectedCount === 0 && selectionStatus !== null) setSelectionStatus(null);
  }
  const enterSelect = () => setSelectMode(true);
  const exitSelect = () => { setSelectMode(false); deselectAll(); setSelectionStatus(null); };
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [bulkPinning, setBulkPinning] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // Cover image crop/resize editor.
  const [coverEditing, setCoverEditing] = useState(false);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!file.type.match(/^image\/(jpeg|png)$/)) {
      setErrorMsg("อนุญาตเฉพาะไฟล์ JPG และ PNG เท่านั้น");
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("ขนาดไฟล์ต้องไม่เกิน 5MB");
      return null;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/upload`, { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      const { url } = await res.json();
      return url;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการอัปโหลด");
      return null;
    }
  };

  const uploadCoverImage = async (file: File) => {
    setCoverUploading(true);
    const url = await uploadImage(file);
    if (url) setFormValue("coverImageUrl", url);
    setCoverUploading(false);
  };

  const qc = useQueryClient();
  const { data: newsData, isPending: loading, isError } = useQuery({
    queryKey: queryKeys.news.list({ page, search, statusFilter }),
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(NEWS_PAGE_SIZE) });
      if (search) params.set("search", search);
      // The read-only "executive" role sees news like alumni (published only).
      // The server already enforces this; the client param keeps the UI honest
      // and means the status filter never applies for executives.
      if (!canWrite) params.set("status", "PUBLISHED");
      else if (statusFilter) params.set("status", statusFilter);
      return apiFetch<{ data: NewsItem[]; total: number; totalPages: number }>(`/api/news?${params}`);
    },
  });
  const news = newsData?.data ?? [];
  const total = newsData?.total ?? 0;
  const totalPages = newsData?.totalPages ?? 1;

  // Which on-page ids "select all on this page" targets (and the status it locks).
  // Pinned news are excluded (they live in the separate pinned section); on a
  // mixed-status page with no status locked yet, returns no target → button disabled.
  const selectAllTarget = resolveSelectAllTargetIds(news, selectionStatus);
  // Phrase for the "เลือกข่าวที่…ทั้งหมดในหน้านี้" label. DRAFT needs "เป็นฉบับร่าง"
  // (the bare noun "ฉบับร่าง" doesn't follow "ที่" grammatically); PUBLISHED /
  // DISCONTINUED are verb phrases that already fit.
  const selectAllStatusPhrase = selectAllTarget.status
    ? selectAllTarget.status === "DRAFT" ? "เป็นฉบับร่าง" : STATUS_LABELS[selectAllTarget.status]
    : null;
  const allOnPageSelected = selectAllTarget.ids.length > 0 && isAllSelected(selectAllTarget.ids);

  // Pinned "ประชาสัมพันธ์สำคัญ" section — PUBLISHED-only so it mirrors exactly
  // what alumni see at the top of their news page. NOTE: this query is
  // intentionally NOT `enabled`-gated. A standby `useQuery` (`enabled: false`)
  // does not reflect force-refetched data — neither invalidateQueries nor
  // refetchQueries updates its rendered output until it re-enables — so a pin
  // made while filtered/searched/paged left this section stale until a filter
  // change. Keeping it always-active means every news mutation's invalidate
  // refetches it immediately. The section is render-gated on pinnedItems.length.
  const { data: pinnedData } = useQuery({
    queryKey: queryKeys.news.pinned(),
    queryFn: () =>
      apiFetch<{ data: NewsItem[]; total: number; totalPages: number }>(
        `/api/news?${new URLSearchParams({ pinned: "true", status: "PUBLISHED", pageSize: "100" })}`
      ),
  });
  const pinnedItems = pinnedData?.data ?? [];

  // Bulk pin/unpin toggle label for the PUBLISHED group: count how many of the
  // selected (published) items are currently pinned. Pinned items only ever sit
  // in the pinned section above, so intersecting the selection with pinnedItems
  // is reliable for the label (the endpoint toggles each server-side regardless).
  const pinnedIdSet = new Set(pinnedItems.map((p) => p.id));
  const selectedPinnedCount = selectionStatus === "PUBLISHED"
    ? getSelectedArray().filter((id) => pinnedIdSet.has(id)).length
    : 0;
  const pinKind = pinToggleKind(selectedPinnedCount, selectedCount);
  const pinButtonLabel = pinKind === "unpin" ? "เลิกปักหมุดที่เลือก" : pinKind === "toggle" ? "ปักหมุด/เลิกปักหมุดที่เลือก" : "ปักหมุดที่เลือก";

  const openCreate = () => {
    formReset(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: NewsItem) => {
    formReset({
      title: item.title,
      body: item.body,
      coverImageUrl: item.coverImageUrl || "",
      status: item.status,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    formReset(EMPTY_FORM);
    setCoverEditing(false);
  };

  const handleSave = async (data: NewsFormData) => {
    setSaving(true);
    setErrorMsg("");
    try {
      // data.body is kept current by the editor's onChange (Tiptap fires onUpdate on
      // every transaction — unlike execCommand's onInput gaps), and is already
      // basePath-stripped inside the editor, so it's ready for storage as-is.
      const payload = {
        title: data.title.trim(),
        body: data.body,
        coverImageUrl: data.coverImageUrl?.trim() || null,
        status: data.status,
      };
      if (editingId) {
        await apiFetch(`/api/news/${editingId}`, { method: "PUT", json: payload });
      } else {
        await apiFetch(`/api/news`, { method: "POST", json: payload });
      }
      closeForm();
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/news/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข่าวสาร");
    }
  };

  const togglePin = async (item: NewsItem) => {
    setErrorMsg("");
    try {
      await apiFetch(`/api/news/${item.id}/pin`, {
        method: "POST",
        json: { pinned: !item.pinnedAt },
      });
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการปักหมุดข่าวสาร");
    }
  };

  // Publish (or re-publish) a draft / discontinued item — the quick-action that
  // replaces the "ยุติการเผยแพร่" button on non-published cards. Status-only PUT;
  // the route stamps `publishedAt` on the first publish. Reversible (unpublish).
  const publishNews = async (item: NewsItem) => {
    setErrorMsg("");
    try {
      await apiFetch(`/api/news/${item.id}`, { method: "PUT", json: { status: "PUBLISHED" } });
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเผยแพร่ข่าวสาร");
    }
  };

  const handleBulkDelete = async () => {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setErrorMsg("");
    try {
      await apiFetch(`/api/news/bulk-delete`, { method: "POST", json: { ids } });
      deselectAll();
      setShowBulkDeleteDialog(false);
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleBulkPublish = async () => {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    setBulkPublishing(true);
    setErrorMsg("");
    try {
      await apiFetch(`/api/news/bulk-publish`, { method: "POST", json: { ids } });
      deselectAll();
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเผยแพร่ข้อมูล");
    } finally {
      setBulkPublishing(false);
    }
  };

  const handleBulkPin = async () => {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    setBulkPinning(true);
    setErrorMsg("");
    try {
      await apiFetch(`/api/news/bulk-pin`, { method: "POST", json: { ids } });
      // Keep the selection so the user can toggle back. Pin/unpin doesn't change
      // status (items stay PUBLISHED), so the selection + selectionStatus stay
      // coherent; the invalidate refreshes pinnedItems so the toggle label
      // recomputes. (Publish/discontinue still clear, since they change status.)
      qc.invalidateQueries({ queryKey: queryKeys.news.all });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการปักหมุดข้อมูล");
    } finally {
      setBulkPinning(false);
    }
  };

  const pageStart = total === 0 ? 0 : (page - 1) * NEWS_PAGE_SIZE + 1;
  const pageEnd = Math.min(page * NEWS_PAGE_SIZE, total);

  const paginationNumbers = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  })();

  // Shared card renderer — used by BOTH the pinned "ประชาสัมพันธ์สำคัญ" section
  // and the regular grid. Pinned items are excluded from the grid, so they must
  // stay fully manageable (pin/edit/delete) from the pinned section too.
  const renderNewsCard = (item: NewsItem) => {
    const summary = stripHtml(item.body).slice(0, 150);
    const pinned = !!item.pinnedAt;
    const selectable = !selectMode || canSelect(item.status, selectionStatus);
    return (
      <div key={item.id} title={selectMode && !selectable ? "ไม่สามารถเลือกรวมข่าวต่างสถานะกันได้" : undefined} className={`group relative flex flex-col overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md ${isSelected(item.id) ? "ring-2 ring-orange-400" : pinned ? "ring-2 ring-amber-400" : ""} ${!selectable ? "opacity-40 cursor-not-allowed" : ""}`}>

        {canWrite && (
          <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
            {pinned && item.status === "PUBLISHED" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 shadow-sm" title="ปักหมุดแล้ว">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6v4.2l2.1 3.4a1 1 0 0 1-.85 1.5H13v6.4a1 1 0 0 1-2 0v-6.4H7.75a1 1 0 0 1-.85-1.5L9 8.2V4Z" /></svg>
                ปักหมุด
              </span>
            )}
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium shadow-sm ${item.status === "PUBLISHED" ? "bg-green-100 text-green-700" : item.status === "DISCONTINUED" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>
              {STATUS_LABELS[item.status]}
            </span>
          </div>
        )}
        <Link href={`/news/${item.id}`} className="block" onClick={(e) => { if (selectMode) { e.preventDefault(); if (!selectable) return; if (selectionStatus === null) setSelectionStatus(item.status); toggleSelect(item.id); } }}>
          <div className="aspect-video w-full overflow-hidden bg-gray-100">
            {item.coverImageUrl ? (
              <img src={assetUrl(item.coverImageUrl)} alt={item.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
            ) : (
              <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                <svg className="h-12 w-12 text-[var(--primary)]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                </svg>
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="mb-2 line-clamp-2 text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">{item.title}</h3>
            <p className="mb-2 text-xs text-[var(--muted)]">{item.publishedAt ? formatThaiDate(item.publishedAt) : ""}</p>
            {summary && <p className="line-clamp-3 text-sm text-[var(--muted)]">{summary}{stripHtml(item.body).length > 150 ? "..." : ""}</p>}
          </div>
        </Link>
        {canWrite && (
          <div className="mt-auto flex items-center justify-end border-t border-gray-100 px-4 py-2.5">
            <div className="flex items-center gap-1">
              {item.status === "PUBLISHED" && (
                <button onClick={() => togglePin(item)} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium ${pinned ? "bg-amber-50 text-amber-700" : "text-gray-400 hover:bg-gray-100 hover:text-amber-600"}`} title={pinned ? "ยกเลิกปักหมุด" : "ปักหมุดเป็นประชาสัมพันธ์สำคัญ"}>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth={pinned ? 1 : 1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 4h6v4.2l2.1 3.4a1 1 0 0 1-.85 1.5H13v6.4a1 1 0 0 1-2 0v-6.4H7.75a1 1 0 0 1-.85-1.5L9 8.2V4Z" /></svg>
                  {pinned ? "ปักหมุดแล้ว" : "ปักหมุด"}
                </button>
              )}
              <button onClick={() => openEdit(item)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50" title="แก้ไข">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                แก้ไข
              </button>
              {item.status !== "PUBLISHED" ? (
                <button onClick={() => publishNews(item)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-green-600 hover:bg-green-50" title="เผยแพร่ข่าว">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  เผยแพร่ข่าว
                </button>
              ) : (
                <button onClick={() => setDeleteId(item.id)} className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50" title="ยุติการเผยแพร่">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  ยุติการเผยแพร่
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ข่าวสารและกิจกรรม
        </h1>
        {canWrite && (selectMode ? (
          <div className="flex items-center gap-2">
            <button
              disabled={!(selectAllTarget.status !== null && selectAllTarget.ids.length > 0)}
              title={selectAllTarget.status === null ? "เลือกการ์ดใดการ์ดหนึ่งก่อนเพื่อเลือกตามสถานะ" : undefined}
              onClick={() => {
                const { ids: tids, status } = selectAllTarget;
                if (status === null || tids.length === 0) return;
                if (isAllSelected(tids)) {
                  deselectPage(tids);
                } else {
                  if (selectionStatus === null) setSelectionStatus(status);
                  selectAll(tids);
                }
              }}
              className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {allOnPageSelected
                ? selectAllStatusPhrase ? `ยกเลิกเลือกข่าวที่${selectAllStatusPhrase}ในหน้านี้` : "ยกเลิกเลือกหน้านี้"
                : selectAllStatusPhrase ? `เลือกข่าวที่${selectAllStatusPhrase}ทั้งหมดในหน้านี้` : "เลือกทั้งหมดในหน้านี้"}
            </button>
            <button onClick={exitSelect} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
              เสร็จสิ้น
            </button>
          </div>
        ) : (
          <button onClick={enterSelect} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            เลือก
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {showForm && canWrite && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {/* Header bar */}
          <div className="flex items-center justify-between bg-[var(--primary)] px-6 py-3">
            <h2 className="text-base font-semibold text-white">
              {editingId ? "แก้ไขข่าวสาร" : "สร้างข่าวใหม่"}
            </h2>
            <button
              onClick={handleSubmit(handleSave)}
              disabled={saving}
              className="rounded-lg bg-white px-4 py-1.5 text-sm font-medium text-[var(--primary)] transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>

          {/* Form body */}
          <div className="space-y-4 p-6 sm:p-8">
            {(formErrors.title || formErrors.body) && (
              <p className="text-xs text-red-500">* กรุณากรอกข้อมูลให้ครบ</p>
            )}

            {/* Title */}
            <FormField label="หัวข้อ" required error={formErrors.title?.message}>
              <FormInput registration={register("title")} error={formErrors.title?.message} type="text" />
            </FormField>

            {/* Cover Image Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">รูปปก</label>
              {watch("coverImageUrl") ? (
                <div className="relative inline-block w-full">
                  <img src={assetUrl(watch("coverImageUrl"))!} alt="preview" className="w-full rounded-lg" />
                  <button
                    type="button"
                    title="แก้ไขรูป (ครอป/ปรับขนาด)"
                    onClick={() => setCoverEditing(true)}
                    className="absolute top-2 right-11 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormValue("coverImageUrl", "")}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setCoverDragOver(true); }}
                  onDragLeave={() => setCoverDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setCoverDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) uploadCoverImage(file);
                  }}
                  onClick={() => coverFileRef.current?.click()}
                  tabIndex={0}
                  onPaste={(e) => {
                    const items = e.clipboardData.items;
                    for (let i = 0; i < items.length; i++) {
                      if (items[i].type.match(/^image\/(jpeg|png)$/)) {
                        e.preventDefault();
                        const file = items[i].getAsFile();
                        if (file) uploadCoverImage(file);
                        return;
                      }
                    }
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors outline-none focus:ring-2 focus:ring-[var(--primary)] ${
                    coverDragOver ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-gray-300 bg-gray-50 hover:border-gray-400"
                  }`}
                >
                  {coverUploading ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
                  ) : (
                    <>
                      <svg className="mb-2 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                      </svg>
                      <p className="text-sm text-gray-600">คลิก ลากไฟล์มาวาง หรือวางรูปจากคลิปบอร์ด</p>
                      <p className="mt-1 text-xs text-gray-400">อนุญาตเฉพาะ JPG, PNG (ไม่เกิน 5MB)</p>
                    </>
                  )}
                  <input
                    ref={coverFileRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadCoverImage(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              )}
            </div>

            {/* Body — Tiptap rich-text editor */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                เนื้อหา <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                key={editingId ?? "new"}
                value={prefixUploadsInHtml(getValues("body") || "")}
                onChange={(html) => setFormValue("body", html, { shouldDirty: true })}
                ariaLabel="เนื้อหาข่าวสาร"
                error={formErrors.body?.message}
              />
            </div>

            {/* Cover image editor (crop 16:9 + resize) */}
            {coverEditing && (
              <ImageEditorDialog
                key={watch("coverImageUrl") || "cover"}
                src={assetUrl(watch("coverImageUrl")) || ""}
                aspect={16 / 9}
                title="แก้ไขรูปปก"
                onClose={() => setCoverEditing(false)}
                onConfirm={async (file) => {
                  const u = await uploadImage(file);
                  if (u) setFormValue("coverImageUrl", u);
                  setCoverEditing(false);
                }}
              />
            )}

            {/* Status */}
            <FormField label="สถานะ">
              <FormSelect registration={register("status")}>
                <option value="DRAFT">ฉบับร่าง</option>
                <option value="PUBLISHED">เผยแพร่</option>
                {/* DISCONTINUED ("ยุติการเผยแพร่") is only reachable via the dedicated ยุติการเผยแพร่
                    action on a published item — not a choice when creating/editing. Kept here only
                    so an already-discontinued item's status still renders instead of going blank. */}
                {watch("status") === "DISCONTINUED" && (
                  <option value="DISCONTINUED">ยุติการเผยแพร่</option>
                )}
              </FormSelect>
            </FormField>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-gray-100 px-6 py-3">
            <div className="flex gap-3">
              <button
                onClick={closeForm}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit(handleSave)}
                disabled={saving}
                className="rounded-lg bg-[var(--primary)] px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <SearchInput
          value={search}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          placeholder="ค้นหาข่าว..."
          formClassName="flex-1"
        />
        {canWrite && (
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">ทั้งหมด</option>
            <option value="DRAFT">ฉบับร่าง</option>
            <option value="PUBLISHED">เผยแพร่</option>
            <option value="DISCONTINUED">ยุติการเผยแพร่</option>
          </select>
        )}
      </div>

      {canWrite && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            สร้างข่าวใหม่
          </button>
          {selectedCount > 0 && (selectionStatus === "DRAFT" || selectionStatus === "DISCONTINUED") && (
            <button
              onClick={handleBulkPublish}
              disabled={bulkPublishing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              เผยแพร่ข่าวที่เลือก ({selectedCount})
            </button>
          )}
          {selectedCount > 0 && selectionStatus === "DRAFT" && (
            <button
              onClick={() => setShowBulkDeleteDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              ยุติการเผยแพร่ที่เลือก ({selectedCount})
            </button>
          )}
          {selectedCount > 0 && selectionStatus === "PUBLISHED" && (
            <>
              <button
                onClick={handleBulkPin}
                disabled={bulkPinning}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6v4.2l2.1 3.4a1 1 0 0 1-.85 1.5H13v6.4a1 1 0 0 1-2 0v-6.4H7.75a1 1 0 0 1-.85-1.5L9 8.2V4Z" /></svg>
                {pinButtonLabel} ({selectedCount})
              </button>
              <button
                onClick={() => setShowBulkDeleteDialog(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                ยุติการเผยแพร่ที่เลือก ({selectedCount})
              </button>
            </>
          )}
        </div>
      )}

      {/* Pinned — ประชาสัมพันธ์สำคัญ (shown below the search bar + create button;
          admin pin control lives on each card; the alumni news page shows this
          same section read-only) */}
      {pinnedItems.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9 4h6v4.2l2.1 3.4a1 1 0 0 1-.85 1.5H13v6.4a1 1 0 0 1-2 0v-6.4H7.75a1 1 0 0 1-.85-1.5L9 8.2V4Z" /></svg>
            </span>
            <h2 className="text-lg font-bold text-[var(--primary)]">ประชาสัมพันธ์สำคัญ</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pinnedItems.map(renderNewsCard)}
          </div>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <p className="text-red-600">เกิดข้อผิดพลาดในการดึงข้อมูล</p>
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <svg className="mx-auto mb-4 h-12 w-12 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-[var(--muted)]">ยังไม่มีข่าวสาร</p>
        </div>
      ) : (
        /* Management mode: cards with edit/delete (PRD §3.12 — not a table) */
        <div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {news.map(renderNewsCard)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
              <div className="flex items-center gap-1">
                <button onClick={() => { setPage(Math.max(1, page - 1)); }} disabled={page === 1} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ก่อนหน้า</button>
                {paginationNumbers.map((p, i) =>
                  p === "..." ? <span key={`dot-${i}`} className="px-2 text-gray-400">...</span> : (
                    <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page === p ? "bg-[var(--primary)] text-white" : "text-gray-600 bg-white hover:bg-gray-100"}`}>{p}</button>
                  )
                )}
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการยุติการเผยแพร่</h3>
            <p className="mb-6 text-sm text-gray-600">คุณต้องการยุติการเผยแพร่ข่าวสารนี้หรือไม่? สามารถกู้คืนได้ภายหลังโดยแก้ไขสถานะ</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={confirmDelete} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700">ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการยุติการเผยแพร่</h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการยุติการเผยแพร่ข่าวสาร <span className="font-bold text-red-600">{selectedCount}</span> รายการหรือไม่? สามารถกู้คืนได้ภายหลังโดยแก้ไขสถานะ
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowBulkDeleteDialog(false)} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ยกเลิก</button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting} className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {bulkDeleting ? "กำลังลบ..." : "ยืนยัน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
