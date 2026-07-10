"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronRight,
  FileCog,
  FileText,
  FolderLock,
  Loader2,
  LockKeyhole,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  UploadCloud,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type SettingsPayload = {
  general: {
    system_name: string;
    organization_name: string;
    contact_email: string;
    timezone: string;
    date_format: string;
  };
  records: {
    record_code_prefix: string;
    require_storage_location: boolean;
    require_submission_remarks: boolean;
  };
  workflow: {
    require_records_officer_review: boolean;
    allow_admin_review: boolean;
    require_correction_notes: boolean;
    lock_archived_records: boolean;
  };
  files: {
    max_upload_size_mb: number;
    max_files_per_submission: number;
    allowed_extensions: string[];
  };
  security: {
    allow_registration: boolean;
    default_registered_role: string;
    session_timeout_minutes: number;
    login_attempt_limit: number;
  };
};

type SectionKey =
  | "general"
  | "records"
  | "workflow"
  | "files"
  | "security";

const defaultSettings: SettingsPayload = {
  general: {
    system_name: "IRAM",
    organization_name:
      "Record Acquisition and Archiving Management System",
    contact_email: "",
    timezone: "Asia/Manila",
    date_format: "M d, Y",
  },
  records: {
    record_code_prefix: "IRAM",
    require_storage_location: true,
    require_submission_remarks: false,
  },
  workflow: {
    require_records_officer_review: true,
    allow_admin_review: true,
    require_correction_notes: true,
    lock_archived_records: true,
  },
  files: {
    max_upload_size_mb: 25,
    max_files_per_submission: 10,
    allowed_extensions: [
      "pdf",
      "doc",
      "docx",
      "xls",
      "xlsx",
      "jpg",
      "jpeg",
      "png",
    ],
  },
  security: {
    allow_registration: true,
    default_registered_role: "Staff",
    session_timeout_minutes: 120,
    login_attempt_limit: 5,
  },
};

const sections: Array<{
  key: SectionKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: "general",
    label: "General",
    description: "System identity and organization details",
    icon: Settings2,
  },
  {
    key: "records",
    label: "Records",
    description: "Record numbering and submission requirements",
    icon: FileText,
  },
  {
    key: "workflow",
    label: "Workflow",
    description: "Review, correction, and archive controls",
    icon: SlidersHorizontal,
  },
  {
    key: "files",
    label: "Files",
    description: "Upload limits and permitted file types",
    icon: UploadCloud,
  },
  {
    key: "security",
    label: "Security",
    description: "Registration, sessions, and login safeguards",
    icon: ShieldCheck,
  },
];

const availableExtensions = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
];

