<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Record extends Model
{
    protected $fillable = [
        'record_code',
        'title',
        'description',
        'category_id',
        'department_id',
        'created_by',
        'date_received',
        'source',
        'status',
        'storage_location',
        'remarks',
        'review_remarks',
        'correction_notes',
        'reviewed_by',
        'reviewed_at',
        'returned_by',
        'returned_at',
        'resubmitted_at',
        'archived_by',
        'archived_at',
        'retention_type',
        'retention_years',
        'retention_unit',
        'retention_expires_at',
        'for_disposal_at',
        'disposed_by',
        'disposed_at',
        'disposal_notes',
        'archive_folder_id',

        // Staff archive access
        'staff_visible',
        'access_level',
    ];

    protected $casts = [
        'date_received' => 'date',
        'reviewed_at' => 'datetime',
        'returned_at' => 'datetime',
        'resubmitted_at' => 'datetime',
        'archived_at' => 'datetime',
        'retention_years' => 'integer',
        'retention_expires_at' => 'datetime',
        'for_disposal_at' => 'datetime',
        'disposed_at' => 'datetime',
        'staff_visible' => 'boolean',
    ];

    public function category()
    {
        return $this->belongsTo(
            RecordCategory::class,
            'category_id'
        );
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function creator()
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function reviewer()
    {
        return $this->belongsTo(
            User::class,
            'reviewed_by'
        );
    }

    public function returner()
    {
        return $this->belongsTo(
            User::class,
            'returned_by'
        );
    }

    public function archiver()
    {
        return $this->belongsTo(
            User::class,
            'archived_by'
        );
    }

    public function disposer()
    {
        return $this->belongsTo(
            User::class,
            'disposed_by'
        );
    }

    public function archiveFolder()
    {
        return $this->belongsTo(
            ArchiveFolder::class,
            'archive_folder_id'
        );
    }

    public function files()
    {
        return $this->hasMany(RecordFile::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    public function documentRequests()
    {
        return $this->hasMany(DocumentRequest::class);
    }
}
