<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\RecordRetentionService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('records:process-retention', function (
    RecordRetentionService $retention
) {
    $count = $retention->moveExpiredRecords();
    $this->info("Transferred {$count} expired record(s) to the For Disposal Repository.");
})->purpose('Transfer archived records whose retention periods have expired');

Schedule::command('records:process-retention')
    ->everyMinute()
    ->withoutOverlapping();
