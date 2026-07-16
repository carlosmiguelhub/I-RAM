<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AuditTrailController extends Controller
{
    public function index(Request $request)
    {
        $role = $request->user()->role?->name ?? '';

        if (! in_array($role, ['Admin', 'Records Officer'], true)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may view the audit trail.',
            ], 403);
        }

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'action' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'sort' => ['nullable', Rule::in(['newest', 'oldest'])],
            'per_page' => ['nullable', 'integer', 'min:10', 'max:100'],
        ]);

        $query = AuditLog::query()->with([
            'user:id,name,email,role_id',
            'user.role:id,name',
            'targetUser:id,name,email',
            'record:id,record_code,title,status',
        ]);

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($query) use ($search) {
                $query
                    ->where('action', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('ip_address', 'like', "%{$search}%")
                    ->orWhereHas('user', fn ($user) => $user
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('targetUser', fn ($user) => $user
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%"))
                    ->orWhereHas('record', fn ($record) => $record
                        ->where('record_code', 'like', "%{$search}%")
                        ->orWhere('title', 'like', "%{$search}%"));
            });
        }

        if (! empty($validated['action'])) {
            $query->where('action', $validated['action']);
        }

        if (! empty($validated['user_id'])) {
            $query->where('user_id', $validated['user_id']);
        }

        if (! empty($validated['date_from'])) {
            $query->whereDate('created_at', '>=', $validated['date_from']);
        }

        if (! empty($validated['date_to'])) {
            $query->whereDate('created_at', '<=', $validated['date_to']);
        }

        $sort = $validated['sort'] ?? 'newest';
        $perPage = $validated['per_page'] ?? 20;
        $logs = $query
            ->orderBy('created_at', $sort === 'oldest' ? 'asc' : 'desc')
            ->orderBy('id', $sort === 'oldest' ? 'asc' : 'desc')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            ...$logs->toArray(),
            'filters' => [
                'actions' => AuditLog::query()
                    ->whereNotNull('action')
                    ->distinct()
                    ->orderBy('action')
                    ->pluck('action'),
                'users' => AuditLog::query()
                    ->whereNotNull('user_id')
                    ->join('users', 'users.id', '=', 'audit_logs.user_id')
                    ->select('users.id', 'users.name', 'users.email')
                    ->distinct()
                    ->orderBy('users.name')
                    ->get(),
            ],
            'summary' => [
                'total' => AuditLog::count(),
                'today' => AuditLog::whereDate('created_at', today())->count(),
                'last_seven_days' => AuditLog::where('created_at', '>=', now()->subDays(7))->count(),
                'active_users' => AuditLog::whereNotNull('user_id')->distinct('user_id')->count('user_id'),
            ],
        ]);
    }
}
