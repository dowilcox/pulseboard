<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Notifications are stored when either the in-app or the email channel
     * is on. in_app = false rows exist only so notifications:send-emails can
     * email them; they are hidden from the bell, list and unread count.
     */
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->boolean('in_app')->default(true)->after('read_at');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('in_app');
        });
    }
};
