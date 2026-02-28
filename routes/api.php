<?php

use App\Http\Controllers\Api\GitlabWebhookController;
use App\Http\Middleware\VerifyGitlabWebhook;
use Illuminate\Support\Facades\Route;

Route::post('/webhooks/gitlab/{connection}', [GitlabWebhookController::class, 'handle'])
    ->middleware(VerifyGitlabWebhook::class)
    ->name('webhooks.gitlab');
