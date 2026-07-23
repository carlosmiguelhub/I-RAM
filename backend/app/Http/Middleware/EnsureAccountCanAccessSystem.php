<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountCanAccessSystem
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before accessing IRAM.',
                'code' => 'email_unverified',
            ], 403);
        }

        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'Your account is not activated yet. Please contact an Administrator.',
                'code' => 'activation_pending',
            ], 403);
        }

        return $next($request);
    }
}
