"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  MapPin,
  MessageSquareText,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type PresetType = "review_remark" | "storage_location";

type ReviewPreset = {
  id: number;
  type: PresetType;
  value: string;
};

const emptyDrafts: Record<PresetType, string> = {
  review_remark: "",
  storage_location: "",
};

export default function ReviewPresetsPage() {
  const router = useRouter();
  const [presets, setPresets] = useState<ReviewPreset[]>([]);
  const [drafts, setDrafts] = useState(emptyDrafts);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPresets = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const data = await apiRequest("/admin/review-presets");
      setPresets(data.data || []);
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load review presets."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const data = await apiRequest("/me");

        if (data.user?.role?.name !== "Admin") {
          router.replace("/dashboard");
          return;
        }

        await loadPresets();
      } catch {
        router.replace("/login");
      }
    }

    void initialize();
  }, [loadPresets, router]);

  function updateDraft(type: PresetType, value: string) {
    setDrafts((current) => ({ ...current, [type]: value }));
    setError("");
    setSuccess("");
  }

  function beginEdit(preset: ReviewPreset) {
    setEditingId(preset.id);
    setPendingDeleteId(null);
    setDrafts((current) => ({
      ...current,
      [preset.type]: preset.value,
    }));
    setError("");
    setSuccess("");
  }

  function cancelEdit(type: PresetType) {
    setEditingId(null);
    setDrafts((current) => ({ ...current, [type]: "" }));
  }

  async function savePreset(type: PresetType) {
    const value = drafts[type].trim();

    if (!value) {
      setError(
        type === "review_remark"
          ? "Enter a review remark."
          : "Enter a storage location."
      );
      return;
    }

    const editingPreset = presets.find(
      (preset) => preset.id === editingId && preset.type === type
    );

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        editingPreset
          ? `/admin/review-presets/${editingPreset.id}`
          : "/admin/review-presets",
        {
          method: editingPreset ? "PATCH" : "POST",
          body: JSON.stringify({ type, value }),
        }
      );

      setSuccess(data.message);
      setEditingId(null);
      setDrafts((current) => ({ ...current, [type]: "" }));
      await loadPresets(false);
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save the preset."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function removePreset(preset: ReviewPreset) {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest(
        `/admin/review-presets/${preset.id}`,
        { method: "DELETE" }
      );

      setSuccess(data.message);
      setPendingDeleteId(null);

      if (editingId === preset.id) {
        cancelEdit(preset.type);
      }

      await loadPresets(false);
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to remove the preset."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl pb-8">
        <div className="mb-5 flex items-start gap-3 border-b border-[#E3E6E3] pb-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7F0EB] text-[#075A3A]">
            <SlidersHorizontal className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8A8174]">
              Administration
            </p>
            <h1 className="mt-0.5 text-xl font-bold text-[#252A27]">
              Review Presets
            </h1>
            <p className="mt-1 text-sm text-[#6E756F]">
              Reusable remarks and locations for faster record reviews.
            </p>
          </div>
        </div>

        {(error || success) && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {error || success}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-[#737A74]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading presets...
          </div>
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <PresetPanel
              type="review_remark"
              title="Review remarks"
              description="Common verification results and approval notes."
              icon={MessageSquareText}
              presets={presets.filter(
                (preset) => preset.type === "review_remark"
              )}
              draft={drafts.review_remark}
              editingId={editingId}
              pendingDeleteId={pendingDeleteId}
              submitting={submitting}
              onDraftChange={(value) =>
                updateDraft("review_remark", value)
              }
              onSave={() => savePreset("review_remark")}
              onEdit={beginEdit}
              onCancelEdit={() => cancelEdit("review_remark")}
              onRequestDelete={setPendingDeleteId}
              onDelete={removePreset}
            />

            <PresetPanel
              type="storage_location"
              title="Storage locations"
              description="Frequently used rooms, shelves, cabinets, or folders."
              icon={MapPin}
              presets={presets.filter(
                (preset) => preset.type === "storage_location"
              )}
              draft={drafts.storage_location}
              editingId={editingId}
              pendingDeleteId={pendingDeleteId}
              submitting={submitting}
              onDraftChange={(value) =>
                updateDraft("storage_location", value)
              }
              onSave={() => savePreset("storage_location")}
              onEdit={beginEdit}
              onCancelEdit={() => cancelEdit("storage_location")}
              onRequestDelete={setPendingDeleteId}
              onDelete={removePreset}
            />
          </div>
        )}
      </main>
    </AppShell>
  );
}

