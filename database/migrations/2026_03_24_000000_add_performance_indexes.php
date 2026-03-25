<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['notifiable_id', 'notifiable_type', 'read_at']);
        });

        Schema::table('boards', function (Blueprint $table) {
            $table->index('is_archived');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['notifiable_id', 'notifiable_type', 'read_at']);
        });

        Schema::table('boards', function (Blueprint $table) {
            $table->dropIndex(['is_archived']);
        });
    }
};
