<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Department;
use App\Models\RecordCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClassificationManagementController extends Controller
{
    public function categories(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $categories = RecordCategory::query()
            ->withCount('records')
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $nested->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $categories,
            'summary' => [
                'total' => RecordCategory::query()->count(),
                'records' => RecordCategory::query()
                    ->withCount('records')
                    ->get()
                    ->sum('records_count'),
            ],
        ]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate($this->categoryRules());
        $category = RecordCategory::create($validated);

        $this->audit(
            $request,
            'category.created',
            "Created record category {$category->name}."
        );

        return response()->json([
            'message' => 'Category created successfully.',
            'data' => $category->loadCount('records'),
        ], 201);
    }

    public function updateCategory(
        Request $request,
        RecordCategory $recordCategory
    ): JsonResponse {
        $oldName = $recordCategory->name;
        $validated = $request->validate(
            $this->categoryRules($recordCategory)
        );

        $recordCategory->update($validated);

        $this->audit(
            $request,
            'category.updated',
            "Updated record category {$oldName}."
        );

        return response()->json([
            'message' => 'Category updated successfully.',
            'data' => $recordCategory->fresh()->loadCount('records'),
        ]);
    }

    public function destroyCategory(
        Request $request,
        RecordCategory $recordCategory
    ): JsonResponse {
        $recordsCount = $recordCategory->records()->count();

        if ($recordsCount > 0) {
            return response()->json([
                'message' => "This category is used by {$recordsCount} record(s). Reassign those records before deleting it.",
            ], 409);
        }

        $name = $recordCategory->name;
        $recordCategory->delete();

        $this->audit(
            $request,
            'category.deleted',
            "Deleted record category {$name}."
        );

        return response()->json([
            'message' => 'Category deleted successfully.',
        ]);
    }

    public function departments(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));

        $departments = Department::query()
            ->withCount(['users', 'records'])
            ->when($search !== '', function ($query) use ($search) {
                $query->where(function ($nested) use ($search) {
                    $nested->where('name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderByRaw(
                "CASE WHEN name = 'Records Office' THEN 0 ELSE 1 END"
            )
            ->orderBy('name')
            ->get()
            ->map(function (Department $department) {
                $department->setAttribute(
                    'accepts_submissions',
                    in_array(
                        $department->name,
                        Department::INSTITUTIONAL_COLLEGES,
                        true
                    )
                );

                return $department;
            });

        return response()->json([
            'data' => $departments,
            'summary' => [
                'total' => Department::query()->count(),
                'assigned_users' => Department::query()
                    ->withCount('users')
                    ->get()
                    ->sum('users_count'),
                'records' => Department::query()
                    ->withCount('records')
                    ->get()
                    ->sum('records_count'),
            ],
        ]);
    }

    public function updateDepartment(
        Request $request,
        Department $department
    ): JsonResponse {
        $validated = $request->validate([
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $department->update($validated);

        $this->audit(
            $request,
            'department.updated',
            "Updated the purpose of {$department->name}."
        );

        return response()->json([
            'message' => 'Department purpose updated successfully.',
            'data' => $department->fresh()->loadCount(['users', 'records']),
        ]);
    }

    private function categoryRules(
        ?RecordCategory $recordCategory = null
    ): array {
        return [
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('record_categories', 'name')
                    ->ignore($recordCategory?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'retention_years' => [
                'required',
                'integer',
                'min:1',
                'max:100',
            ],
        ];
    }

    private function audit(
        Request $request,
        string $action,
        string $description
    ): void {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }
}
