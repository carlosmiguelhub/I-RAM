<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\RecordController;
use App\Http\Controllers\Api\OptionController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('/options', [OptionController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get(
        '/record-files/{recordFile}/download',
        [RecordController::class, 'downloadFile']
    );

    Route::apiResource('records', RecordController::class);
});