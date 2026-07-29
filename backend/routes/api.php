<?php

use App\Http\Controllers\Api\ArchiveController;
use App\Http\Controllers\Api\AuditTrailController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClassificationManagementController;
use App\Http\Controllers\Api\DocumentRequestController;
use App\Http\Controllers\Api\DisposalController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OptionController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\ReviewPresetController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\UserManagementController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/email/verification-notification', [AuthController::class, 'resendVerification'])
    ->middleware('throttle:3,1');
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware(['signed:relative', 'throttle:6,1'])
    ->name('verification.verify');
Route::get('/options', [OptionController::class, 'index']);
Route::get('/public-settings', [SystemSettingController::class, 'publicSettings']);

Route::middleware(['auth:sanctum', 'account.access'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/system-settings', [SystemSettingController::class, 'clientSettings']);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::patch('/profile/password', [ProfileController::class, 'changePassword']);
    Route::post('/profile/logout-other-devices', [ProfileController::class, 'logoutOtherDevices']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::get('/audit-trail', [AuditTrailController::class, 'index']);
    Route::get('/review-presets', [ReviewPresetController::class, 'index']);

    Route::get('/staff/archive-catalog', [DocumentRequestController::class, 'catalog']);
    Route::get('/document-requests', [DocumentRequestController::class, 'index']);
    Route::post('/document-requests', [DocumentRequestController::class, 'store']);
    Route::get('/document-requests/{documentRequest}', [DocumentRequestController::class, 'show']);
    Route::post('/document-requests/{documentRequest}/start-review', [DocumentRequestController::class, 'startReview']);
    Route::post('/document-requests/{documentRequest}/approve', [DocumentRequestController::class, 'approve']);
    Route::post('/document-requests/{documentRequest}/reject', [DocumentRequestController::class, 'reject']);
    Route::post('/document-requests/{documentRequest}/ready-for-pickup', [DocumentRequestController::class, 'readyForPickup']);
    Route::post('/document-requests/{documentRequest}/release', [DocumentRequestController::class, 'release']);
    Route::post('/document-requests/{documentRequest}/cancel', [DocumentRequestController::class, 'cancel']);

    Route::get('/record-files/{recordFile}/download', [RecordController::class, 'downloadFile']);
    Route::delete('/record-files/{recordFile}', [RecordController::class, 'deleteFile']);

    Route::post('/records/{record}/start-review', [RecordController::class, 'startReview']);
    Route::patch('/records/{record}/review', [RecordController::class, 'updateReview']);
    Route::post('/records/{record}/return-for-correction', [RecordController::class, 'returnForCorrection']);
    Route::post('/records/{record}/correction', [RecordController::class, 'saveCorrection']);
    Route::post('/records/{record}/resubmit', [RecordController::class, 'resubmit']);
    Route::post('/records/{record}/archive', [RecordController::class, 'archive']);
    Route::apiResource('records', RecordController::class);

    Route::prefix('archive')->group(function () {
        Route::get('/records', [ArchiveController::class, 'index']);
        Route::get('/folders', [ArchiveController::class, 'folders']);
        Route::post('/folders', [ArchiveController::class, 'storeFolder']);
        Route::patch('/folders/{archiveFolder}', [ArchiveController::class, 'updateFolder']);
        Route::delete('/folders/{archiveFolder}', [ArchiveController::class, 'destroyFolder']);
        Route::patch('/records/{record}/move', [ArchiveController::class, 'moveRecord']);
        Route::patch('/records/{record}/staff-access', [ArchiveController::class, 'updateStaffAccess']);
        Route::patch('/records/{record}/retention', [ArchiveController::class, 'updateRetention']);
    });

    Route::prefix('disposal')->group(function () {
        Route::get('/records', [DisposalController::class, 'index']);
        Route::get('/disposed', [DisposalController::class, 'disposed']);
        Route::post('/records/{record}/restore', [DisposalController::class, 'restore']);
        Route::post('/records/{record}/request', [DisposalController::class, 'requestDisposal']);
        Route::patch('/records/{record}/legal-hold', [DisposalController::class, 'updateLegalHold']);
        Route::post('/cases/{disposalCase}/approve', [DisposalController::class, 'approve']);
        Route::post('/cases/{disposalCase}/reject', [DisposalController::class, 'reject']);
        Route::post('/cases/{disposalCase}/cancel', [DisposalController::class, 'cancel']);
        Route::get('/cases/{disposalCase}/certificate', [DisposalController::class, 'certificate']);
    });

    Route::prefix('admin')->middleware('admin')->group(function () {
        Route::get('/users', [UserManagementController::class, 'index']);
        Route::get('/users/{user}', [UserManagementController::class, 'show']);
        Route::post('/users', [UserManagementController::class, 'store']);
        Route::patch('/users/{user}', [UserManagementController::class, 'update']);
        Route::patch('/users/{user}/password', [UserManagementController::class, 'resetPassword']);
        Route::patch('/users/{user}/status', [UserManagementController::class, 'updateStatus']);

        Route::get('/categories', [ClassificationManagementController::class, 'categories']);
        Route::post('/categories', [ClassificationManagementController::class, 'storeCategory']);
        Route::patch('/categories/{recordCategory}', [ClassificationManagementController::class, 'updateCategory']);
        Route::delete('/categories/{recordCategory}', [ClassificationManagementController::class, 'destroyCategory']);

        Route::get('/departments', [ClassificationManagementController::class, 'departments']);
        Route::post('/departments', [ClassificationManagementController::class, 'storeDepartment']);
        Route::patch('/departments/{department}', [ClassificationManagementController::class, 'updateDepartment']);
        Route::delete('/departments/{department}', [ClassificationManagementController::class, 'destroyDepartment']);

        Route::get('/settings', [SystemSettingController::class, 'index']);
        Route::put('/settings', [SystemSettingController::class, 'update']);

        Route::get('/review-presets', [ReviewPresetController::class, 'adminIndex']);
        Route::post('/review-presets', [ReviewPresetController::class, 'store']);
        Route::patch('/review-presets/{reviewPreset}', [ReviewPresetController::class, 'update']);
        Route::delete('/review-presets/{reviewPreset}', [ReviewPresetController::class, 'destroy']);

        // TEMPORARY DEVELOPMENT TOOLS — remove before production.
        Route::get('/practice-data', [SystemSettingController::class, 'practiceDataSummary']);
        Route::delete('/practice-data', [SystemSettingController::class, 'clearPracticeData']);
    });
});
