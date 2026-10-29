# Getting Started

This guide covers the building blocks of PulseBoard: teams, roles, boards, columns, templates, members, and bot users.

## Teams

A team is the unit of ownership and access. Every board belongs to exactly one team, and only team members can see its boards, tasks, labels, and integrations.

- Any signed-in user can create a team from **Teams** (`/teams`). The creator becomes the team's first **owner**.
- Teams have a name, an optional description (up to 1,000 characters), and an optional image (JPG, PNG, GIF or WebP, up to 2 MB by default).
- A team's URL is a slug generated from its name (for example `/acme-design`). Renaming the team regenerates the slug, so old links stop working.
- Team settings live at `/{team}/settings` and are split into tabs: **General**, **Members**, **Labels**, **Integrations**, **API & bots**, and **Danger zone**. Every member can open the page, but members only see the first three tabs, read-only.

## Roles and permissions

Each team member has one role: `owner`, `admin`, or `member`. The table below is taken from the policies (`app/Policies/*`) and the member controllers.

| Action                                                                    | Member | Admin | Owner |
| ------------------------------------------------------------------------- | :----: | :---: | :---: |
| View the team, its boards and tasks                                       |   ✓    |   ✓   |   ✓   |
| Create a blank board                                                      |   ✓    |   ✓   |   ✓   |
| Create, edit, move (within a board), complete and assign tasks            |   ✓    |   ✓   |   ✓   |
| Comment; edit your own comments                                           |   ✓    |   ✓   |   ✓   |
| Delete a task you created                                                 |   ✓    |   ✓   |   ✓   |
| Delete any task                                                           |        |   ✓   |   ✓   |
| Delete another member's comment                                           |        |   ✓   |   ✓   |
| Export the team's tasks as CSV                                            |   ✓    |   ✓   |   ✓   |
| Rename the team, change its description or image                          |        |   ✓   |   ✓   |
| Manage labels and task templates                                          |        |   ✓   |   ✓   |
| Open board settings: rename, columns, automation, default template        |        |   ✓   |   ✓   |
| Archive, restore and delete boards                                        |        |   ✓   |   ✓   |
| Move tasks to another board                                               |        |   ✓   |   ✓   |
| Create a board from a board template                                      |        |   ✓   |   ✓   |
| Manage GitLab and Figma connections                                       |        |   ✓   |   ✓   |
| Manage bot users and their tokens                                         |        |   ✓   |   ✓   |
| Add members, remove members, change a member's role to admin or member    |        |   ✓   |   ✓   |
| Add, remove or change the role of an admin or owner; grant the owner role |        |       |   ✓   |
| Delete the team                                                           |        |       |   ✓   |

Notes:

- A team must always have at least one owner. You cannot remove the last owner or change their role until another member is an owner.
- Cross-board moves check board-update permission on the destination board, which only admins and owners have.
- App-wide administrators (`is_admin`) are a separate concept. See [Administration](administration.md).

## Adding members

PulseBoard has no email invitations. Owners and admins add people who already have an account:

1. Open **Team settings → Members** and choose **Add member**.
2. Search by name or email (at least 2 characters). Existing members and deactivated accounts are excluded from results.
3. Pick a role and confirm. Only owners can add someone directly as an owner.

People need an account first. Depending on how your instance is set up, they can register at `/register`, sign in with SSO, or have an administrator create the account for them (see [Administration](administration.md)).

Accounts that an app administrator deactivates stay listed under **Deactivated accounts** on the Members tab, so their past work keeps its attribution. They can't sign in and are filtered out of assignee and mention pickers.

## Boards

A board is a set of ordered columns that hold tasks.

- Create a board from the team page with **New board**. Choose **Blank board** or, for admins and owners, **From template**.
- A blank board starts with four columns: **To Do**, **In Progress**, **In Review**, and **Done** (marked as the done column).
- Boards have a name, an optional description (up to 1,000 characters), and an optional image. Board URLs are `/{team}/{board}`. Renaming a board regenerates its slug.
- Board settings (`/{team}/{board}/settings`, admins and owners) cover details, image, columns, task templates, automation rules, saving the board as a template, archiving, and deletion.
- **Archiving** hides a board from the sidebar, the team page and the dashboard. Nothing is deleted. Restore it from **Archived boards** on the team page.
- **Deleting** a board permanently removes its tasks, comments and attachments. You must type `DELETE` to confirm.
- Each user can **star** boards from the sidebar. Starred boards are stored in your profile and appear first in the quick switcher.

### Board options

| Setting                                           | Effect                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auto-move tasks to the Done column when completed | When a task is marked complete, it moves to the board's done column (the first one by position if there are several).                                                       |
| Default task template                             | Values from this template (description, priority, effort, labels) prefill every new task on the board. Values you enter yourself win. See [Tasks](tasks.md#task-templates). |

## Columns

Columns are managed from board settings by admins and owners.

- **Name and color.** Colors are hex values such as `#22c55e`.
- **WIP limit.** An optional positive number. When a column holds that many tasks, creating a task in it or moving a task into it is rejected with "Column … has reached its WIP limit". Every task in the column counts, including completed tasks and subtasks. A limit of 0 or empty means no limit. The Kanban header shows the count as `3/5 WIP`.
- **Done column.** Moving a task into the done column marks it complete. Moving it out of the done column into a regular column reopens it. A board normally has one done column: marking a column as done in board settings clears the flag on the others.
- **Order.** Drag columns in board settings to reorder them.
- **Removing a column.** If the column has tasks you choose a destination column, and the tasks are appended to it (their completion state follows the destination's done flag). Otherwise its tasks are deleted. A board must keep at least one column.

## Labels

Labels are defined per team (name up to 50 characters, hex color) under **Team settings → Labels** by admins and owners. Any board in the team can use them.

## Board templates

A board template is a saved list of columns: names, colors, WIP limits and the done flag. Templates do not include tasks.

- Save one from **Board settings → Board template**. It is named "<Board> Template". Saving the same board twice without changes reuses the existing template.
- Board templates are **personal**: you see only the templates you created. App administrators can delete anyone's template but still only list their own.
- To use one, choose **New board → From template** on the team page. This needs the admin or owner role in that team, and the template must be yours (or you must be an app administrator).

## Bot users

Bot users let scripts, CI jobs and agents call the [REST API](api.md) without using a person's account.

1. Open **Team settings → API & bots** (admins and owners) and choose **Create bot**.
2. The bot is created as a `member` of this team only. It gets a generated `@pulseboard.local` email and an unusable random password, so it cannot sign in to the web app.
3. Create one or more tokens for the bot. Each token has the `read` ability, plus `write` if you tick it. The token is shown once, so copy it immediately.
4. Revoke tokens individually, or remove the bot. Removing a bot revokes all its tokens, removes it from the team and deactivates it.

Bots act with member permissions. An owner can promote a bot to admin on the Members tab, but tokens created in the UI never carry the `manage` ability that structural API endpoints require. See [API token abilities](api.md#token-abilities).

Deleting a team deletes the bots it created along with their tokens.

## Next steps

- [Tasks](tasks.md): fields, subtasks, dependencies, recurrence, comments.
- [Views and filters](views-and-filters.md): Kanban, List and Workload views, saved filters, quick switcher.
- [Automation](automation.md): rules that react to task events.
