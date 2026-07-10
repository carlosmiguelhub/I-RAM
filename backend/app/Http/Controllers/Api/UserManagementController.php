<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserManagementController extends Controller
{
    public function index(Request $request)
    {
        $query = User::with(['role', 'department']);

        if ($request->filled('search')) {
            $search = trim((string) $request->search);

            $query->where(function ($query) use ($search) {
                $query
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role_id')) {
            $query->where('role_id', $request->integer('role_id'));
        }

        if ($request->filled('department_id')) {
            $query->where(
                'department_id',
                $request->integer('department_id')
            );
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json(
            $query
                ->orderBy('name')
                ->paginate(15)
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                'unique:users,email',
            ],
            'role_id' => ['required', 'exists:roles,id'],
            'department_id' => [
                'nullable',
                'exists:departments,id',
            ],
            'status' => [
                'required',
                Rule::in(['active', 'inactive']),
            ],
            'password' => [
                'required',
                'confirmed',
                Password::min(8)->letters()->numbers(),
            ],
        ]);

        $role = Role::findOrFail($validated['role_id']);

        if (
            in_array($role->name, ['Staff', 'Records Officer'], true)
            && empty($validated['department_id'])
        ) {
            return response()->json([
                'message' => 'A department is required for Staff and Records Officer accounts.',
            ], 422);
        }

        $user = DB::transaction(function () use (
            $request,
            $validated,
            $role
        ) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'role_id' => $role->id,
                'department_id' =>
                    $validated['department_id'] ?? null,
                'status' => $validated['status'],
                'password' => Hash::make(
                    $validated['password']
                ),
            ]);

            $this->audit(
                $request,
                $user,
                'created_user',
                "Created user {$user->name} with role {$role->name}."
            );

            return $user;
        });

        return response()->json([
            'message' => 'User created successfully.',
            'user' => $user->load(['role', 'department']),
        ], 201);
    }

    public function show(User $user)
    {
        return response()->json([
            'user' => $user->load(['role', 'department']),
        ]);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'role_id' => ['required', 'exists:roles,id'],
            'department_id' => [
                'nullable',
                'exists:departments,id',
            ],
        ]);

        $newRole = Role::findOrFail($validated['role_id']);

        if (
            in_array(
                $newRole->name,
                ['Staff', 'Records Officer'],
                true
            )
            && empty($validated['department_id'])
        ) {
            return response()->json([
                'message' => 'A department is required for Staff and Records Officer accounts.',
            ], 422);
        }

        if (
            $request->user()->id === $user->id
            && $newRole->name !== 'Admin'
        ) {
            return response()->json([
                'message' => 'You cannot remove your own Administrator role.',
            ], 422);
        }

        $oldRole = $user->role?->name ?? 'None';
        $oldDepartment =
            $user->department?->name ?? 'None';

        DB::transaction(function () use (
            $request,
            $user,
            $validated,
            $newRole,
            $oldRole,
            $oldDepartment
        ) {
            $user->update([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'role_id' => $newRole->id,
                'department_id' =>
                    $validated['department_id'] ?? null,
            ]);

            $user->load(['role', 'department']);

            $description = "Updated user {$user->name}.";

            if ($oldRole !== $user->role?->name) {
                $description .= " Role changed from {$oldRole} to {$user->role?->name}.";
            }

            $newDepartment =
                $user->department?->name ?? 'None';

            if ($oldDepartment !== $newDepartment) {
                $description .= " Department changed from {$oldDepartment} to {$newDepartment}.";
            }

            $this->audit(
                $request,
                $user,
                'updated_user',
                $description
            );
        });

        return response()->json([
            'message' => 'User updated successfully.',
            'user' => $user->fresh()->load([
                'role',
                'department',
            ]),
        ]);
    }

    public function updateStatus(
        Request $request,
        User $user
    ) {
        $validated = $request->validate([
            'status' => [
                'required',
                Rule::in(['active', 'inactive']),
            ],
        ]);

        if (
            $request->user()->id === $user->id
            && $validated['status'] === 'inactive'
        ) {
            return response()->json([
                'message' => 'You cannot deactivate your own account.',
            ], 422);
        }

        if (
            $user->role?->name === 'Admin'
            && $validated['status'] === 'inactive'
            && User::whereHas(
                'role',
                fn ($query) => $query->where('name', 'Admin')
            )
                ->where('status', 'active')
                ->count() <= 1
        ) {
            return response()->json([
                'message' => 'At least one active Administrator account must remain.',
            ], 422);
        }

        $oldStatus = $user->status;

        DB::transaction(function () use (
            $request,
            $user,
            $validated,
            $oldStatus
        ) {
            $user->update([
                'status' => $validated['status'],
            ]);

            if ($validated['status'] === 'inactive') {
                $user->tokens()->delete();
            }

            $action = $validated['status'] === 'active'
                ? 'activated_user'
                : 'deactivated_user';

            $this->audit(
                $request,
                $user,
                $action,
                "Changed {$user->name}'s status from {$oldStatus} to {$validated['status']}."
            );
        });

        return response()->json([
            'message' => $validated['status'] === 'active'
                ? 'User activated successfully.'
                : 'User deactivated successfully.',
            'user' => $user->fresh()->load([
                'role',
                'department',
            ]),
        ]);
    }

    public function resetPassword(
        Request $request,
        User $user
    ) {
        $validated = $request->validate([
            'password' => [
                'required',
                'confirmed',
                Password::min(8)->letters()->numbers(),
            ],
        ]);

        DB::transaction(function () use (
            $request,
            $user,
            $validated
        ) {
            $user->update([
                'password' => Hash::make(
                    $validated['password']
                ),
            ]);

            $user->tokens()->delete();

            $this->audit(
                $request,
                $user,
                'reset_user_password',
                "Reset password for user {$user->name}."
            );
        });

        return response()->json([
            'message' => 'Password reset successfully. Existing sessions were signed out.',
        ]);
    }

    private function audit(
        Request $request,
        User $targetUser,
        string $action,
        string $description
    ): void {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'target_user_id' => $targetUser->id,
            'record_id' => null,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }
}
