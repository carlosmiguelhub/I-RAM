<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewPreset extends Model
{
    public const REVIEW_REMARK = 'review_remark';

    public const STORAGE_LOCATION = 'storage_location';

    protected $fillable = [
        'type',
        'value',
    ];
}
