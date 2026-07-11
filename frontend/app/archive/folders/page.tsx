"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type FolderItem = {
  id: number;
  name: string;
  description?: string | null;
  records_count: number;
};

export default function ArchiveFoldersPage() {
  const router = useRouter();

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderItem | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadFolders() {
    setLoading(true);
    setError("");

    try {
      const meData = await apiRequest("/me");
      const role = meData.user?.role?.name;

      if (!["Admin", "Records Officer"].includes(role)) {
        router.replace("/dashboard");
        return;
      }

      const data = await apiRequest("/archive/folders");
      setFolders(data.folders || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load archive folders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, []);

  const filteredFolders = folders.filter((folder) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;

    return (
      folder.name.toLowerCase().includes(query) ||
      (folder.description || "").toLowerCase().includes(query)
    );
  });

  function openCreateModal() {
    setEditingFolder(null);
    setName("");
    setDescription("");
    setShowModal(true);
    setError("");
    setSuccess("");
  }

  function openEditModal(folder: FolderItem) {
    setEditingFolder(folder);
    setName(folder.name);
    setDescription(folder.description || "");
    setShowModal(true);
    setError("");
    setSuccess("");
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
  }

  async function saveFolder(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = editingFolder
        ? `/archive/folders/${editingFolder.id}`
        : "/archive/folders";

      const data = await apiRequest(endpoint, {
        method: editingFolder ? "PATCH" : "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      setSuccess(data.message || "Archive folder saved successfully.");
      setShowModal(false);
      await loadFolders();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to save archive folder."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteFolder(folder: FolderItem) {
    const confirmed = window.confirm(
      `Delete "${folder.name}"? ${folder.records_count} record(s) will be moved back to Unfiled.`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(`/archive/folders/${folder.id}`, {
        method: "DELETE",
      });

      setSuccess(data.message || "Archive folder deleted.");
      await loadFolders();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to delete archive folder."
      );
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/archive"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Unfiled Records
            </Link>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Archive Folders
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Create and manage folders used to organize archived records.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
          >
            <FolderPlus className="h-4 w-4" />
            Create Folder
          </button>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="mt-5 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 p-4 sm:p-5">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search folders..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {loading ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-slate-50">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-medium text-slate-500">
                  Loading archive folders...
                </p>
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center">
                <Folder className="h-9 w-9 text-slate-400" />
                <h2 className="mt-4 font-bold text-slate-900">
                  No archive folders found
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  Create a folder to start organizing archived records.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredFolders.map((folder) => (
                  <article
                    key={folder.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <FolderOpen className="h-5 w-5" />
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {folder.records_count} records
                      </span>
                    </div>

                    <h2 className="mt-4 truncate text-lg font-bold text-slate-950">
                      {folder.name}
                    </h2>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                      {folder.description || "No folder description."}
                    </p>

                    <Link
                      href={`/archive/folders/${folder.id}`}
                      className="mt-5 flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Open Folder
                    </Link>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(folder)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" />
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFolder(folder)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={saveFolder}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  Folder Management
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {editingFolder ? "Edit Archive Folder" : "Create Archive Folder"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-sm font-semibold text-slate-700">
              Folder name
              <input
                autoFocus
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Description
              <textarea
                rows={4}
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving
                  ? "Saving..."
                  : editingFolder
                  ? "Save Changes"
                  : "Create Folder"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-5 rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {children}
    </div>
  );
}
