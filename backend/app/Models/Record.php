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
        'reviewed_by',
        'reviewed_at',
        'archived_by',
        'archived_at',
    ];

    protected $casts = [
        'date_received' => 'date',
        'reviewed_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function category()
    {
        return $this->belongsTo(RecordCategory::class, 'category_id');
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function archiver()
    {
        return $this->belongsTo(User::class, 'archived_by');
    }

    public function files()
    {
        return $this->hasMany(RecordFile::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
