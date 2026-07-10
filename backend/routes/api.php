<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\OptionController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\ArchiveController;
use App\Http\Controllers\Api\SystemSettingController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('/options', [OptionController::class, 'index']);

Route::get(
    '/public-settings',
    [SystemSettingController::class, 'publicSettings']
);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get(
        '/record-files/{recordFile}/download',
        [RecordController::class, 'downloadFile']
    );

    Route::delete(
        '/record-files/{recordFile}',
        [RecordController::class, 'deleteFile']
    );

    Route::post(
        '/records/{record}/start-review',
        [RecordController::class, 'startReview']
    );

    Route::patch(
        '/records/{record}/review',
        [RecordController::class, 'updateReview']
    );

    Route::post(
        '/records/{record}/return-for-correction',
        [RecordController::class, 'returnForCorrection']
    );

    Route::post(
        '/records/{record}/correction',
        [RecordController::class, 'saveCorrection']
    );

    Route::post(
        '/records/{record}/resubmit',
        [RecordController::class, 'resubmit']
    );

    Route::post(
        '/records/{record}/archive',
        [RecordController::class, 'archive']
    );

    Route::apiResource('records', RecordController::class);

    Route::prefix('archive')->group(function () {
        Route::get(
            '/records',
            [ArchiveController::class, 'index']
        );

        Route::get(
            '/folders',
            [ArchiveController::class, 'folders']
        );

        Route::post(
            '/folders',
            [ArchiveController::class, 'storeFolder']
        );

        Route::patch(
            '/folders/{archiveFolder}',
            [ArchiveController::class, 'updateFolder']
        );

        Route::delete(
            '/folders/{archiveFolder}',
            [ArchiveController::class, 'destroyFolder']
        );

        Route::patch(
            '/records/{record}/move',
            [ArchiveController::class, 'moveRecord']
        );
    });

    Route::prefix('admin')
        ->middleware('admin')
        ->group(function () {
            Route::get(
                '/users',
                [UserManagementController::class, 'index']
            );

            Route::post(
                '/users',
                [UserManagementController::class, 'store']
            );

            Route::get(
                '/users/{user}',
                [UserManagementController::class, 'show']
            );

            Route::patch(
                '/users/{user}',
                [UserManagementController::class, 'update']
            );

            Route::patch(
                '/users/{user}/status',
                [UserManagementController::class, 'updateStatus']
            );

            Route::patch(
                '/users/{user}/password',
                [UserManagementController::class, 'resetPassword']
            );

            Route::get(
                '/settings',
                [SystemSettingController::class, 'index']
            );

            Route::put(
                '/settings',
                [SystemSettingController::class, 'update']
            );
        });
});