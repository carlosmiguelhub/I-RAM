<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecordFile extends Model
{
    protected $fillable = [
        'record_id',
        'file_name',
        'file_path',
        'file_type',
        'file_size',
        'uploaded_by',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    public function record()
    {
        return $this->belongsTo(Record::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}