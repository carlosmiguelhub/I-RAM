<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'role_id',
        'department_id',
        'name',
        'email',
        'password',
        'status',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function records()
    {
        return $this->hasMany(
            Record::class,
            'created_by'
        );
    }

    public function uploadedFiles()
    {
        return $this->hasMany(
            RecordFile::class,
            'uploaded_by'
        );
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }

    public function documentRequests()
    {
        return $this->hasMany(
            DocumentRequest::class,
            'requested_by'
        );
    }

    public function assignedDocumentRequests()
    {
        return $this->hasMany(
            DocumentRequest::class,
            'assigned_to'
        );
    }
}