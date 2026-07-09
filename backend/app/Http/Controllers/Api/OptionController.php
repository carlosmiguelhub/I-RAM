<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\RecordCategory;

class OptionController extends Controller
{
    public function index()
    {
        return response()->json([
            'departments' => Department::orderBy('name')->get(),
            'categories' => RecordCategory::orderBy('name')->get(),
            'statuses' => [
                'received',
                'under_review',
                'archived',
                'for_disposal',
                'disposed',
            ],
        ]);
    }
}