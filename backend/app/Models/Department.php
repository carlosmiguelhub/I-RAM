<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    protected $fillable = [
        'name',
        'description',
        'accepts_submissions',
    ];

    protected $casts = [
        'accepts_submissions' => 'boolean',
    ];

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function records()
    {
        return $this->hasMany(Record::class);
    }
}
