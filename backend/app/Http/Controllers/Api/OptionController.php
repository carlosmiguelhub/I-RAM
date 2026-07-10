<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\RecordCategory;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

class OptionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'roles' => Role::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get(),

            'departments' => Department::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get(),

            'categories' => RecordCategory::query()
                ->select('id', 'name')
                ->orderBy('name')
                ->get(),

            'statuses' => [
                'received',
                'under_review',
                'returned_for_correction',
                'archived',
                'for_disposal',
                'disposed',
            ],
        ]);
    }
}
