<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserCanManageAccounts
{
    public function handle(Request $request, Closure $next): Response
    {
        $roleName = $request->user()?->role?->name;

        if (! in_array($roleName, ['Admin', 'Records Officer'], true)) {
            return response()->json([
                'message' => 'Administrator or Records Officer access is required.',
            ], 403);
        }

        return $next($request);
    }
}
