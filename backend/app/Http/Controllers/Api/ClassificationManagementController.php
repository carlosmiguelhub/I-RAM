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
            ->get();

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

    public function storeDepartment(Request $request): JsonResponse
    {
        $validated = $request->validate($this->departmentRules());
        $department = Department::create($validated);

        $this->audit(
            $request,
            'department.created',
            "Created department {$department->name}."
        );

        return response()->json([
            'message' => 'Department created successfully.',
            'data' => $department->loadCount(['users', 'records']),
        ], 201);
    }

    public function updateDepartment(
        Request $request,
        Department $department
    ): JsonResponse {
        $oldName = $department->name;
        $validated = $request->validate(
            $this->departmentRules($department)
        );

        $department->update($validated);

        $this->audit(
            $request,
            'department.updated',
            "Updated department {$oldName}."
        );

        return response()->json([
            'message' => 'Department updated successfully.',
            'data' => $department->fresh()->loadCount(['users', 'records']),
        ]);
    }

    public function destroyDepartment(
        Request $request,
        Department $department
    ): JsonResponse {
        $usersCount = $department->users()->count();
        $recordsCount = $department->records()->count();

        if ($usersCount > 0 || $recordsCount > 0) {
            return response()->json([
                'message' => "This department has {$usersCount} user(s) and {$recordsCount} record(s). Reassign them before deleting it.",
            ], 409);
        }

        $name = $department->name;
        $department->delete();

        $this->audit(
            $request,
            'department.deleted',
            "Deleted department {$name}."
        );

        return response()->json([
            'message' => 'Department deleted successfully.',
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
        ];
    }

    private function departmentRules(
        ?Department $department = null
    ): array {
        return [
            'name' => [
                'required',
                'string',
                'max:120',
                Rule::unique('departments', 'name')
                    ->ignore($department?->id),
            ],
            'description' => ['nullable', 'string', 'max:1000'],
            'accepts_submissions' => ['required', 'boolean'],
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
