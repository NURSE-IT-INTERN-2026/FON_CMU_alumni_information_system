"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useCanWrite } from "@/lib/role-context";
import { useBulkSelection } from "@/lib/useBulkSelection";
import Link from "next/link";
import { PAGE_SIZE } from "@/lib/constants";

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
  createdAt: string;
}

interface ApiResponse {
  data: NewsItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  const [news, setNews] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const {
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    deselectAll,
    isSelected,
    isAllSelected,
    getSelectedArray,
  } = useBulkSelection();
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverDragOver, setCoverDragOver] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const inlineImageRef = useRef<HTMLInputElement>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const [activeStates, setActiveStates] = useState<Record<string, boolean>>({});
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 });
  const tablePickerRef = useRef<HTMLDivElement>(null);

  const TOOLBAR_COMMANDS = [
    "bold", "italic", "underline", "strikeThrough",
    "insertUnorderedList", "insertOrderedList",
    "justifyLeft", "justifyCenter", "justifyRight", "justifyFull",
    "createLink",
  ];

  const updateToolbarState = useCallback(() => {
    const states: Record<string, boolean> = {};
    for (const cmd of TOOLBAR_COMMANDS) {
      try { states[cmd] = document.queryCommandState(cmd); } catch { states[cmd] = false; }
    }
    setActiveStates(states);
  }, []);

  const execFormat = useCallback((command: string, value?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    // If no selection in editor, place cursor at end
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    document.execCommand(command, false, value);
    setForm((f) => ({ ...f, body: editor.innerHTML }));
    updateToolbarState();
  }, [updateToolbarState]);

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
      const res = await fetch("/api/upload", { method: "POST", body: formData });
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
    if (url) setForm((f) => ({ ...f, coverImageUrl: url }));
    setCoverUploading(false);
  };

  const bodyStats = useMemo(() => {
    const text = stripHtml(form.body);
    return {
      chars: text.length,
      words: text.trim() ? text.trim().split(/\s+/).length : 0,
    };
  }, [form.body]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (!manageMode) params.set("status", "PUBLISHED");

      const res = await fetch(`/api/news?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data: ApiResponse = await res.json();
      setNews(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      setErrorMsg("ไม่สามารถโหลดข้อมูลข่าวสารได้");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, manageMode]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target as Node)) {
        setShowTablePicker(false);
        setTableHover({ rows: 0, cols: 0 });
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (showForm && editorRef.current) {
      editorRef.current.innerHTML = form.body || "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, editingId]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (item: NewsItem) => {
    setForm({
      title: item.title,
      body: item.body,
      coverImageUrl: item.coverImageUrl || "",
      status: item.status,
    });
    setFormErrors({});
    setEditingId(item.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) errors.title = "กรุณากรอกชื่อเรื่อง";
    if (!form.body.trim()) errors.body = "กรุณากรอกเนื้อหา";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body,
        coverImageUrl: form.coverImageUrl.trim() || null,
        status: form.status,
      };
      const res = editingId
        ? await fetch(`/api/news/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/news", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      closeForm();
      fetchNews();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/news/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDeleteId(null);
      fetchNews();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการลบข่าวสาร");
    }
  };

  const handleBulkDelete = async () => {
    const ids = getSelectedArray();
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/news/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "เกิดข้อผิดพลาด");
      }
      deselectAll();
      setShowBulkDeleteDialog(false);
      fetchNews();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการลบข้อมูล");
    } finally {
      setBulkDeleting(false);
    }
  };

  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--primary)] sm:text-3xl">
          ข่าวสารและกิจกรรม
        </h1>
        {!manageMode ? (
          canWrite && (<button onClick={() => { setManageMode(true); deselectAll(); }} className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
            จัดการข้อมูล
          </button>)
        ) : (
          <button onClick={() => { setManageMode(false); setShowForm(false); deselectAll(); }} className="rounded-lg border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-gray-50">
            กลับหน้าเดิม
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-4 text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {manageMode && showForm && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {/* Header bar */}
          <div className="flex items-center justify-between bg-[var(--primary)] px-6 py-3">
            <h2 className="text-base font-semibold text-white">
              {editingId ? "แก้ไขข่าวสาร" : "สร้างข่าวใหม่"}
            </h2>
            <button
              onClick={handleSave}
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
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                หัวข้อ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)] ${formErrors.title ? "border-red-400" : "border-gray-300"}`}
              />
            </div>

            {/* Cover Image Upload */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">รูปปก</label>
              {form.coverImageUrl ? (
                <div className="relative inline-block w-full">
                  <img src={form.coverImageUrl} alt="preview" className="w-full rounded-lg" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, coverImageUrl: "" }))}
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

            {/* Body with toolbar */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                เนื้อหา <span className="text-red-500">*</span>
              </label>
              {/* Formatting toolbar */}
              <div className="flex flex-wrap items-center gap-px rounded-t-lg border border-b-0 border-gray-300 bg-gray-50 px-1.5 py-1">
                {/* Bold */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("bold")} title="ตัวหนา" className={`rounded p-1.5 ${activeStates.bold ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
                </button>
                {/* Italic */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("italic")} title="ตัวเอียง" className={`rounded p-1.5 ${activeStates.italic ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
                </button>
                {/* Underline */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("underline")} title="ขีดเส้นใต้" className={`rounded p-1.5 ${activeStates.underline ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
                </button>
                {/* Link */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { const url = prompt("URL:"); if (url) execFormat("createLink", url); }} title="แทรกลิงก์" className={`rounded p-1.5 ${activeStates.createLink ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </button>
                {/* Insert image */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => inlineImageRef.current?.click()} title="แทรกรูปภาพ" className="rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </button>
                <input ref={inlineImageRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file).then((url) => { if (url) execFormat("insertHTML", `<img src="${url}" style="max-width:100%;height:auto" /><br/>`); }); e.target.value = ""; }} />
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Bulleted list */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertUnorderedList")} title="รายการแบบ bullet" className={`rounded p-1.5 ${activeStates.insertUnorderedList ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
                </button>
                {/* Numbered list */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("insertOrderedList")} title="รายการแบบลำดับเลข" className={`rounded p-1.5 ${activeStates.insertOrderedList ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><text x="3" y="8" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">1</text><text x="3" y="14" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">2</text><text x="3" y="20" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">3</text></svg>
                </button>
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Decrease indent */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("outdent")} title="ลดการเยื้อง" className="rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="11 17 6 12 11 7"/><line x1="6" y1="12" x2="20" y2="12"/><line x1="3" y1="6" x2="3" y2="18"/></svg>
                </button>
                {/* Increase indent */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("indent")} title="เพิ่มการเยื้อง" className="rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="21" y1="6" x2="21" y2="18"/></svg>
                </button>
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Font color */}
                <label title="สีตัวอักษร" className="relative flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <span className="text-xs font-bold">A</span>
                  <input type="color" defaultValue="#000000" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(e) => execFormat("foreColor", e.target.value)} />
                </label>
                {/* Highlight color */}
                <label title="สีพื้นหลังข้อความ" className="relative flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  <input type="color" defaultValue="#FFFF00" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={(e) => execFormat("hiliteColor", e.target.value)} />
                </label>
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Insert table */}
                <div className="relative" ref={tablePickerRef}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setShowTablePicker((v) => !v)} title="แทรกตาราง" className="rounded p-1.5 text-gray-600 hover:bg-gray-200">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                  </button>
                  {showTablePicker && (
                    <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
                      <div className="mb-1 text-center text-xs text-gray-500">
                        {tableHover.rows > 0 ? `${tableHover.rows}×${tableHover.cols} ตาราง` : "เลือกขนาดตาราง"}
                      </div>
                      <div className="grid" style={{ gridTemplateColumns: `repeat(8, 1fr)` }}>
                        {Array.from({ length: 64 }, (_, i) => {
                          const r = Math.floor(i / 8) + 1;
                          const c = (i % 8) + 1;
                          const hovered = r <= tableHover.rows && c <= tableHover.cols;
                          return (
                            <div
                              key={i}
                              className={`h-4 w-4 border ${hovered ? "border-[var(--primary)] bg-[var(--primary)]/20" : "border-gray-200"}`}
                              onMouseEnter={() => setTableHover({ rows: r, cols: c })}
                              onClick={() => {
                                let html = '<table style="border-collapse:collapse;width:100%"><tbody>';
                                for (let ri = 0; ri < r; ri++) {
                                  html += '<tr>';
                                  for (let ci = 0; ci < c; ci++) html += '<td style="border:1px solid #ccc;padding:6px">&nbsp;</td>';
                                  html += '</tr>';
                                }
                                html += '</tbody></table><br/>';
                                execFormat("insertHTML", html);
                                setShowTablePicker(false);
                                setTableHover({ rows: 0, cols: 0 });
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Undo */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("undo")} title="เลิกทำ" className="rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
                </button>
                {/* Clear formatting */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("removeFormat")} title="ล้างรูปแบบ" className="rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l9-9 8 8-4 4"/><path d="M6 11l4 4"/><line x1="17" y1="4" x2="21" y2="8"/></svg>
                </button>
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Strikethrough */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("strikeThrough")} title="ขีดทับ" className={`rounded p-1.5 ${activeStates.strikeThrough ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4H9a3 3 0 0 0-3 3 3 3 0 0 0 3 3h6"/><line x1="4" y1="12" x2="20" y2="12"/><path d="M15 12a3 3 0 1 1 0 6H8"/></svg>
                </button>
                {/* Font size */}
                <label title="ขนาดตัวอักษร" className="flex cursor-pointer items-center rounded p-1.5 text-gray-600 hover:bg-gray-200">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                  <select
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => execFormat("fontSize", e.target.value)}
                    className="ml-0.5 h-5 cursor-pointer border-none bg-transparent text-xs text-gray-600 outline-none"
                    defaultValue="3"
                  >
                    <option value="1">เล็กมาก</option>
                    <option value="2">เล็ก</option>
                    <option value="3">ปกติ</option>
                    <option value="4">ใหญ่</option>
                    <option value="5">ใหญ่มาก</option>
                    <option value="6">ใหญ่พิเศษ</option>
                    <option value="7">ใหญ่สุด</option>
                  </select>
                </label>
                <span className="mx-1 h-5 w-px bg-gray-300" />
                {/* Align left */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyLeft")} title="ชิดซ้าย" className={`rounded p-1.5 ${activeStates.justifyLeft ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                </button>
                {/* Align center */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyCenter")} title="กึ่งกลาง" className={`rounded p-1.5 ${activeStates.justifyCenter ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                </button>
                {/* Align right */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyRight")} title="ชิดขวา" className={`rounded p-1.5 ${activeStates.justifyRight ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
                </button>
                {/* Align justify */}
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => execFormat("justifyFull")} title="เต็มแนว" className={`rounded p-1.5 ${activeStates.justifyFull ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "text-gray-600"} hover:bg-gray-200`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                </button>
              </div>
              {/* Editor area */}
              <div
                ref={editorRef}
                contentEditable
                onInput={() => {
                  if (editorRef.current) {
                    setForm((f) => ({ ...f, body: editorRef.current!.innerHTML }));
                  }
                  updateToolbarState();
                }}
                onKeyUp={updateToolbarState}
                onMouseUp={updateToolbarState}
                onPaste={(e) => {
                  const items = e.clipboardData.items;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.match(/^image\/(jpeg|png)$/)) {
                      e.preventDefault();
                      const file = items[i].getAsFile();
                      if (file) {
                        uploadImage(file).then((url) => {
                          if (url) execFormat("insertHTML", `<img src="${url}" style="max-width:100%;height:auto" /><br/>`);
                        });
                      }
                      return;
                    }
                  }
                }}
                className={`min-h-[240px] rounded-b-lg border p-6 sm:p-8 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] prose prose-sm sm:prose !max-w-none ${formErrors.body ? "border-red-400" : "border-gray-300"}`}
                suppressContentEditableWarning
              />
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">สถานะ</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "DRAFT" | "PUBLISHED" | "DISCONTINUED" }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              >
                <option value="DRAFT">ฉบับร่าง</option>
                <option value="PUBLISHED">เผยแพร่</option>
                <option value="DISCONTINUED">ยุติการเผยแพร่</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3">
            <span className="text-xs text-gray-400">
              ตัวอักษร: {bodyStats.chars} &nbsp;|&nbsp; คำ: {bodyStats.words}
            </span>
            <div className="flex gap-3">
              <button
                onClick={closeForm}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
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
        <input
          type="text"
          placeholder="ค้นหาข่าว..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 rounded-lg border border-[var(--border)] px-4 py-2 text-sm focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
        />
        {manageMode && (
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

      {manageMode && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            สร้างข่าวใหม่
          </button>
          {selectedCount > 0 && (
            <button
              onClick={() => setShowBulkDeleteDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
              ลบที่เลือก ({selectedCount})
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-lg bg-white py-16 text-center shadow-sm">
          <svg className="mx-auto mb-4 h-12 w-12 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-[var(--muted)]">ยังไม่มีข่าวสาร</p>
        </div>
      ) : manageMode ? (
        /* Management mode: table */
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--primary)] text-white">
                  {manageMode && (
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={news.length > 0 && isAllSelected(news.map((n) => n.id))}
                        onChange={(e) => {
                          if (e.target.checked) selectAll(news.map((n) => n.id));
                          else deselectAll();
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-16">ลำดับ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">ชื่อเรื่อง</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-32">สถานะ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider w-40">วันที่เผยแพร่</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-28">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {news.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    {manageMode && (
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-500">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{item.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${item.status === "PUBLISHED" ? "bg-green-100 text-green-700" : item.status === "DISCONTINUED" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"}`}>
                        {STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatThaiDate(item.publishedAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(item)} className="rounded p-1.5 text-purple-600 hover:bg-purple-100" title="แก้ไข">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                        </button>
                        <button onClick={() => setDeleteId(item.id)} className="rounded p-1.5 text-red-500 hover:bg-red-100" title="ลบ">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
            <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
            <div className="flex items-center gap-1">
              <button onClick={() => { setPage(Math.max(1, page - 1)); deselectAll(); }} disabled={page === 1} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ก่อนหน้า</button>
              {paginationNumbers.map((p, i) =>
                p === "..." ? <span key={`dot-${i}`} className="px-2 text-gray-400">...</span> : (
                  <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${page === p ? "bg-[var(--primary)] text-white" : "text-gray-600 bg-white hover:bg-gray-100"}`}>{p}</button>
                )
              )}
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40">ถัดไป</button>
            </div>
          </div>
        </div>
      ) : (
        /* View mode: news cards */
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => {
            const summary = stripHtml(item.body).slice(0, 150);
            return (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="group overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="aspect-video w-full overflow-hidden bg-gray-100">
                  {item.coverImageUrl ? (
                    <img src={item.coverImageUrl} alt={item.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-[var(--primary)]/5">
                      <svg className="h-12 w-12 text-[var(--primary)]/30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="mb-2 line-clamp-2 text-base font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                    {item.title}
                  </h3>
                  <p className="mb-2 text-xs text-[var(--muted)]">
                    {item.publishedAt ? formatThaiDate(item.publishedAt) : ""}
                  </p>
                  {summary && (
                    <p className="line-clamp-3 text-sm text-[var(--muted)]">
                      {summary}{stripHtml(item.body).length > 150 ? "..." : ""}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!manageMode && totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-sm text-gray-500">แสดง {pageStart}-{pageEnd} จาก {total} รายการ</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setPage(Math.max(1, page - 1)); deselectAll(); }} disabled={page === 1} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ก่อนหน้า</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`rounded-md px-3 py-1.5 text-sm ${p === page ? "bg-[var(--primary)] text-white" : "border border-[var(--border)] bg-white hover:bg-gray-100"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="rounded-md border border-[var(--border)] bg-white px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-gray-100">ถัดไป</button>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข่าว</h3>
            <p className="mb-6 text-sm text-gray-600">คุณต้องการลบข่าวสารนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้</p>
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
            <h3 className="mb-2 text-lg font-semibold text-gray-900">ยืนยันการลบข้อมูล</h3>
            <p className="mb-6 text-sm text-gray-600">
              คุณต้องการลบข้อมูล <span className="font-bold text-red-600">{selectedCount}</span> รายการหรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
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
