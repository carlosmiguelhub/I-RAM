<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DisposalCase;
use App\Models\DocumentRequest;
use App\Models\Record;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;

class ProfileController extends Controller
{
    public function show(Request $request)
    {
        $user = $request->user()->load(['role', 'department']);

        return response()->json([
            'user' => $user,
            'activity' => $this->activity($user),
            'security' => [
                'active_sessions' => $user->tokens()
                    ->where(function ($query) {
                        $query
                            ->whereNull('expires_at')
                            ->orWhere('expires_at', '>', now());
                    })
                    ->count(),
                'current_session' => $this->currentSession($request),
                'last_activity_at' => AuditLog::query()
                    ->where('user_id', $user->id)
                    ->latest()
                    ->value('created_at'),
            ],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'min:2',
                'max:255',
            ],
        ]);
        $user = $request->user();
        $oldName = $user->name;

        $user->update([
            'name' => trim($validated['name']),
        ]);

        if ($oldName !== $user->name) {
            $this->audit(
                $request,
                'profile_name_updated',
                "Updated profile name from {$oldName} to {$user->name}"
            );
        }

        return response()->json([
            'message' => $oldName === $user->name
                ? 'No profile changes were detected.'
                : 'Profile updated successfully.',
            'user' => $user->fresh()->load(['role', 'department']),
        ]);
    }

    public function changePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => [
                'required',
                'confirmed',
                Password::min(8)->letters()->numbers(),
            ],
        ]);
        $user = $request->user();

        if (! Hash::check(
            $validated['current_password'],
            $user->password
        )) {
            return response()->json([
                'message' => 'The current password is incorrect.',
                'errors' => [
                    'current_password' => [
                        'The current password is incorrect.',
                    ],
                ],
            ], 422);
        }

        $user->update([
            'password' => $validated['password'],
        ]);

        $revoked = $this->deleteOtherTokens($request);

        $this->audit(
            $request,
            'profile_password_changed',
            "Changed account password and revoked {$revoked} other session(s)"
        );

        return response()->json([
            'message' => 'Password changed successfully. Other sessions were signed out.',
            'revoked_sessions' => $revoked,
        ]);
    }

    public function logoutOtherDevices(Request $request)
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
        ]);

        if (! Hash::check(
            $validated['current_password'],
            $request->user()->password
        )) {
            return response()->json([
                'message' => 'The current password is incorrect.',
                'errors' => [
                    'current_password' => [
                        'The current password is incorrect.',
                    ],
                ],
            ], 422);
        }

        $revoked = $this->deleteOtherTokens($request);

        $this->audit(
            $request,
            'other_sessions_revoked',
            "Signed out {$revoked} other session(s)"
        );

        return response()->json([
            'message' => $revoked > 0
                ? "Signed out {$revoked} other session(s)."
                : 'There were no other active sessions.',
            'revoked_sessions' => $revoked,
        ]);
    }

    private function activity(User $user): array
    {
        $role = $user->role?->name;

        if ($role === 'Staff') {
            return [
                'submitted_records' => Record::where(
                    'created_by',
                    $user->id
                )->count(),
                'active_submissions' => Record::where(
                    'created_by',
                    $user->id
                )
                    ->whereNotIn('status', ['disposed'])
                    ->count(),
                'document_requests' => DocumentRequest::where(
                    'requested_by',
                    $user->id
                )->count(),
                'released_requests' => DocumentRequest::where(
                    'requested_by',
                    $user->id
                )
                    ->where('status', 'released')
                    ->count(),
            ];
        }

        if ($role === 'Records Officer') {
            return [
                'records_reviewed' => Record::where(
                    'reviewed_by',
                    $user->id
                )->count(),
                'records_archived' => Record::where(
                    'archived_by',
                    $user->id
                )->count(),
                'disposal_requests' => DisposalCase::where(
                    'requested_by',
                    $user->id
                )->count(),
                'disposal_approvals' => DisposalCase::where(
                    'approved_by',
                    $user->id
                )->count(),
            ];
        }

        return [
            'total_users' => User::count(),
            'pending_accounts' => User::where('status', 'inactive')
                ->whereNotNull('email_verified_at')
                ->count(),
            'total_records' => Record::count(),
            'my_audit_actions' => AuditLog::where(
                'user_id',
                $user->id
            )->count(),
        ];
    }

    private function currentSession(Request $request): ?array
    {
        $token = $request->user()->currentAccessToken();

        if (! $token instanceof PersonalAccessToken) {
            return null;
        }

        return [
            'created_at' => $token->created_at,
            'last_used_at' => $token->last_used_at,
            'expires_at' => $token->expires_at,
        ];
    }

    private function deleteOtherTokens(Request $request): int
    {
        $currentToken = $request->user()->currentAccessToken();
        $query = $request->user()->tokens();

        if ($currentToken instanceof PersonalAccessToken) {
            $query->whereKeyNot($currentToken->getKey());
        }

        return $query->delete();
    }

    private function audit(
        Request $request,
        string $action,
        string $description
    ): void {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'target_user_id' => $request->user()->id,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }
}