export default function AdminSettingsPage() {
  const router = useRouter();

  const [settings, setSettings] =
    useState<SettingsPayload>(defaultSettings);
  const [savedSettings, setSavedSettings] =
    useState<SettingsPayload>(defaultSettings);

  const [activeSection, setActiveSection] =
    useState<SectionKey>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const hasChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  useEffect(() => {
    async function initialize() {
      try {
        const meData = await apiRequest("/me");
        const role = meData.user?.role?.name;

        if (role !== "Admin") {
          router.replace("/dashboard");
          return;
        }

        const data = await apiRequest("/admin/settings");
        const normalized = normalizeSettings(data.settings);

        setSettings(normalized);
        setSavedSettings(normalized);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load system settings."
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [router]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!hasChanges) return;

      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges]);

  function updateGeneral<K extends keyof SettingsPayload["general"]>(
    key: K,
    value: SettingsPayload["general"][K]
  ) {
    setSettings((current) => ({
      ...current,
      general: {
        ...current.general,
        [key]: value,
      },
    }));
    clearMessages();
  }

  function updateRecords<K extends keyof SettingsPayload["records"]>(
    key: K,
    value: SettingsPayload["records"][K]
  ) {
    setSettings((current) => ({
      ...current,
      records: {
        ...current.records,
        [key]: value,
      },
    }));
    clearMessages();
  }

  function updateWorkflow<K extends keyof SettingsPayload["workflow"]>(
    key: K,
    value: SettingsPayload["workflow"][K]
  ) {
    setSettings((current) => ({
      ...current,
      workflow: {
        ...current.workflow,
        [key]: value,
      },
    }));
    clearMessages();
  }

  function updateFiles<K extends keyof SettingsPayload["files"]>(
    key: K,
    value: SettingsPayload["files"][K]
  ) {
    setSettings((current) => ({
      ...current,
      files: {
        ...current.files,
        [key]: value,
      },
    }));
    clearMessages();
  }

  function updateSecurity<K extends keyof SettingsPayload["security"]>(
    key: K,
    value: SettingsPayload["security"][K]
  ) {
    setSettings((current) => ({
      ...current,
      security: {
        ...current.security,
        [key]: value,
      },
    }));
    clearMessages();
  }

  function toggleExtension(extension: string) {
    const current = settings.files.allowed_extensions;
    const exists = current.includes(extension);

    updateFiles(
      "allowed_extensions",
      exists
        ? current.filter((item) => item !== extension)
        : [...current, extension]
    );
  }

  function clearMessages() {
    if (error) setError("");
    if (success) setSuccess("");
  }

  async function saveSettings() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const data = await apiRequest("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });

      setSavedSettings(settings);
      setSuccess(
        data.message || "System settings updated successfully."
      );
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update system settings."
      );
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    if (!hasChanges) return;

    const confirmed = window.confirm(
      "Discard all unsaved settings changes?"
    );

    if (!confirmed) return;

    setResetting(true);
    setSettings(savedSettings);
    setError("");
    setSuccess("Unsaved changes were discarded.");

    window.setTimeout(() => {
      setResetting(false);
    }, 300);
  }

  const currentSection =
    sections.find((section) => section.key === activeSection) ??
    sections[0];
  const CurrentSectionIcon = currentSection.icon;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-xl shadow-slate-300/30 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <FileCog className="h-7 w-7 text-blue-200" />
              </div>

              <div>
                <p className="text-sm font-semibold text-blue-200">
                  Administration
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  System Settings
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Configure how IRAM handles records, workflows, file uploads,
                  registration, and system-wide safeguards.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={discardChanges}
                disabled={!hasChanges || saving || resetting}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${
                    resetting ? "animate-spin" : ""
                  }`}
                />
                Discard changes
              </button>

              <button
                type="button"
                onClick={saveSettings}
                disabled={!hasChanges || saving || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </section>

        {error && (
          <Alert tone="error">
            {error}
          </Alert>
        )}

        {success && (
          <Alert tone="success">
            {success}
          </Alert>
        )}

        {hasChanges && !success && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            You have unsaved changes.
          </div>
        )}

        <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[290px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
            <div className="px-3 pb-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Settings sections
              </p>
            </div>

            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const active = section.key === activeSection;

                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveSection(section.key)}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      active
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        active
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:ring-1 group-hover:ring-slate-200"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {section.label}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                        {section.description}
                      </span>
                    </span>

                    <ChevronRight
                      className={`h-4 w-4 shrink-0 ${
                        active
                          ? "text-blue-600"
                          : "text-slate-300"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0 rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <header className="border-b border-slate-200 px-5 py-5 sm:px-7">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                  <CurrentSectionIcon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-slate-950">
                    {currentSection.label} settings
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {currentSection.description}.
                  </p>
                </div>
              </div>
            </header>

            <div className="p-5 sm:p-7">
              {loading ? (
                <div className="flex min-h-80 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-blue-600" />
                    <p className="mt-3 text-sm font-medium text-slate-500">
                      Loading system settings...
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {activeSection === "general" && (
                    <GeneralSettings
                      values={settings.general}
                      onChange={updateGeneral}
                    />
                  )}

                  {activeSection === "records" && (
                    <RecordSettings
                      values={settings.records}
                      onChange={updateRecords}
                    />
                  )}

                  {activeSection === "workflow" && (
                    <WorkflowSettings
                      values={settings.workflow}
                      onChange={updateWorkflow}
                    />
                  )}

                  {activeSection === "files" && (
                    <FileSettings
                      values={settings.files}
                      onChange={updateFiles}
                      onToggleExtension={toggleExtension}
                    />
                  )}

                  {activeSection === "security" && (
                    <SecuritySettings
                      values={settings.security}
                      onChange={updateSecurity}
                    />
                  )}
                </>
              )}
            </div>

            {!loading && (
              <footer className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <p className="text-xs leading-5 text-slate-500">
                  Changes affect IRAM system-wide and are recorded in the audit
                  trail.
                </p>

                <button
                  type="button"
                  onClick={saveSettings}
                  disabled={!hasChanges || saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? "Saving..." : "Save settings"}
                </button>
              </footer>
            )}
          </section>
        </section>
      </div>
    </AppShell>
  );
}

