# Administration

This guide is for people who run a PulseBoard instance. Installation, environment variables, Docker images and reverse-proxy setup are in the [README](../README.md); real-time specifics are in [Real-time collaboration](real-time.md).

## App administrators

App administrators (users with `is_admin`) can open the admin panel at `/admin`. They don't automatically get access to team content; team access always comes from team membership and roles (see [Getting started](getting-started.md#roles-and-permissions)).

Ways to make someone an administrator:

- `php artisan user:make-admin someone@example.com` (the user must already exist).
- In **Admin → Users**, edit the user and tick the admin flag.
- When creating the very first user, see the README's tinker example, or register at `/register` and then run `user:make-admin`.

Administrators can't remove their own admin flag or deactivate their own account from the panel.

### Who can sign up

While local (password) authentication is enabled, **anyone who can reach the site can register** at `/register`. To restrict access, use SSO and disable local authentication (below), or keep the instance on a private network. SSO logins create accounts on first sign-in (JIT provisioning); see [SAML configuration](saml-configuration.md) and [OIDC configuration](oidc-configuration.md).

## Admin panel

| Section        | What you can do                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**  | Totals: users, active users, teams, boards, active GitLab connections.                                                                                                                                                                          |
| **Users**      | Search by name or email (10, 25 or 50 per page). Create a user (name, email, password, admin flag). Edit name, email and admin flag (bots can't be edited). **Deactivate** or **reactivate** a user. Send a password reset link (not for bots). |
| **Teams**      | List every team with member and board counts. Open a team to see its members and boards, add any active user with any role, remove members, or delete the team (type `DELETE` to confirm). The last owner of a team can't be removed.           |
| **Boards**     | List every board (including archived) with its team and task count. Delete a board (type `DELETE`).                                                                                                                                             |
| **SSO**        | Manage SAML identity provider configurations and test them. See [SAML configuration](saml-configuration.md).                                                                                                                                    |
| **API Tokens** | Lists active users who have tokens, plus every active bot. Create a `read` or `read`+`write` token for one of them, or revoke tokens.                                                                                                           |

There is no settings page in the admin panel; instance-wide switches are console commands.

### Deactivating users

Deactivation is reversible and keeps the user's history:

- The user is signed out on their next request and can't sign in.
- All their API tokens are **revoked immediately** (reactivation does not restore them).
- They are hidden from assignee pickers, mention suggestions and member search, and they no longer receive email.
- Existing assignments, comments and activity keep their name.

### Deleted accounts

There's no admin action to delete a user; deactivate them instead. Users can delete their own account from **Profile → Delete Account**, and deleting a team deletes the bot users it created. When a user is deleted:

- Tasks, task templates and dependencies they created stay, and show their creator as "a deleted user". The record of who assigned someone to a task is cleared too.
- Their comments (including any replies to them), their team memberships, their own assignments and watches, and their saved filters and board templates are deleted.
- Activity entries stay; the task activity feed shows them as "System".

## Disabling local authentication

```bash
php artisan auth:local             # show current status
php artisan auth:local --disable   # require SSO
php artisan auth:local --enable    # allow email/password again
```

`--disable` refuses to run unless at least one SSO configuration is active, and asks for confirmation. While local auth is disabled:

- `/login` redirects straight to the SSO provider.
- Registration is closed and password login attempts are rejected.

If you lock yourself out (for example, SSO breaks), run `php artisan auth:local --enable` on the server. The setting is stored in the database and cached for 60 seconds; the command clears the cached value, so with the shared Redis cache the change applies immediately.

## Console commands

| Command                            | Purpose                                                | Scheduled                   |
| ---------------------------------- | ------------------------------------------------------ | --------------------------- |
| `user:make-admin {email}`          | Grant app admin rights                                 | —                           |
| `auth:local [--enable\|--disable]` | Show or change local authentication                    | —                           |
| `tasks:send-due-reminders`         | Due-soon notifications for tasks due today or tomorrow | Hourly                      |
| `automations:run-due-date`         | Fire `due_date_reached` automation rules               | Hourly                      |
| `tasks:send-overdue-reminders`     | Overdue notifications                                  | Daily at 09:00              |
| `gitlab:sync-refs`                 | Refresh up to 100 stale merge request refs from GitLab | Every 15 minutes            |
| `tasks:process-recurring`          | Create copies of recurring tasks                       | Daily at 00:00 (no overlap) |
| `notifications:send-emails`        | Send notification emails and digests                   | Every 5 minutes             |

Times use the app timezone, which is `UTC` (`config/app.php`). Details: [Notifications](notifications.md), [Automation](automation.md#due-date-schedule), [Recurring tasks](tasks.md#recurring-tasks), [GitLab background sync](gitlab-integration.md#background-sync).

For demo data in a development environment: `php artisan db:seed --class=DemoSeeder` (login `alice@demo.test` / `password`). Don't run it in production.

## Scheduler and queue

PulseBoard needs two background processes besides the web server and Reverb:

| Process      | Command                                                                        | Needed for                                                            |
| ------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Scheduler    | `php artisan schedule:run` every minute (cron), or `php artisan schedule:work` | Reminders, emails, recurring tasks, due-date automations, GitLab sync |
| Queue worker | `php artisan queue:work redis --sleep=3 --tries=3`                             | Broadcasting real-time events (`BoardChanged`, `NotificationCreated`) |

Notifications, emails, automations and GitLab webhooks run synchronously; the queue only carries broadcast events. If the queue worker stops, the app keeps working but live updates stop.

The Docker image runs Octane, Reverb, the queue worker (`--max-time=3600`) and a scheduler loop under Supervisor (`docker/supervisord.conf`), so nothing extra is needed there. For manual installs, run the queue worker under a process manager and add the cron entry from the README.

The due-date automation command stores its "already fired today" markers in the cache, so use a persistent shared cache store (Redis, the default).

## Upload limits

| Variable                     | Default                                                                     | Applies to                                            |
| ---------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| `UPLOAD_MAX_ATTACHMENT_KB`   | `15360` (15 MB)                                                             | Task attachments                                      |
| `UPLOAD_MAX_EDITOR_IMAGE_KB` | `5120` (5 MB)                                                               | Images in descriptions and comments                   |
| `UPLOAD_MAX_AVATAR_KB`       | `2048` (2 MB)                                                               | Team and board images                                 |
| `UPLOAD_ATTACHMENT_TYPES`    | `jpg,jpeg,png,gif,webp,pdf,doc,docx,xls,xlsx,ppt,pptx,txt,csv,zip,mp4,webm` | Allowed attachment extensions                         |
| `UPLOAD_IMAGE_TYPES`         | `jpg,jpeg,png,gif,webp`                                                     | Allowed image extensions (SVG is excluded on purpose) |

`config/uploads.php` lists further extensions you can add to `UPLOAD_ATTACHMENT_TYPES` (for example `7z, tar, gz, mp3, ogg, wav, json, yaml, md, rtf, odt, ods, odp, bmp, tiff, ico, avi, mov`). An extension without an entry in that file's MIME map can't pass validation.

The Docker image also caps uploads at the PHP and web-server level: `upload_max_filesize = 25M`, `post_max_size = 30M` (`docker/php.ini`) and a 30 MB request body (`docker/Dockerfile`). Raising the app limits above those also requires changing them, plus any limit on your reverse proxy.

## Backups

Back up all of the following together:

| What                         | Where (Docker production compose)              | Why                                                                                                                                                               |
| ---------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MySQL database               | `mysql-data` volume                            | All application data                                                                                                                                              |
| Storage directory            | `app-storage` volume (`/var/www/html/storage`) | Attachments (`storage/app/private`), team/board images and editor images (`storage/app/public`)                                                                   |
| `.env`, especially `APP_KEY` | Host `.env` file                               | GitLab and Figma tokens, GitLab webhook secrets and SAML certificates are encrypted with `APP_KEY`. Without the same key they can't be decrypted after a restore. |

Redis holds sessions, cache and the queue. Losing it signs users out and may drop in-flight broadcasts, but no permanent data.

Example database dump:

```bash
docker compose -f docker-compose.prod.yml exec mysql \
  sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > pulseboard.sql
```

**Set `APP_KEY` explicitly.** In production (`APP_ENV` other than `local` or `development`), the container refuses to start without an `APP_KEY` and prints how to create one. It no longer generates a key inside the container, because that key would be lost when the container is recreated (for example on an image upgrade), which would sign everyone out and make stored GitLab/Figma tokens, webhook secrets and SAML certificates unreadable. Generate a key once (`echo "base64:$(openssl rand -base64 32)"`, or `php artisan key:generate --show` on a machine with the code), put it in your `.env` as `APP_KEY=...`, and keep it with your backups. The development compose file still generates a key on first start; it's written to your bind-mounted `.env`, so it persists.

## Upgrades

### Docker

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

On start the entrypoint waits for MySQL, runs `php artisan migrate --force`, rebuilds the config, route, view and event caches, and starts all processes. Back up the database before upgrading.

### Manual installs

```bash
git pull
composer install --no-dev --optimize-autoloader
npm ci && npx vite build
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan event:cache
php artisan octane:reload        # reload long-lived Octane workers
php artisan queue:restart        # workers exit after their current job; your process manager restarts them
# restart the Reverb process via your process manager
```

Octane keeps the application in memory, so PHP changes (code, routes, config) take effect only after `octane:reload` or a restart. In the Docker image, OPcache timestamp validation is also off, so restart the container after changing code.

## Health check

`GET /up` returns `200` when the application boots. Use it for load balancer or container health checks.
