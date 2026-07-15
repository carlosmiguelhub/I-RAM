<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecordFile extends Model
{
    protected $fillable = [
        'record_id',
        'original_name',
        'stored_name',
        'file_path',
        'mime_type',
        'file_size',
        'uploaded_by',
    ];

    protected $appends = [
        'file_name',
        'file_type',
    ];

    protected $hidden = [
        'original_name',
        'stored_name',
        'mime_type',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function getFileNameAttribute(): string
    {
        return $this->original_name;
    }

    public function getFileTypeAttribute(): ?string
    {
        return $this->mime_type;
    }

    public function record()
    {
        return $this->belongsTo(Record::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
