# IRAM Entity Relationship Diagram

This ERD reflects the current Laravel migrations and Eloquent relationships.
It focuses on IRAM domain data. Laravel infrastructure tables are listed
separately below.

```mermaid
erDiagram
    ROLES {
        bigint id PK
        varchar name UK
        text description
        timestamp created_at
        timestamp updated_at
    }

    DEPARTMENTS {
        bigint id PK
        varchar name UK
        text description
        boolean accepts_submissions
        timestamp created_at
        timestamp updated_at
    }

    USERS {
        bigint id PK
        bigint role_id FK
        bigint department_id FK
        varchar name
        varchar email UK
        timestamp email_verified_at
        timestamp activated_at
        varchar password
        enum status
        varchar remember_token
        timestamp created_at
        timestamp updated_at
    }

    RECORD_CATEGORIES {
        bigint id PK
        varchar name UK
        text description
        timestamp created_at
        timestamp updated_at
    }

    ARCHIVE_FOLDERS {
        bigint id PK
        bigint parent_id FK
        bigint created_by FK
        varchar name
        text description
        timestamp created_at
        timestamp updated_at
    }

    RECORDS {
        bigint id PK
        varchar record_code UK
        varchar title
        text description
        bigint category_id FK
        bigint department_id FK
        bigint created_by FK
        date date_received
        varchar source
        enum status
        varchar storage_location
        text remarks
        text review_remarks
        text correction_notes
        bigint reviewed_by FK
        timestamp reviewed_at
        bigint returned_by FK
        timestamp returned_at
        timestamp resubmitted_at
        bigint archived_by FK
        timestamp archived_at
        bigint archive_folder_id FK
        boolean staff_visible
        varchar access_level
        varchar retention_type
        smallint retention_years
        varchar retention_unit
        timestamp retention_expires_at
        timestamp for_disposal_at
        bigint disposed_by FK
        timestamp disposed_at
        text disposal_notes
        boolean legal_hold
        text legal_hold_reason
        bigint legal_hold_by FK
        timestamp legal_hold_at
        timestamp created_at
        timestamp updated_at
    }

    RECORD_FILES {
        bigint id PK
        bigint record_id FK
        bigint uploaded_by FK
        varchar original_name
        varchar stored_name
        varchar file_path
        varchar mime_type
        bigint file_size
        timestamp purged_at
        bigint purged_by FK
        text purge_reason
        timestamp created_at
        timestamp updated_at
    }

    DOCUMENT_REQUESTS {
        bigint id PK
        bigint record_id FK
        bigint requested_by FK
        bigint assigned_to FK
        varchar purpose
        varchar urgency
        varchar preferred_format
        varchar status
        text request_notes
        text review_notes
        timestamp reviewed_at
        timestamp approved_at
        timestamp ready_for_pickup_at
        varchar claim_code UK
        timestamp rejected_at
        timestamp released_at
        timestamp cancelled_at
        timestamp expires_at
        timestamp created_at
        timestamp updated_at
    }

    DISPOSAL_CASES {
        bigint id PK
        bigint record_id FK
        bigint requested_by FK
        bigint approved_by FK
        bigint rejected_by FK
        bigint cancelled_by FK
        varchar status
        varchar authority_reference
        text reason
        varchar disposal_method
        text notes
        text rejection_reason
        varchar certificate_number UK
        timestamp requested_at
        timestamp approved_at
        timestamp rejected_at
        timestamp cancelled_at
        timestamp scheduled_purge_at
        timestamp purge_reminder_sent_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }

    AUDIT_LOGS {
        bigint id PK
        bigint user_id FK
        bigint target_user_id FK
        bigint record_id FK
        varchar action
        text description
        varchar ip_address
        timestamp created_at
        timestamp updated_at
    }

    SYSTEM_SETTINGS {
        bigint id PK
        varchar group
        varchar key UK
        text value
        varchar type
        boolean is_public
        timestamp created_at
        timestamp updated_at
    }

    NOTIFICATIONS {
        uuid id PK
        varchar type
        varchar notifiable_type
        bigint notifiable_id
        text data
        timestamp read_at
        timestamp created_at
        timestamp updated_at
    }

    ROLES ||--o{ USERS : assigns
    DEPARTMENTS ||--o{ USERS : contains
    DEPARTMENTS ||--o{ RECORDS : owns
    RECORD_CATEGORIES ||--o{ RECORDS : classifies

    USERS ||--o{ RECORDS : creates
    USERS ||--o{ RECORDS : reviews
    USERS ||--o{ RECORDS : returns
    USERS ||--o{ RECORDS : archives
    USERS ||--o{ RECORDS : disposes
    USERS ||--o{ RECORDS : places_legal_hold

    USERS ||--o{ ARCHIVE_FOLDERS : creates
    ARCHIVE_FOLDERS o|--o{ ARCHIVE_FOLDERS : contains
    ARCHIVE_FOLDERS o|--o{ RECORDS : stores

    RECORDS ||--o{ RECORD_FILES : has
    USERS ||--o{ RECORD_FILES : uploads
    USERS ||--o{ RECORD_FILES : purges

    RECORDS ||--o{ DOCUMENT_REQUESTS : receives
    USERS ||--o{ DOCUMENT_REQUESTS : requests
    USERS o|--o{ DOCUMENT_REQUESTS : handles

    RECORDS ||--o{ DISPOSAL_CASES : has
    USERS o|--o{ DISPOSAL_CASES : requests
    USERS o|--o{ DISPOSAL_CASES : approves
    USERS o|--o{ DISPOSAL_CASES : rejects
    USERS o|--o{ DISPOSAL_CASES : cancels

    USERS o|--o{ AUDIT_LOGS : performs
    USERS o|--o{ AUDIT_LOGS : targets
    RECORDS o|--o{ AUDIT_LOGS : records

    USERS ||--o{ NOTIFICATIONS : receives
```

