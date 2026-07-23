<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DisposalCase extends Model
{
    protected $fillable = [
        'record_id',
        'requested_by',
        'approved_by',
        'rejected_by',
        'cancelled_by',
        'status',
        'authority_reference',
        'reason',
        'disposal_method',
        'notes',
        'rejection_reason',
        'certificate_number',
        'requested_at',
        'approved_at',
        'rejected_at',
        'cancelled_at',
        'scheduled_purge_at',
        'purge_reminder_sent_at',
        'completed_at',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'scheduled_purge_at' => 'datetime',
        'purge_reminder_sent_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function record()
    {
        return $this->belongsTo(Record::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejecter()
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function canceller()
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
