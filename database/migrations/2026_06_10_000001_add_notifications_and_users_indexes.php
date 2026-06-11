<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // SendNotificationEmails polls whereNull('emailed_at') + created_at range every 5 minutes
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['emailed_at', 'created_at']);
        });

        // SAML login looks up users by (auth_provider, auth_provider_id)
        Schema::table('users', function (Blueprint $table) {
            $table->index(['auth_provider', 'auth_provider_id']);
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['emailed_at', 'created_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex(['auth_provider', 'auth_provider_id']);
        });
    }
};