## Relationship notes

- A User belongs to one Role and may belong to one Department.
- A Record belongs to one category, department, and creator.
- Review, correction, archive, disposal, and legal-hold user references on a
  Record are nullable so history survives account deletion.
- An Archive Folder may contain child folders and records.
- Record Files store metadata in MySQL. The actual uploaded document is stored
  under `backend/storage/app/private/records`.
- A Document Request belongs to one Record and requester. Its assignee is
  optional until a manager starts processing it.
- A Disposal Case belongs to one Record. Workflow actor references are
  optional and use `nullOnDelete`.
- Audit Logs may reference the acting user, affected user, and related Record.
- Notifications use Laravel's polymorphic `notifiable_type` and
  `notifiable_id` columns. In IRAM they currently target Users, but the
  database does not enforce a direct foreign key.
- System Settings are independent key/value configuration records.

## Record lifecycle

```mermaid
stateDiagram-v2
    [*] --> received: submitted
    received --> under_review: review started
    under_review --> returned_for_correction: correction requested
    returned_for_correction --> received: corrected and resubmitted
    under_review --> archived: approved and archived
    archived --> for_disposal: retention expired
    for_disposal --> archived: restored
    for_disposal --> disposed: disposal completed
```

## Document request lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: Staff submits request
    pending --> under_review: processing starts
    under_review --> approved: approved
    under_review --> rejected: rejected
    approved --> ready_for_pickup: printed copy prepared
    approved --> released: digital or view-only released
    ready_for_pickup --> released: claimant receives copy
    pending --> cancelled: requester cancels
    under_review --> cancelled: requester cancels
```

## Laravel infrastructure tables

These support the application but are omitted from the main ERD to keep the
domain model readable:

| Table | Purpose |
| --- | --- |
| `personal_access_tokens` | Sanctum API authentication |
| `sessions` | Database-backed browser sessions |
| `password_reset_tokens` | Password reset tokens |
| `cache`, `cache_locks` | Laravel cache and locks |
| `jobs`, `job_batches`, `failed_jobs` | Database queue processing |
| `migrations` | Applied migration history |

## Source of truth

The executable schema remains the migration set in:

```text
backend/database/migrations
```

Update this ERD whenever a migration adds, removes, or changes a domain table
or foreign key.
