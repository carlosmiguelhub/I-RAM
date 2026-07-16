<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    public const INSTITUTIONAL_COLLEGES = [
        'College of Technology (COT)',
        'College of Engineering (COE)',
        'College of Education Arts and Sciences (CEAS)',
        'College of Management and Entrepreneurship (CME)',
    ];

    protected $fillable = [
        'name',
        'description',
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
