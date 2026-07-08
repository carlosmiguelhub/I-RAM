<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecordCategory extends Model
{
    protected $fillable = [
        'name',
        'description',
        'retention_years',
    ];

    public function records()
    {
        return $this->hasMany(Record::class, 'category_id');
    }
}