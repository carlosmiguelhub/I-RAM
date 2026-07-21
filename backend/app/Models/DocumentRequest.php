<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentRequest extends Model
{
    protected $fillable = [
        'record_id',
        'requested_by',
        'assigned_to',
        'purpose',
        'urgency',
        'preferred_format',
        'status',
        'request_notes',
        'review_notes',
        'reviewed_at',
        'approved_at',
        'ready_for_pickup_at',
        'rejected_at',
        'released_at',
        'cancelled_at',
        'expires_at',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
        'approved_at' => 'datetime',
        'ready_for_pickup_at' => 'datetime',
        'rejected_at' => 'datetime',
        'released_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function record()
    {
        return $this->belongsTo(Record::class);
    }

    public function requester()
    {
        return $this->belongsTo(
            User::class,
            'requested_by'
        );
    }

    public function assignee()
    {
        return $this->belongsTo(
            User::class,
            'assigned_to'
        );
    }
}
