<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArchiveFolder extends Model
{
    protected $fillable = [
        'name',
        'description',
        'created_by',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function records()
    {
        return $this->hasMany(Record::class, 'archive_folder_id');
    }
}
