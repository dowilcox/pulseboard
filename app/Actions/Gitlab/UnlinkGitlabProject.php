<?php

namespace App\Actions\Gitlab;

use App\Models\GitlabProject;
use Lorisleiva\Actions\Concerns\AsAction;

class UnlinkGitlabProject
{
    use AsAction;

    public function handle(GitlabProject $gitlabProject): void
    {
        // Best-effort webhook removal
        RemoveProjectWebhook::run($gitlabProject);

        $gitlabProject->delete();
    }
}