function GeneralSettings({
  values,
  onChange,
}: {
  values: SettingsPayload["general"];
  onChange: <K extends keyof SettingsPayload["general"]>(
    key: K,
    value: SettingsPayload["general"][K]
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsGroup
        icon={<Settings2 className="h-5 w-5" />}
        title="System identity"
        description="The primary name and organization displayed across IRAM."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="System name" hint="Displayed in system headings.">
            <input
              value={values.system_name}
              onChange={(event) =>
                onChange("system_name", event.target.value)
              }
              maxLength={100}
              className={inputClass}
            />
          </Field>

          <Field
            label="Organization name"
            hint="The institution operating this IRAM installation."
          >
            <input
              value={values.organization_name}
              onChange={(event) =>
                onChange("organization_name", event.target.value)
              }
              maxLength={255}
              className={inputClass}
            />
          </Field>
        </div>
      </SettingsGroup>

      <SettingsGroup
        icon={<Archive className="h-5 w-5" />}
        title="Regional preferences"
        description="Default contact and display conventions."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Contact email" hint="Used for system contact details.">
            <input
              value={values.contact_email}
              onChange={(event) =>
                onChange("contact_email", event.target.value)
              }
              type="email"
              placeholder="records@example.com"
              className={inputClass}
            />
          </Field>

          <Field label="Timezone">
            <select
              value={values.timezone}
              onChange={(event) =>
                onChange("timezone", event.target.value)
              }
              className={inputClass}
            >
              <option value="Asia/Manila">Asia/Manila</option>
              <option value="UTC">UTC</option>
              <option value="Asia/Singapore">Asia/Singapore</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </Field>

          <Field label="Date format">
            <select
              value={values.date_format}
              onChange={(event) =>
                onChange("date_format", event.target.value)
              }
              className={inputClass}
            >
              <option value="M d, Y">Jul 10, 2026</option>
              <option value="F d, Y">July 10, 2026</option>
              <option value="d/m/Y">10/07/2026</option>
              <option value="Y-m-d">2026-07-10</option>
            </select>
          </Field>
        </div>
      </SettingsGroup>
    </div>
  );
}

function RecordSettings({
  values,
  onChange,
}: {
  values: SettingsPayload["records"];
  onChange: <K extends keyof SettingsPayload["records"]>(
    key: K,
    value: SettingsPayload["records"][K]
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsGroup
        icon={<FileText className="h-5 w-5" />}
        title="Record identification"
        description="Configure how new records are labeled."
      >
        <div className="max-w-xl">
          <Field
            label="Record code prefix"
            hint="Letters, numbers, hyphens, and underscores only."
          >
            <input
              value={values.record_code_prefix}
              onChange={(event) =>
                onChange(
                  "record_code_prefix",
                  event.target.value.toUpperCase()
                )
              }
              maxLength={20}
              className={inputClass}
            />
          </Field>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
              Example
            </p>
            <p className="mt-1 font-mono text-sm font-semibold text-blue-950">
              {values.record_code_prefix || "IRAM"}-2026-000001
            </p>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup
        icon={<FolderLock className="h-5 w-5" />}
        title="Submission requirements"
        description="Control which details users must provide."
      >
        <div className="space-y-3">
          <ToggleRow
            title="Require storage location before archiving"
            description="Records cannot be archived until a physical or digital storage location is provided."
            checked={values.require_storage_location}
            onChange={(checked) =>
              onChange("require_storage_location", checked)
            }
          />

          <ToggleRow
            title="Require submission remarks"
            description="Staff and authorized users must provide remarks when submitting a record."
            checked={values.require_submission_remarks}
            onChange={(checked) =>
              onChange("require_submission_remarks", checked)
            }
          />
        </div>
      </SettingsGroup>
    </div>
  );
}

function WorkflowSettings({
  values,
  onChange,
}: {
  values: SettingsPayload["workflow"];
  onChange: <K extends keyof SettingsPayload["workflow"]>(
    key: K,
    value: SettingsPayload["workflow"][K]
  ) => void;
}) {
  return (
    <SettingsGroup
      icon={<SlidersHorizontal className="h-5 w-5" />}
      title="Record lifecycle"
      description="Configure review, correction, and archive behavior."
    >
      <div className="space-y-3">
        <ToggleRow
          title="Require Records Officer review"
          description="Submitted records must be reviewed before they can proceed to archiving."
          checked={values.require_records_officer_review}
          onChange={(checked) =>
            onChange("require_records_officer_review", checked)
          }
        />

        <ToggleRow
          title="Allow Admin review"
          description="Administrators may perform record review actions in addition to Records Officers."
          checked={values.allow_admin_review}
          onChange={(checked) =>
            onChange("allow_admin_review", checked)
          }
        />

        <ToggleRow
          title="Require correction notes"
          description="A reason must be provided whenever a record is returned to Staff for correction."
          checked={values.require_correction_notes}
          onChange={(checked) =>
            onChange("require_correction_notes", checked)
          }
        />

        <ToggleRow
          title="Lock archived records"
          description="Archived records cannot be edited unless they are restored through an authorized workflow."
          checked={values.lock_archived_records}
          onChange={(checked) =>
            onChange("lock_archived_records", checked)
          }
        />
      </div>
    </SettingsGroup>
  );
}

function FileSettings({
  values,
  onChange,
  onToggleExtension,
}: {
  values: SettingsPayload["files"];
  onChange: <K extends keyof SettingsPayload["files"]>(
    key: K,
    value: SettingsPayload["files"][K]
  ) => void;
  onToggleExtension: (extension: string) => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsGroup
        icon={<UploadCloud className="h-5 w-5" />}
        title="Upload limits"
        description="Set limits for uploaded record documents."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Maximum file size" suffix="MB">
            <input
              type="number"
              min={1}
              max={100}
              value={values.max_upload_size_mb}
              onChange={(event) =>
                onChange(
                  "max_upload_size_mb",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>

          <Field label="Maximum files per submission">
            <input
              type="number"
              min={1}
              max={50}
              value={values.max_files_per_submission}
              onChange={(event) =>
                onChange(
                  "max_files_per_submission",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>
        </div>
      </SettingsGroup>

      <SettingsGroup
        icon={<FileCog className="h-5 w-5" />}
        title="Allowed file types"
        description="Select the document formats accepted by IRAM."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {availableExtensions.map((extension) => {
            const selected =
              values.allowed_extensions.includes(extension);

            return (
              <button
                key={extension}
                type="button"
                onClick={() => onToggleExtension(extension)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold uppercase transition ${
                  selected
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                .{extension}
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    selected
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {selected && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {values.allowed_extensions.length === 0 && (
          <p className="mt-3 text-sm font-medium text-red-600">
            Select at least one allowed file type.
          </p>
        )}
      </SettingsGroup>
    </div>
  );
}

function SecuritySettings({
  values,
  onChange,
}: {
  values: SettingsPayload["security"];
  onChange: <K extends keyof SettingsPayload["security"]>(
    key: K,
    value: SettingsPayload["security"][K]
  ) => void;
}) {
  return (
    <div className="space-y-6">
      <SettingsGroup
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Account registration"
        description="Configure who may create accounts."
      >
        <div className="space-y-4">
          <ToggleRow
            title="Allow public registration"
            description="Users may create an account from the IRAM registration page."
            checked={values.allow_registration}
            onChange={(checked) =>
              onChange("allow_registration", checked)
            }
          />

          <div className="max-w-md">
            <Field
              label="Default registered role"
              hint="Applied to newly registered accounts."
            >
              <select
                value={values.default_registered_role}
                disabled={!values.allow_registration}
                onChange={(event) =>
                  onChange(
                    "default_registered_role",
                    event.target.value
                  )
                }
                className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <option value="Staff">Staff</option>
                <option value="Records Officer">
                  Records Officer
                </option>
                <option value="Admin">Admin</option>
              </select>
            </Field>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup
        icon={<LockKeyhole className="h-5 w-5" />}
        title="Session and login safeguards"
        description="Control session duration and failed login limits."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Session timeout"
            hint="Between 15 and 1,440 minutes."
            suffix="minutes"
          >
            <input
              type="number"
              min={15}
              max={1440}
              value={values.session_timeout_minutes}
              onChange={(event) =>
                onChange(
                  "session_timeout_minutes",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>

          <Field
            label="Login attempt limit"
            hint="Between 3 and 20 attempts."
            suffix="attempts"
          >
            <input
              type="number"
              min={3}
              max={20}
              value={values.login_attempt_limit}
              onChange={(event) =>
                onChange(
                  "login_attempt_limit",
                  Number(event.target.value)
                )
              }
              className={inputClass}
            />
          </Field>
        </div>
      </SettingsGroup>
    </div>
  );
}

function SettingsGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200">
      <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
          {icon}
        </div>

        <div>
          <h3 className="font-bold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </header>

      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  suffix,
  children,
}: {
  label: string;
  hint?: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">
        {label}
      </span>

      <div className="relative mt-2">
        {children}

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
            {suffix}
          </span>
        )}
      </div>

      {hint && (
        <span className="mt-2 block text-xs leading-5 text-slate-500">
          {hint}
        </span>
      )}
    </label>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
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

function normalizeSettings(
  input: Partial<SettingsPayload> | undefined
): SettingsPayload {
  return {
    general: {
      ...defaultSettings.general,
      ...(input?.general ?? {}),
    },
    records: {
      ...defaultSettings.records,
      ...(input?.records ?? {}),
    },
    workflow: {
      ...defaultSettings.workflow,
      ...(input?.workflow ?? {}),
    },
    files: {
      ...defaultSettings.files,
      ...(input?.files ?? {}),
      allowed_extensions:
        input?.files?.allowed_extensions ??
        defaultSettings.files.allowed_extensions,
    },
    security: {
      ...defaultSettings.security,
      ...(input?.security ?? {}),
    },
  };
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50";
