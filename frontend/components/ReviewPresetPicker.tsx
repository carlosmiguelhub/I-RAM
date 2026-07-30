"use client";

import { Check, MapPin, Sparkles } from "lucide-react";

export type ReviewPresetOption = {
  id: number;
  value: string;
};

export default function ReviewPresetPicker({
  presets,
  value,
  disabled = false,
  type,
  onSelect,
}: {
  presets: ReviewPresetOption[];
  value: string;
  disabled?: boolean;
  type: "review_remark" | "storage_location";
  onSelect: (value: string) => void;
}) {
  if (presets.length === 0) return null;

  const isRemark = type === "review_remark";
  const Icon = isRemark ? Sparkles : MapPin;

  return (
    <div className="mt-2.5 rounded-xl border border-[#DCE4DF] bg-[#F7FAF8] p-3 dark:border-[#33445E] dark:bg-[#152238]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E4F0E9] text-[#075A3A] dark:bg-[#1C3B31] dark:text-[#78D6A7]">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-[11px] font-bold text-[#354139] dark:text-[#EDF2F8]">
              Quick presets
            </p>
            <p className="text-[10px] text-[#7B857E] dark:text-[#93A2B5]">
              Select one to fill the field
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#778079] shadow-sm ring-1 ring-[#E0E5E1] dark:bg-[#1C2A40] dark:text-[#AAB8C9] dark:ring-[#33445E]">
          {presets.length}
        </span>
      </div>

      <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
        {presets.map((preset) => {
          const selected = value.trim() === preset.value.trim();

          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              title={preset.value}
              onClick={() => onSelect(preset.value)}
              className={`inline-flex max-w-full items-start gap-1.5 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold leading-4 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-[#075A3A] bg-[#075A3A] text-white shadow-sm ring-2 ring-[#CFE0D6] dark:border-[#78D6A7] dark:bg-[#176B4C] dark:ring-[#315441]"
                  : "border-[#D8E0DB] bg-white text-[#526057] hover:border-[#91BAA3] hover:bg-[#F0F7F3] hover:text-[#075A3A] dark:border-[#33445E] dark:bg-[#1C2A40] dark:text-[#C2CDDB] dark:hover:border-[#5E8D73] dark:hover:bg-[#223149] dark:hover:text-[#8CDBB4]"
              }`}
            >
              {selected && <Check className="mt-0.5 h-3 w-3 shrink-0" />}
              <span className={isRemark ? "line-clamp-2" : "truncate"}>
                {preset.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
