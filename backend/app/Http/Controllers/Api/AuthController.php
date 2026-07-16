<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $rateLimitKey = Str::lower($validated['email'])
            .'|'.$request->ip();
        $attemptLimit = max(
            1,
            (int) SystemSetting::getValue(
                'login_attempt_limit',
                5
            )
        );

        if (RateLimiter::tooManyAttempts(
            $rateLimitKey,
            $attemptLimit
        )) {
            return response()->json([
                'message' => 'Too many login attempts. Please try again later.',
                'retry_after' => RateLimiter::availableIn(
                    $rateLimitKey
                ),
            ], 429);
        }

        $user = User::with(['role', 'department'])
            ->where('email', $validated['email'])
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($rateLimitKey, 60);

            return response()->json([
                'message' => 'Invalid email or password.',
            ], 401);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'Your account is inactive.',
            ], 403);
        }

        RateLimiter::clear($rateLimitKey);

        $token = $this->createAccessToken($user);

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'authenticated_session_started',
            'description' => "Signed in to IRAM: {$user->email}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function register(Request $request)
    {
        if (! SystemSetting::getValue('allow_registration', true)) {
            return response()->json([
                'message' => 'Public registration is currently disabled.',
            ], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => [
                'required',
                'confirmed',
                Password::min(8)->letters()->numbers(),
            ],
            'department_id' => ['required', 'exists:departments,id'],
        ]);

        // Public registration must never grant a privileged role,
        // regardless of legacy setting values.
        $staffRole = Role::where('name', 'Staff')->firstOrFail();

        $user = User::create([
            'role_id' => $staffRole->id,
            'department_id' => $validated['department_id'],
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'status' => 'active',
        ]);

        $token = $this->createAccessToken($user);

        AuditLog::create([
            'user_id' => $user->id,
            'target_user_id' => $user->id,
            'action' => 'public_user_registered',
            'description' => "Registered a new Staff account: {$user->email}",
            'ip_address' => $request->ip(),
        ]);

        return response()->json([
            'message' => 'Registration successful.',
            'token' => $token,
            'user' => $user->load(['role', 'department']),
        ], 201);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $request->user()->load(['role', 'department']),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'authenticated_session_ended',
            'description' => "Signed out of IRAM: {$user->email}",
            'ip_address' => $request->ip(),
        ]);

        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logout successful.',
        ]);
    }

    private function createAccessToken(User $user): string
    {
        $timeoutMinutes = max(
            15,
            min(
                1440,
                (int) SystemSetting::getValue(
                    'session_timeout_minutes',
                    120
                )
            )
        );

        return $user->createToken(
            'iram_api_token',
            ['*'],
            now()->addMinutes($timeoutMinutes)
        )->plainTextToken;
    }
}
