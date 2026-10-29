# REST API (v1)

PulseBoard exposes a JSON REST API under `/api/v1`, authenticated with [Laravel Sanctum](https://laravel.com/docs/sanctum) personal access tokens. Every request runs as the token's user, with that user's team roles. A token can never do more than its user could do in the web app.

The route definitions are in `routes/api.php`; controllers are in `app/Http/Controllers/Api/V1/`.

Related: [MCP server](mcp-server.md) for AI agents, and [Custom fields](custom-fields.md) for the custom-field endpoints, which are documented separately.

## Authentication

Send the token as a bearer token, and ask for JSON:

```bash
curl https://board.example.com/api/v1/me \
  -H "Authorization: Bearer 12|kX9..." \
  -H "Accept: application/json"
```

Always send `Accept: application/json`. Without it, some errors (for example an unauthenticated request) are answered with a redirect instead of a JSON error.

### Getting a token

| Where                          | Who                                                                              | Abilities you can choose                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Profile → API tokens**       | Any user, for themselves                                                         | `read`, optionally `write`                                                                          |
| **Team settings → API & bots** | Team admins and owners, for the team's [bot users](getting-started.md#bot-users) | `read`, optionally `write`                                                                          |
| **Admin → API Tokens**         | App administrators, for any listed user or bot                                   | `read`, optionally `write`                                                                          |
| `POST /api/v1/tokens`          | The authenticated user, for themselves                                           | Any of `read`, `write`, `manage` (default `["read"]`), limited to the calling token's own abilities |

The plain-text token is shown only once. Tokens don't expire; revoke them when they're no longer needed. Deactivating a user (or removing a bot) revokes all of their tokens, and requests from deactivated accounts are rejected with `403 {"message": "Your account has been deactivated."}`.

### Token abilities

From `routes/api.php`:

```
Token abilities:
  read   — implicit for all GET endpoints (every token can read what its user can see)
  write  — content mutations (tasks, comments, attachments, templates, integrations, notifications)
  manage — structural/administrative mutations (teams, members, boards, columns, labels)
```

In practice:

- `GET` endpoints don't check abilities, so any valid token can read. The one exception is `GET /teams/{team}/members/search`, which requires `manage`.
- `write` and `manage` are independent. A token with only `manage` can create boards but not tasks. Give a token both if it needs both.
- The ability check comes **in addition** to the user's role. For example, deleting a board needs the `manage` ability **and** the admin or owner role in that team.
- The web UI only creates `read`/`write` tokens. A `manage` token can only be created through `POST /api/v1/tokens`, from a browser session or with an existing token that already has `manage`.
- A token can't hand out more than it has. When `POST /api/v1/tokens` is called with a token, every requested ability must be one the calling token holds, or the request fails with `403`. A `read` token can only create `read` tokens, and a `read`+`write` token can't create a `manage` token. Requests made with a browser session (Sanctum's stateful cookie auth) aren't limited. A token with the wildcard ability `["*"]` (Sanctum's default when a token is created in code, for example in `php artisan tinker`, without abilities) counts as holding every ability.
- The same rule applies to `DELETE /api/v1/tokens/{id}`: a token can always revoke itself, but revoking one of your other tokens requires the calling token to hold every ability of the token being revoked.

## Rate limits

All `/api/v1` routes use the `api` limiter: **60 requests per minute**, per user (or per IP if unauthenticated). Responses include `X-RateLimit-Limit` and `X-RateLimit-Remaining`; over the limit you get `429 Too Many Requests` with a `Retry-After` header.

## Conventions

### Identifiers in paths

| Parameter                                                                                            | Accepts                                                             |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `{team}`                                                                                             | Team slug or UUID                                                   |
| `{board}`                                                                                            | Board slug or UUID, within the team                                 |
| `{task}`                                                                                             | Task UUID, or the board-scoped task number (`42` or `42-fix-login`) |
| `{column}`, `{label}`, `{comment}`, `{taskTemplate}`, `{boardTemplate}`, `{ref}`, `{link}`, `{user}` | UUID                                                                |
| `{media}`                                                                                            | Attachment ID (the `id` field of an attachment, a UUID)             |
| `{dependsOnTask}`                                                                                    | UUID (any board in the team) or task number on the route's board    |
| `/tokens/{id}`                                                                                       | Numeric token ID                                                    |
| `/notifications/{id}`                                                                                | Notification UUID                                                   |

Team-scoped routes (`/teams/{team}/...`) return `403` if you are not a member of the team.

### Response shapes

- **Single resource:** `{"data": {...}}`, with `201` for creations.
- **Unpaginated list:** `{"data": [...]}`.
- **Paginated list** (`/me/tasks`, board tasks, comments): Laravel's paginator format, with the items in `data` and `current_page`, `last_page`, `per_page`, `total`, `from`, `to`, `first_page_url`, `last_page_url`, `next_page_url`, `prev_page_url`, `path` and `links`. Use `?page=N` to page.
- **Deletes and notification updates:** `204 No Content`.
- **Exceptions:** `GET /teams/{team}/dashboard/stats` returns its object without a `data` wrapper, and `GET /notifications` uses its own pagination object (below).

Timestamps are ISO 8601 in UTC. `due_date` is `YYYY-MM-DD`. Most models serialize with their database columns.

**User objects** (members, assignees, comment and activity authors, template creators) are limited to a public shape: `id`, `name`, `email`, `avatar_url` and `is_bot`, plus a `pivot` object where the user was loaded through a relation (for example `pivot.assigned_at` on assignees). Account settings such as notification and UI preferences, `is_admin`, SSO identifiers and deactivation state are never included. `GET /me` returns a few more fields about your own account.

### Errors

| Status | When                                                                                                                | Body                                               |
| ------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `401`  | Missing or invalid token                                                                                            | `{"message": "Unauthenticated."}`                  |
| `403`  | Token lacks the ability, your role doesn't allow the action, you're not on the team, or your account is deactivated | `{"message": "..."}` (see note)                    |
| `404`  | Resource not found (or not in the given team/board)                                                                 | `{"message": "..."}` (see note)                    |
| `409`  | GitLab: the task already has a branch, or an open merge request                                                     | `{"error": "..."}`                                 |
| `422`  | Validation failed                                                                                                   | `{"message": "...", "errors": {"field": ["..."]}}` |
| `422`  | GitLab or Figma API call failed, or no GitLab project is set on the task                                            | `{"error": "..."}`                                 |
| `429`  | Rate limit exceeded                                                                                                 | `{"message": "Too Many Attempts."}`                |

> **Note:** `bootstrap/app.php` replaces `403`, `404`, `500` and `503` responses with the app's HTML error page whenever `APP_ENV` is not `local`. As of this writing that also applies to API requests, so in production those statuses arrive with an HTML body. Rely on the status code, not the body, for these errors. The deactivated-account `403` is not affected.

## Endpoints

"Ability" is the token ability required in addition to `read`. "Role" is the minimum team role; "member" means any team member.

### Me, tokens and notifications

| Method | Path                       | Ability | Role / notes                                                                                                                                              |
| ------ | -------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/me`                      | —       | Returns `id, name, email, avatar_url, theme_preference, is_bot, created_at`.                                                                              |
| GET    | `/me/tasks`                | —       | Tasks assigned to you. Query: `status` = `open` (default), `completed`, `all`; `per_page` 1–100 (default 50). Sorted by due date, then newest. Paginated. |
| GET    | `/tokens`                  | —       | Your tokens: `id, name, abilities, last_used_at, created_at`.                                                                                             |
| POST   | `/tokens`                  | —       | Body: `name` (required), `abilities` (array of `read`, `write`, `manage`; at most the calling token's abilities). Returns `plain_text_token` once.        |
| DELETE | `/tokens/{id}`             | —       | Revoke one of your tokens: the calling token itself, or one whose abilities the calling token also has.                                                   |
| GET    | `/notifications`           | —       | 20 per page, newest first.                                                                                                                                |
| PATCH  | `/notifications/{id}/read` | write   | Mark one as read.                                                                                                                                         |
| POST   | `/notifications/read-all`  | write   | Mark all as read.                                                                                                                                         |
| DELETE | `/notifications`           | write   | Delete all your notifications.                                                                                                                            |

### Board templates

Board templates are personal: the list contains only templates you created. Creating a board from a template needs the admin role (unlike a blank board, which any member can create), because the template sets the board's columns and column management is an admin task.

| Method | Path                                                   | Ability | Role / notes                                                                                                                                |
| ------ | ------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/templates`                                           | —       | Your board templates.                                                                                                                       |
| POST   | `/templates`                                           | write   | Body: `name`, `description`, `template_data.columns[]` (each `name`, `color`, `wip_limit`, `is_done_column`).                               |
| DELETE | `/templates/{boardTemplate}`                           | write   | Your own template, or any template if you are an app admin.                                                                                 |
| POST   | `/teams/{team}/boards/{board}/create-template`         | write   | Member. Saves the board's columns as "<Board> Template" (`201`). Repeating it with unchanged columns returns the existing template (`200`). |
| POST   | `/teams/{team}/templates/{boardTemplate}/create-board` | manage  | Admin. Template must be yours (or you are an app admin). Body: `name`, `description`.                                                       |

### Teams and members

| Method | Path                              | Ability | Role / notes                                                                            |
| ------ | --------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| GET    | `/teams`                          | —       | Teams you belong to.                                                                    |
| POST   | `/teams`                          | manage  | Any user. Body: `name`, `description`. You become the owner.                            |
| GET    | `/teams/{team}`                   | —       | Member.                                                                                 |
| PUT    | `/teams/{team}`                   | manage  | Admin. Body: `name`, `description`, `settings`. Renaming changes the slug.              |
| DELETE | `/teams/{team}`                   | manage  | Owner. Body: `{"confirmation": "DELETE"}`.                                              |
| GET    | `/teams/{team}/members`           | —       | Member. Each member is `id, name, email, avatar_url, is_bot, role`, sorted by name.     |
| GET    | `/teams/{team}/members/search?q=` | manage  | Admin. Finds active users who aren't members (at least 2 characters, up to 10 results). |
| POST   | `/teams/{team}/members`           | manage  | Admin. Body: `user_id`, `role` (`member`, `admin`; `owner` needs the owner role).       |
| PUT    | `/teams/{team}/members/{user}`    | manage  | Admin; changing an admin/owner or granting owner needs the owner role. Body: `role`.    |
| DELETE | `/teams/{team}/members/{user}`    | manage  | Admin; removing an admin/owner needs the owner role. The last owner can't be removed.   |

### Labels and task templates

| Method | Path                                                      | Ability | Role / notes                                                                                           |
| ------ | --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| GET    | `/teams/{team}/labels`                                    | —       | Member.                                                                                                |
| POST   | `/teams/{team}/labels`                                    | manage  | Admin. Body: `name` (≤ 50), `color` (`#rrggbb`).                                                       |
| PUT    | `/teams/{team}/labels/{label}`                            | manage  | Admin.                                                                                                 |
| DELETE | `/teams/{team}/labels/{label}`                            | manage  | Admin.                                                                                                 |
| GET    | `/teams/{team}/task-templates`                            | —       | Member.                                                                                                |
| POST   | `/teams/{team}/task-templates`                            | write   | Admin. Body: `name`, `description_template`, `priority`, `effort_estimate`, `checklists`, `label_ids`. |
| DELETE | `/teams/{team}/task-templates/{taskTemplate}`             | write   | Admin.                                                                                                 |
| POST   | `/teams/{team}/boards/{board}/tasks/{task}/save-template` | write   | Admin. Body: `name`.                                                                                   |

### Team reports

| Method | Path                            | Ability | Role / notes                           |
| ------ | ------------------------------- | ------- | -------------------------------------- |
| GET    | `/teams/{team}/dashboard/stats` | —       | Member. See [Team stats](#team-stats). |
| GET    | `/teams/{team}/export/csv`      | —       | Member. See [CSV export](#csv-export). |

### Boards and columns

| Method | Path                                            | Ability | Role / notes                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET    | `/teams/{team}/boards`                          | —       | Member. Active (non-archived) boards.                                                                                                                                                                                                                                                                                                |
| POST   | `/teams/{team}/boards`                          | manage  | Member. Body: `name`, `description`. Creates the default four columns.                                                                                                                                                                                                                                                               |
| GET    | `/teams/{team}/boards/{board}`                  | —       | Member. Includes `columns`.                                                                                                                                                                                                                                                                                                          |
| PUT    | `/teams/{team}/boards/{board}`                  | manage  | Admin. Body: `name`, `description`, `settings.auto_move_to_done`, `default_task_template_id`.                                                                                                                                                                                                                                        |
| POST   | `/teams/{team}/boards/{board}/archive`          | manage  | Admin. There is no unarchive endpoint in v1.                                                                                                                                                                                                                                                                                         |
| DELETE | `/teams/{team}/boards/{board}`                  | manage  | Admin. Body: `{"confirmation": "DELETE"}`.                                                                                                                                                                                                                                                                                           |
| GET    | `/teams/{team}/boards/{board}/labels`           | —       | Member. The team's labels.                                                                                                                                                                                                                                                                                                           |
| POST   | `/teams/{team}/boards/{board}/columns`          | manage  | Admin. Body: `name`, `color`, `wip_limit` (≥ 1), `is_done_column`.                                                                                                                                                                                                                                                                   |
| PUT    | `/teams/{team}/boards/{board}/columns`          | manage  | Admin. Sync all columns at once: `columns[]` with `id` (omit for new), `name`, `color`, `wip_limit`, `is_done_column`, `sort_order`, `_destroy`, `move_tasks_to`, `delete_tasks`. At most one column may have `is_done_column: true` (marking one clears the flag on columns left out of the payload); `wip_limit` is `null` or ≥ 1. |
| PUT    | `/teams/{team}/boards/{board}/columns/{column}` | manage  | Admin.                                                                                                                                                                                                                                                                                                                               |
| DELETE | `/teams/{team}/boards/{board}/columns/{column}` | manage  | Admin. Optional `target_column_id` to keep the tasks; otherwise they're deleted.                                                                                                                                                                                                                                                     |

### Tasks

| Method | Path                                                                               | Ability | Role / notes                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/teams/{team}/boards/{board}/tasks`                                               | —       | Member. Paginated. See query parameters below.                                                                                                                                                    |
| GET    | `/teams/{team}/boards/{board}/tasks/{task}`                                        | —       | Member. Includes assignees, labels, comments, column, subtasks, activities, `blocked_by` and `dependencies`.                                                                                      |
| POST   | `/teams/{team}/boards/{board}/columns/{column}/tasks`                              | write   | Member. Body: `title` (required), `description`, `priority`, `due_date`, `effort_estimate`, `assignee_ids[]`, `label_ids[]`, `parent_task_id`. The board's default template fills omitted fields. |
| POST   | `/teams/{team}/boards/{board}/columns/{column}/tasks/from-template/{taskTemplate}` | write   | Member. Body: `title` (optional; defaults to the template name).                                                                                                                                  |
| PUT    | `/teams/{team}/boards/{board}/tasks/{task}`                                        | write   | Member. Any of `title`, `description`, `priority`, `due_date`, `effort_estimate`, `custom_fields`, `checklists[]`, `links[]`, `recurrence_config`.                                                |
| DELETE | `/teams/{team}/boards/{board}/tasks/{task}`                                        | write   | Task creator or admin.                                                                                                                                                                            |
| PATCH  | `/teams/{team}/boards/{board}/tasks/{task}/move`                                   | write   | Member; moving to another board (`board_id`) needs admin. Body: `column_id` (required), `sort_order` (number, or `null` to append), `board_id` (optional).                                        |
| PATCH  | `/teams/{team}/boards/{board}/tasks/{task}/complete`                               | write   | Member. Toggles completion; send `{"completed": true}` or `false` to set it idempotently.                                                                                                         |
| PATCH  | `/teams/{team}/boards/{board}/tasks/{task}/watch`                                  | write   | Member. Toggles watching; send `{"watching": true}` or `false` to set it. Returns `{"data": {"watching": bool}}`.                                                                                 |
| PUT    | `/teams/{team}/boards/{board}/tasks/{task}/assignees`                              | write   | Member. Body: `user_ids[]` (the complete new list).                                                                                                                                               |
| PUT    | `/teams/{team}/boards/{board}/tasks/{task}/labels`                                 | write   | Member. Body: `label_ids[]` (the complete new list).                                                                                                                                              |
| POST   | `/teams/{team}/boards/{board}/tasks/{task}/dependencies`                           | write   | Member. Body: `depends_on_task_id` (UUID of a task in the same team). Makes this task "blocked by" that one.                                                                                      |
| DELETE | `/teams/{team}/boards/{board}/tasks/{task}/dependencies/{dependsOnTask}`           | write   | Member.                                                                                                                                                                                           |

Query parameters for `GET .../tasks`:

| Parameter     | Values                                                                               |
| ------------- | ------------------------------------------------------------------------------------ |
| `status`      | `all` (default), `open`, `completed`                                                 |
| `column_id`   | A column UUID                                                                        |
| `assignee_id` | A user UUID                                                                          |
| `label_id`    | A label UUID                                                                         |
| `priority`    | `urgent`, `high`, `medium`, `low`, `none`                                            |
| `q`           | Title contains the text, or task number equals it when it's all digits               |
| `sort`        | `sort_order` (default), `task_number`, `title`, `priority`, `due_date`, `created_at` |
| `direction`   | `asc` (default), `desc`                                                              |
| `per_page`    | 1–100 (default 50)                                                                   |

Task body formats:

```json
{
    "checklists": [
        {
            "id": "c1",
            "title": "Release",
            "items": [{ "id": "i1", "text": "Tag version", "completed": false }]
        }
    ],
    "links": [
        { "id": "l1", "url": "https://example.com/spec", "label": "Spec" }
    ],
    "recurrence_config": { "frequency": "weekly", "interval": 2 }
}
```

`id` values in checklists and links are client-generated strings. Send `"recurrence_config": null` to turn recurrence off. See [Recurring tasks](tasks.md#recurring-tasks) for what the scheduler honours.

### Comments and attachments

| Method | Path                                            | Ability | Role / notes                                                                                                       |
| ------ | ----------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| GET    | `.../tasks/{task}/comments`                     | —       | Member. Top-level comments with `replies`, newest first. `per_page` 1–100 (default 50). Paginated.                 |
| POST   | `.../tasks/{task}/comments`                     | write   | Member. Body: `body` (HTML, sanitized server-side), `parent_id` (optional; replies to replies attach to the root). |
| PUT    | `.../tasks/{task}/comments/{comment}`           | write   | Comment author only. Body: `body`.                                                                                 |
| DELETE | `.../tasks/{task}/comments/{comment}`           | write   | Comment author, or admin.                                                                                          |
| GET    | `.../tasks/{task}/attachments`                  | —       | Member.                                                                                                            |
| POST   | `.../tasks/{task}/attachments`                  | write   | Member. `multipart/form-data` with a `file` field. Size and type limits as in [Attachments](tasks.md#attachments). |
| GET    | `.../tasks/{task}/attachments/{media}/download` | —       | Member. Streams the file.                                                                                          |
| DELETE | `.../tasks/{task}/attachments/{media}`          | write   | Member.                                                                                                            |

`...` is `/teams/{team}/boards/{board}`.

To mention someone in a comment, include `<span data-type="mention" data-id="USER-UUID">@Name</span>` in the body.

### Integrations

| Method | Path                                    | Ability | Role / notes                                                            |
| ------ | --------------------------------------- | ------- | ----------------------------------------------------------------------- |
| GET    | `.../tasks/{task}/gitlab`               | —       | Member. The task's GitLab refs (branches, MRs).                         |
| PUT    | `.../tasks/{task}/gitlab/project`       | write   | Member. Body: `gitlab_project_id` (a linked project's UUID, or `null`). |
| POST   | `.../tasks/{task}/gitlab/branch`        | write   | Member. Creates `pb-{number}-{slug}`.                                   |
| POST   | `.../tasks/{task}/gitlab/merge-request` | write   | Member. Body: `source_branch` (optional).                               |
| DELETE | `.../tasks/{task}/gitlab/{ref}`         | write   | Member. Removes the ref from the task only.                             |
| GET    | `.../tasks/{task}/figma`                | —       | Member.                                                                 |
| POST   | `.../tasks/{task}/figma`                | write   | Member. Body: `figma_connection_id` (an active team connection), `url`. |
| DELETE | `.../tasks/{task}/figma/{link}`         | write   | Member.                                                                 |

See [GitLab integration](gitlab-integration.md) and [Figma integration](figma-integration.md).

### GitLab webhook

`POST /api/webhooks/gitlab/{connection}` receives GitLab webhooks. It is not part of v1 and is authenticated by the `X-Gitlab-Token` header, not by Sanctum. PulseBoard registers it automatically; see [Webhooks](gitlab-integration.md#webhooks).

## Examples

### Create a token

```http
POST /api/v1/tokens
Authorization: Bearer <existing token>
Accept: application/json
Content-Type: application/json

{"name": "CI pipeline", "abilities": ["read", "write"]}
```

```json
{
    "data": {
        "id": 12,
        "name": "CI pipeline",
        "abilities": ["read", "write"],
        "plain_text_token": "12|kX9q..."
    }
}
```

### List open tasks on a board

```http
GET /api/v1/teams/acme/boards/website/tasks?status=open&sort=priority&per_page=1
```

Abridged response (task objects contain every task column plus the loaded relations and counts):

```json
{
    "current_page": 1,
    "data": [
        {
            "id": "9f6d0c1e-...",
            "board_id": "9f6d0a77-...",
            "column_id": "9f6d0a78-...",
            "task_number": 42,
            "slug": "42-fix-login",
            "title": "Fix login",
            "priority": "urgent",
            "due_date": "2026-11-03",
            "effort_estimate": 3,
            "completed_at": null,
            "is_completed": false,
            "checklist_progress": { "completed": 1, "total": 4 },
            "comments_count": 2,
            "subtasks_count": 0,
            "completed_subtasks_count": 0,
            "column": {
                "id": "9f6d0a78-...",
                "name": "In Progress",
                "board_id": "9f6d0a77-..."
            },
            "assignees": [
                {
                    "id": "9f6c...",
                    "name": "Alice",
                    "email": "alice@example.com",
                    "avatar_url": "...",
                    "is_bot": false,
                    "pivot": {
                        "task_id": "9f6d0c1e-...",
                        "user_id": "9f6c...",
                        "assigned_at": "2026-10-20T14:02:11.000000Z",
                        "assigned_by": "9f6c..."
                    }
                }
            ],
            "labels": [{ "id": "9f6c...", "name": "bug", "color": "#ba3535" }],
            "gitlab_refs": [],
            "blocked_by": []
        }
    ],
    "per_page": 1,
    "total": 17,
    "last_page": 17,
    "next_page_url": "https://board.example.com/api/v1/teams/acme/boards/website/tasks?page=2",
    "...": "..."
}
```

### List team members

```http
GET /api/v1/teams/acme/members
```

```json
{
    "data": [
        {
            "id": "9f6c...",
            "name": "Alice",
            "email": "alice@example.com",
            "avatar_url": "https://board.example.com/avatars/9f6c...",
            "is_bot": false,
            "role": "owner"
        },
        {
            "id": "9f6d...",
            "name": "CI Bot",
            "email": "ci-bot-x7Kq2mPa@pulseboard.local",
            "avatar_url": "https://board.example.com/avatars/9f6d...",
            "is_bot": true,
            "role": "member"
        }
    ]
}
```

`POST` and `PUT /teams/{team}/members...` return the membership record (`id, team_id, user_id, role, created_at, updated_at`) with the member's public `user` object.

### Move a task to the end of a column

```http
PATCH /api/v1/teams/acme/boards/website/tasks/42/move
Content-Type: application/json

{"column_id": "9f6d0a79-...", "sort_order": null}
```

Returns `{"data": {...task...}}`. Moving into a full column fails with `422` and an error on `column_id`.

### Notifications page

```json
{
    "data": [
        {
            "id": "b1e1...",
            "type": "App\\Notifications\\TaskAssignedNotification",
            "data": {
                "type": "task_assigned",
                "task_id": "...",
                "task_title": "Fix login",
                "message": "Alice assigned you to \"Fix login\""
            },
            "read_at": null,
            "created_at": "2026-10-28T09:12:03.000000Z"
        }
    ],
    "current_page": 1,
    "last_page": 3,
    "per_page": 20,
    "total": 41,
    "next_page_url": "...",
    "prev_page_url": null,
    "unread_count": 5
}
```

## Team stats

`GET /api/v1/teams/{team}/dashboard/stats` returns:

| Key                 | Contents                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `tasks_by_column`   | `[{column_name, is_done_column, count}]`, grouped by column name across the team's boards |
| `tasks_by_priority` | `{priority: count}`                                                                       |
| `overdue_tasks`     | Up to 20 open tasks with a past due date, with board, column and assignees                |
| `workload`          | `[{name, task_count, total_effort}]` for tasks not in a done column                       |
| `velocity`          | Completed tasks per week, last 8 weeks                                                    |
| `cycle_time`        | Average days from creation to done, last 30 days                                          |

The API version counts tasks on **all** boards including archived ones; the web endpoint used by the team page counts active boards only. In the current code `velocity` is always empty and `cycle_time` is always `0`, because both look for an activity flag that is never recorded.

## CSV export

`GET /api/v1/teams/{team}/export/csv` (or `GET /{team}/export/csv` with a browser session) downloads every task in the team as `<Team name>-tasks-YYYY-MM-DD.csv`. Any team member can export.

| Column      | Value                                                           |
| ----------- | --------------------------------------------------------------- |
| Board       | Board name                                                      |
| Column      | Column name                                                     |
| Task Number | `#42`                                                           |
| Title       |                                                                 |
| Priority    | `urgent` … `none`                                               |
| Status      | `Done` if the task is in a done column, otherwise `In Progress` |
| Due Date    | `YYYY-MM-DD` or empty                                           |
| Assignees   | Names, comma-separated                                          |
| Labels      | Names, comma-separated                                          |
| Effort      | Number or empty                                                 |
| Created At  | `YYYY-MM-DD HH:MM` (UTC)                                        |

The export includes tasks on archived boards. Status is derived from the column, so a task marked complete outside a done column is exported as `In Progress`.
