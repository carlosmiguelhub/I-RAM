<?php

return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    'admin' => [
        'email' => env('IRAM_ADMIN_EMAIL', 'admin@iram.test'),
        'password' => env('IRAM_ADMIN_PASSWORD'),
    ],
];
