# GitLab Integration

Link GitLab projects to a team so tasks can create branches and merge requests, show merge request and pipeline status, and link themselves automatically from branch names and MR titles.

Works with gitlab.com and self-managed GitLab (API v4).

## Overview

1. A team admin or owner adds a **GitLab connection** (an instance URL and an access token).
2. They **link GitLab projects** to the team. PulseBoard registers a webhook on each project.
3. On each task, members pick the task's GitLab project and can create a branch or merge request.
4. Webhooks and a background sync keep merge request state and pipeline status current, and link MRs/branches that mention task numbers.

## 1. Add a connection

Connections belong to a **team**, not to the whole instance. Go to **Team settings → Integrations** (admins and owners).

| Field     | Notes                                                                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name      | Display name.                                                                                                                                                                                                                                                          |
| Base URL  | For example `https://gitlab.com` or `https://gitlab.example.com`. A trailing slash is removed. PulseBoard calls `<base URL>/api/v4`.                                                                                                                                   |
| API token | A **Personal Access Token** or **Project Access Token** with the `api` scope. The token owner needs the **Maintainer** or **Owner** role on every project you want to link, because linking creates a webhook. When editing, leave it blank to keep the current token. |
| Active    | Inactive connections are skipped by the background sync.                                                                                                                                                                                                               |

Use **Test** to check the token; it reports the GitLab user it authenticated as. Tokens and webhook secrets are stored encrypted with the app key (`APP_KEY`).

Deleting a connection removes its linked projects and tries to delete their webhooks in GitLab.

## 2. Link projects

On the same tab, search the connection's projects (at least 2 characters; up to 20 results; projects already linked are hidden) and link one. PulseBoard then:

- Stores the project's name, path, web URL and default branch.
- Registers a webhook on the GitLab project.

Unlinking a project tries to remove the webhook from GitLab and clears the project from tasks that used it. Existing branch and MR references stay on those tasks.

## Webhooks

PulseBoard creates and removes webhooks itself; you don't need to configure them in GitLab. For reference, a registered webhook looks like this:

| Setting          | Value                                                                           |
| ---------------- | ------------------------------------------------------------------------------- |
| URL              | `{APP_URL}/api/webhooks/gitlab/{connection-id}`                                 |
| Secret token     | A random 32-character secret per connection, sent by GitLab as `X-Gitlab-Token` |
| Events           | Merge request events, Pipeline events, Push events                              |
| SSL verification | Enabled                                                                         |

Requirements:

- `APP_URL` must be the public HTTPS URL GitLab can reach, because the webhook URL is built from it at link time. If `APP_URL` changes, unlink and relink projects to re-register their webhooks.
- Requests with a missing or wrong `X-Gitlab-Token` get `403`. Payloads for projects that aren't linked are acknowledged with `200` and ignored.
- Webhooks are processed synchronously in the request.

What each event does:

| GitLab event       | Effect                                                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push Hook          | Auto-links the pushed branch to a task if its name matches the [auto-link pattern](#auto-linking). Branch deletions are ignored.                                                                                                                                           |
| Merge Request Hook | Auto-links the MR from its title, description and source branch. Updates the title, state, author and branches of every task reference to that MR, broadcasts the change, and fires the `gitlab_mr_merged` [automation trigger](automation.md) when the MR becomes merged. |
| Pipeline Hook      | Updates the pipeline status on task references whose branch matches the pipeline's ref, broadcasts it, and fires `gitlab_pipeline_status` when the status changes.                                                                                                         |

## Working with GitLab from a task

The task sidebar's GitLab controls (and the GitLab section on the task page) let any team member:

- **Set the task's GitLab project** from the team's linked projects. Cards then show the project path as a prefix, for example `[group/project]`.
- **Create branch.** Creates `pb-{task number}-{title-slug}` (at most 100 characters) from the project's default branch. A task can have only one branch reference.
- **Create MR.** Opens a merge request into the default branch, titled `#{number}: {title}`, with a description that starts with a link back to the task (`Task: [#{number} {title}](task URL)`) followed by up to about 500 characters of the task description as Markdown. Mentions become `@Name` (GitLab may link that to a GitLab user with a matching username), editor HTML is removed, and a longer description is cut at a line or word boundary and ends with `…`. It uses the task's branch, creating one first if needed. A task can have only one open (or locked) MR at a time.
- **Remove a reference** from the task (this doesn't change anything in GitLab).

Branch and MR creation are logged in the task's activity feed.

## Auto-linking

PulseBoard links GitLab branches and MRs to tasks when they mention a task number. The pattern is `config/gitlab.php` → `auto_link_pattern`, by default:

```
/(?:#|\bpb-)(\d+)\b/
```

It matches `#42` anywhere in the text, and `pb-42` (as in the branches PulseBoard creates). It is applied to:

- **Branch names** from push events.
- **MR title, description and source branch** from merge request events.

Matching rules (`app/Actions/Gitlab/AutoLinkTask.php`):

1. Candidates are tasks with that number on any board of the team the project is linked to, excluding tasks already associated with a **different** GitLab project.
2. Task numbers are only unique per board, so one number can match tasks on several boards. If exactly one candidate exists, it is linked. If several exist, PulseBoard links the one already associated with this GitLab project. If none or more than one of them is, the reference is **skipped** (and logged) rather than linked to the wrong board.
3. A linked task without a GitLab project is assigned this one.
4. The same branch or MR is not linked to a task twice.

Tips:

- To make auto-linking reliable on teams with several boards, set the GitLab project on tasks before pushing, or use the branches PulseBoard creates.
- `#123` is also GitLab's own issue reference syntax. An MR description that says "Closes #12" will link task 12 if it exists and is unambiguous.

## Pipeline and MR status

Each task reference shows its MR number and state (`opened`, `merged`, `closed`, `locked`) and the latest pipeline status reported for its branch. Cards show the MR number and state.

## Background sync

The scheduler runs `gitlab:sync-refs` **every 15 minutes**. Each run:

- Picks up to **100** merge request references not synced in the last 15 minutes (`config/gitlab.php` → `sync_interval`), on tasks whose project uses an **active** connection.
- Fetches each MR's title, state and author, and the latest pipeline for its source branch.
- Fires `gitlab_mr_merged` and `gitlab_pipeline_status` automations when it detects a transition the webhooks missed.

Branch-only references are not synced; they rely on pipeline webhooks.

## Configuration reference

`config/gitlab.php` (no environment variables):

| Key                 | Default                 | Meaning                                                                                                               |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `webhook_prefix`    | `api/webhooks/gitlab`   | Path used to build webhook URLs. Must match the route in `routes/api.php`.                                            |
| `auto_link_pattern` | `/(?:#\|\bpb-)(\d+)\b/` | Regex with the task number in capture group 1.                                                                        |
| `sync_interval`     | `15`                    | Minutes before a reference counts as stale. The schedule itself is fixed at every 15 minutes in `routes/console.php`. |

## Troubleshooting

- **Linking fails:** the token lacks the `api` scope or Maintainer access on the project, so the webhook can't be created.
- **No updates from GitLab:** check the project's webhook in GitLab (**Settings → Webhooks**) for delivery errors. Typical causes are an `APP_URL` GitLab can't reach, or a TLS certificate GitLab doesn't trust (SSL verification is enabled on the webhook).
- **An MR didn't link:** the number may be ambiguous across boards (check the log for "GitLab auto-link skipped ambiguous task reference"), or the task is associated with another GitLab project.
