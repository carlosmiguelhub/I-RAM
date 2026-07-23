<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\RecordRetentionService;
use App\Services\RecordDisposalService;

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

Artisan::command('records:process-disposals', function (
    RecordDisposalService $disposals
) {
    $result = $disposals->processApprovedCases();
    $this->info(
        "Completed {$result['completed']} disposal(s); sent {$result['reminded']} reminder(s); {$result['failed']} failed."
    );
})->purpose('Permanently delete files for approved disposal cases after their grace period');

Schedule::command('records:process-disposals')
    ->everyMinute()
    ->withoutOverlapping();
