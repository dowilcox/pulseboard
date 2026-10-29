<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * `activities.user_id` is nulled when a user is deleted, which made their
 * activity indistinguishable from system activity (scheduled jobs, webhooks)
 * and the feed labelled it "System". This flag records that the actor was a
 * since-deleted user without keeping any of their personal data.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->boolean('actor_deleted')->default(false)->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('activities', function (Blueprint $table) {
            $table->dropColumn('actor_deleted');
        });
    }
};
