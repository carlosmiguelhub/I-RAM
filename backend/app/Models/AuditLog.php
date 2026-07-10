<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id',
        'target_user_id',
        'record_id',
        'action',
        'description',
        'ip_address',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function targetUser()
    {
        return $this->belongsTo(
            User::class,
            'target_user_id'
        );
    }

    public function record()
    {
        return $this->belongsTo(Record::class);
    }
}
