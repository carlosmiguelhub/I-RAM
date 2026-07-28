import { apiRequest } from "@/lib/api";

export type ClientSystemSettings = {
  general: {
    system_name: string;
    organization_name: string;
    contact_email: string;
  };
  records: {
    record_code_prefix: string;
    require_storage_location: boolean;
    require_submission_remarks: boolean;
  };
  workflow: {
    allow_admin_review: boolean;
    require_correction_notes: boolean;
    lock_archived_records: boolean;
    disposal_grace_days: number;
  };
  files: {
    max_upload_size_mb: number;
    max_files_per_submission: number;
    allowed_extensions: string[];
  };
};

export const defaultClientSystemSettings: ClientSystemSettings = {
  general: {
    system_name: "IRAM",
    organization_name:
      "Record Acquisition and Archiving Management System",
    contact_email: "",
  },
  records: {
    record_code_prefix: "IRAM",
    require_storage_location: true,
    require_submission_remarks: false,
  },
  workflow: {
    allow_admin_review: true,
    require_correction_notes: true,
    lock_archived_records: true,
    disposal_grace_days: 30,
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
};

export async function loadClientSystemSettings(): Promise<ClientSystemSettings> {
  const data = await apiRequest("/system-settings");
  const settings = data.settings || {};

  return {
    general: {
      ...defaultClientSystemSettings.general,
      ...settings.general,
    },
    records: {
      ...defaultClientSystemSettings.records,
      ...settings.records,
    },
    workflow: {
      ...defaultClientSystemSettings.workflow,
      ...settings.workflow,
    },
    files: {
      ...defaultClientSystemSettings.files,
      ...settings.files,
      max_files_per_submission: Math.min(
        10,
        Math.max(
          1,
          Number(
            settings.files?.max_files_per_submission ??
              defaultClientSystemSettings.files.max_files_per_submission
          )
        )
      ),
    },
  };
}

export async function loadPublicSystemSettings() {
  const data = await apiRequest("/public-settings");

  return {
    general: {
      ...defaultClientSystemSettings.general,
      ...(data.settings?.general || {}),
    },
    security: {
      allow_registration:
        data.settings?.security?.allow_registration ?? true,
    },
  };
}
