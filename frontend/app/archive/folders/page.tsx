"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(
    null
  );

  const [editingFolder, setEditingFolder] =
    useState<FolderItem | null>(null);

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
        err instanceof Error
          ? err.message
          : "Failed to load archive folders."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFolders();
  }, []);

  useEffect(() => {
    if (!showModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        closeModal();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showModal, saving]);

  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return folders;
    }

    return folders.filter((folder) => {
      return (
        folder.name.toLowerCase().includes(query) ||
        (folder.description || "").toLowerCase().includes(query)
      );
    });
  }, [folders, search]);

  function openCreateModal() {
    setEditingFolder(null);
    setName("");
    setDescription("");
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEditModal(folder: FolderItem) {
    setEditingFolder(folder);
    setName(folder.name);
    setDescription(folder.description || "");
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingFolder(null);
    setName("");
    setDescription("");
  }

  async function saveFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Folder name is required.");
      return;
    }

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
          name: trimmedName,
          description: description.trim() || null,
        }),
      });

      setShowModal(false);
      setEditingFolder(null);
      setName("");
      setDescription("");

      setSuccess(
        data.message ||
          (editingFolder
            ? "Archive folder updated successfully."
            : "Archive folder created successfully.")
      );

      await loadFolders();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save archive folder."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteFolder(folder: FolderItem) {
    const recordLabel =
      folder.records_count === 1 ? "record" : "records";

    const confirmed = window.confirm(
      `Delete "${folder.name}"? ${folder.records_count} ${recordLabel} will be moved back to Unfiled.`
    );

    if (!confirmed) return;

    setDeletingFolderId(folder.id);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        `/archive/folders/${folder.id}`,
        {
          method: "DELETE",
        }
      );

      setSuccess(data.message || "Archive folder deleted.");
      await loadFolders();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete archive folder."
      );
    } finally {
      setDeletingFolderId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl pb-8">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 py-6 text-white shadow-xl shadow-[#075A3A]/20 sm:px-7 sm:py-7">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <Link
                href="/archive"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-[#E5DDCC] transition hover:text-[#F4C25E] focus:outline-none focus:ring-4 focus:ring-white/10"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span>Back to Unfiled Records</span>
              </Link>

              <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F4C25E]">
                Archive Repository
              </p>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Archive Folders
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#E5DDCC]">
                Create and manage folders used to organize archived
                records.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 sm:w-auto"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#D9961A]">
                <FolderPlus className="h-4 w-4" />
              </span>
              Create Folder
            </button>
          </div>
        </header>

        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <section className="relative mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DED5C5] sm:mt-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
          <div className="border-b border-[#E3DCCE] bg-[#FCFAF5] p-4 pt-5 sm:p-5 sm:pt-6">
            <div className="relative w-full sm:max-w-xl">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A09582]" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                inputMode="search"
                autoComplete="off"
                placeholder="Search folders..."
                aria-label="Search archive folders"
                className="min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] py-3 pl-12 pr-4 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
              />
            </div>
          </div>

          <div className="p-3 sm:p-5">
            {loading ? (
              <LoadingState />
            ) : filteredFolders.length === 0 ? (
              <EmptyState
                hasSearch={Boolean(search.trim())}
                onCreate={openCreateModal}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredFolders.map((folder) => {
                  const isDeleting =
                    deletingFolderId === folder.id;

                  return (
                    <article
                      key={folder.id}
                      className="flex min-w-0 flex-col rounded-2xl border border-[#E3DCCE] bg-white p-4 transition hover:border-[#CFE0D6] hover:shadow-md sm:p-5"
                    >
                      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#075A3A] via-[#D9961A] to-[#6B0F2B]" />
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#075A3A] text-[#F4C25E] shadow-sm">
                          <FolderOpen className="h-5 w-5" />
                        </div>

                        <span className="shrink-0 rounded-full bg-[#FFF3D6] px-2.5 py-1 text-[11px] font-bold text-[#A66B00] ring-1 ring-[#EBCF8F] sm:px-3 sm:text-xs">
                          {folder.records_count}{" "}
                          {folder.records_count === 1
                            ? "record"
                            : "records"}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2
                          className="mt-4 break-words text-base font-bold leading-6 text-[#252A27] sm:text-lg"
                          title={folder.name}
                        >
                          {folder.name}
                        </h2>

                        <p className="mt-2 line-clamp-3 min-h-[60px] break-words text-sm leading-5 text-[#766F63]">
                          {folder.description ||
                            "No folder description."}
                        </p>
                      </div>

                      <Link
                        href={`/archive/folders/${folder.id}`}
                        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#6B0F2B] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#DED5C5]"
                      >
                        Open Folder
                      </Link>

                      <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(folder)}
                          disabled={isDeleting}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E3DCCE] px-3 py-2.5 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] focus:outline-none focus:ring-4 focus:ring-[#ECE5D8] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Rename
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteFolder(folder)}
                          disabled={isDeleting}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}

                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {showModal && (
        <div
          role="presentation"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-[#6B0F2B]/60 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <form
            onSubmit={saveFolder}
            role="dialog"
            aria-modal="true"
            aria-labelledby="folder-modal-title"
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl ring-1 ring-[#DED5C5] sm:max-w-lg sm:rounded-3xl sm:p-6"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#E3DCCE] sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9961A]">
                  Folder Management
                </p>

                <h2
                  id="folder-modal-title"
                  className="mt-1 text-xl font-bold leading-7 text-[#252A27]"
                >
                  {editingFolder
                    ? "Edit Archive Folder"
                    : "Create Archive Folder"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close folder form"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#766F63] transition hover:bg-[#F0ECE4] focus:outline-none focus:ring-4 focus:ring-[#ECE5D8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label
              htmlFor="folder-name"
              className="mt-5 block text-sm font-semibold text-[#514D46]"
            >
              Folder name
            </label>

            <input
              id="folder-name"
              autoFocus
              required
              maxLength={100}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter folder name"
              className="mt-2 min-h-12 w-full rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
            />

            <div className="mt-4 flex items-center justify-between gap-3">
              <label
                htmlFor="folder-description"
                className="text-sm font-semibold text-[#514D46]"
              >
                Description
              </label>

              <span className="text-xs text-[#A09582]">
                {description.length}/1000
              </span>
            </div>

            <textarea
              id="folder-description"
              rows={4}
              maxLength={1000}
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              placeholder="Add an optional description"
              className="mt-2 w-full resize-none rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-base text-[#2D332F] outline-none transition placeholder:text-[#A09582] focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] sm:text-sm"
            />

            <div className="mt-6 grid grid-cols-1 gap-3 sm:flex sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="order-2 min-h-12 rounded-xl border border-[#E3DCCE] px-5 py-3 text-sm font-semibold text-[#514D46] transition hover:bg-[#F8F5EE] focus:outline-none focus:ring-4 focus:ring-[#ECE5D8] disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="order-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30 disabled:cursor-not-allowed disabled:opacity-50 sm:order-2"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

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

function LoadingState() {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-[#F8F5EE] px-5 text-center">
      <Loader2 className="h-7 w-7 animate-spin text-[#075A3A]" />

      <p className="mt-3 text-sm font-medium text-[#766F63]">
        Loading archive folders...
      </p>
    </div>
  );
}

function EmptyState({
  hasSearch,
  onCreate,
}: {
  hasSearch: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#D7CDBB] bg-[#F8F5EE] px-5 py-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#A09582] shadow-sm ring-1 ring-[#DED5C5]">
        <Folder className="h-7 w-7" />
      </div>

      <h2 className="mt-4 font-bold text-[#2D332F]">
        {hasSearch
          ? "No matching folders found"
          : "No archive folders yet"}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-[#766F63]">
        {hasSearch
          ? "Try another folder name or description."
          : "Create a folder to start organizing archived records."}
      </p>

      {!hasSearch && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6B0F2B] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30"
        >
          <FolderPlus className="h-4 w-4" />
          Create First Folder
        </button>
      )}
    </div>
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
      role={tone === "error" ? "alert" : "status"}
      className={`mt-5 break-words rounded-2xl border px-4 py-3 text-sm font-medium ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {children}
    </div>
  );
}