function PresetPanel({
  type,
  title,
  description,
  icon: Icon,
  presets,
  draft,
  editingId,
  pendingDeleteId,
  submitting,
  onDraftChange,
  onSave,
  onEdit,
  onCancelEdit,
  onRequestDelete,
  onDelete,
}: {
  type: PresetType;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  presets: ReviewPreset[];
  draft: string;
  editingId: number | null;
  pendingDeleteId: number | null;
  submitting: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onEdit: (preset: ReviewPreset) => void;
  onCancelEdit: () => void;
  onRequestDelete: (id: number | null) => void;
  onDelete: (preset: ReviewPreset) => void;
}) {
  const editingThisType = presets.some(
    (preset) => preset.id === editingId
  );

  return (
    <section className="overflow-hidden rounded-xl border border-[#E0E4E1] bg-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-[#E8EAE8] px-4 py-3.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#075A3A]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#2C322E]">{title}</h2>
            <span className="rounded-full bg-[#F0F3F1] px-2 py-0.5 text-[11px] font-bold text-[#6E756F]">
              {presets.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-5 text-[#7B817C]">
            {description}
          </p>
        </div>
      </div>

      <div className="border-b border-[#E8EAE8] bg-[#FAFBFA] p-3">
        {type === "review_remark" ? (
          <textarea
            rows={2}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Add a reusable remark..."
            maxLength={5000}
            className="w-full resize-none rounded-lg border border-[#D8DDD9] bg-white px-3 py-2 text-sm text-[#2D332F] outline-none focus:border-[#075A3A] focus:ring-2 focus:ring-[#DCEAE2]"
          />
        ) : (
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            placeholder="Archive Room A / Shelf 2"
            maxLength={255}
            className="h-10 w-full rounded-lg border border-[#D8DDD9] bg-white px-3 text-sm text-[#2D332F] outline-none focus:border-[#075A3A] focus:ring-2 focus:ring-[#DCEAE2]"
          />
        )}

        <div className="mt-2 flex justify-end gap-2">
          {editingThisType && (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={submitting}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-bold text-[#687069] hover:bg-[#EEF1EF]"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={submitting || !draft.trim()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#075A3A] px-3 text-xs font-bold text-white hover:bg-[#06472F] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : editingThisType ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {editingThisType ? "Save" : "Add"}
          </button>
        </div>
      </div>

      <div className="divide-y divide-[#ECEEEC]">
        {presets.length === 0 ? (
          <p className="px-4 py-5 text-center text-xs text-[#858B86]">
            No presets yet.
          </p>
        ) : (
          presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-start gap-3 px-4 py-3"
            >
              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-5 text-[#424943]">
                {preset.value}
              </p>

              {pendingDeleteId === preset.id ? (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onDelete(preset)}
                    disabled={submitting}
                    className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(null)}
                    disabled={submitting}
                    className="rounded-md px-2 py-1 text-[11px] font-bold text-[#687069] hover:bg-[#EEF1EF]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => onEdit(preset)}
                    disabled={submitting}
                    aria-label={`Edit ${title.toLowerCase()} preset`}
                    className="rounded-md p-1.5 text-[#687069] hover:bg-[#E8F0EB] hover:text-[#075A3A]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(preset.id)}
                    disabled={submitting}
                    aria-label={`Delete ${title.toLowerCase()} preset`}
                    className="rounded-md p-1.5 text-[#8A777D] hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
