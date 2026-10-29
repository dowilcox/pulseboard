<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sso_configurations', function (Blueprint $table) {
            // SAML-only columns become optional so OIDC rows can omit them.
            $table->string('entity_id')->nullable()->change();
            $table->string('login_url')->nullable()->change();
            $table->text('certificate')->nullable()->change();

            // Shared by every provider type.
            $table->string('button_label', 100)->nullable()->after('name');

            // OpenID Connect.
            $table->string('issuer', 500)->nullable()->after('metadata_url');
            $table->string('client_id')->nullable()->after('issuer');
            $table->text('client_secret')->nullable()->after('client_id');
            $table->string('scopes', 500)->nullable()->after('client_secret');
            $table->json('allowed_algorithms')->nullable()->after('scopes');
            $table->boolean('fetch_userinfo')->default(true)->after('allowed_algorithms');
            $table->boolean('end_session_enabled')->default(false)->after('fetch_userinfo');

            $table->index(['provider', 'is_active']);
        });
    }

    public function down(): void
    {
        // SAML columns cannot become NOT NULL again while OIDC rows exist.
        DB::table('sso_configurations')->where('provider', '!=', 'saml2')->delete();

        Schema::table('sso_configurations', function (Blueprint $table) {
            $table->dropIndex(['provider', 'is_active']);
            $table->dropColumn([
                'button_label',
                'issuer',
                'client_id',
                'client_secret',
                'scopes',
                'allowed_algorithms',
                'fetch_userinfo',
                'end_session_enabled',
            ]);

            $table->string('entity_id')->nullable(false)->change();
            $table->string('login_url')->nullable(false)->change();
            $table->text('certificate')->nullable(false)->change();
        });
    }
};
