# Tasks

Tasks are the cards on a board. This page covers task fields, structure (subtasks, dependencies), recurrence, templates, comments, and the activity feed.

## Creating tasks

- **Quick add** at the bottom of a Kanban column: type a title and press Enter. If the team has task templates, the template button next to it creates the task from a template instead.
- **New task** dialog on the board header: title plus a column.
- From the [API](api.md) or a [template](#task-templates).

Each task gets a number that is sequential **per board** (`#1`, `#2`, …). Task URLs combine the number with a slug of the title, for example `/acme/website/tasks/42-fix-login`. Only the number matters when resolving the URL, so links survive renames. Moving a task to another board gives it a new number on that board.

Creation fails if the target column is at its [WIP limit](getting-started.md#columns).

## Task fields

Most fields save automatically on the task page; the autosave indicator shows the state.

| Field                                    | Details                                                                                                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title                                    | Required, up to 255 characters.                                                                                                                          |
| Description                              | Rich text (see [Rich text](#rich-text)). Up to 50,000 characters. Sanitized on the server.                                                               |
| Priority                                 | `urgent`, `high`, `medium`, `low`, or `none` (default).                                                                                                  |
| Due date                                 | A calendar date (no time). Drives due-soon and overdue [notifications](notifications.md) and the `due_date_reached` [automation trigger](automation.md). |
| Effort                                   | A whole number of points (0 or more). Summed per person in the [Workload view](views-and-filters.md#workload-view).                                      |
| Assignees                                | Any number of active team members. Assigning someone notifies them.                                                                                      |
| Labels                                   | Any of the team's labels.                                                                                                                                |
| Watchers                                 | Watch a task with the **Watch** button to get comment, completion and attachment notifications without being assigned.                                   |
| Checklists                               | Up to 50 named checklists, each with items that can be ticked off. Cards show overall progress, for example `3/5`.                                       |
| Related links                            | Up to 50 URL + label pairs (URLs up to 2,048 characters).                                                                                                |
| Attachments                              | See [Attachments](#attachments).                                                                                                                         |
| Custom fields                            | See [Custom fields](custom-fields.md).                                                                                                                   |
| GitLab project, branches, merge requests | See [GitLab integration](gitlab-integration.md).                                                                                                         |
| Figma links                              | See [Figma integration](figma-integration.md).                                                                                                           |

### Completing a task

**Mark complete** sets the task's completion time; **Completed — Reopen** clears it. Moving a task into the board's done column also completes it, and moving it out reopens it. If the board has **auto-move to Done** enabled, completing a task also moves it to the done column. Completing notifies the task's assignees, its creator and its watchers (except the person who completed it).

### Moving tasks

- Drag a card within or between columns on the Kanban view.
- To move a task to **another board in the same team**, use the board/column pickers on the task page. This needs the admin or owner role, because it requires permission to update the destination board. The task gets a new number on the destination board.

### Deleting tasks

The task's creator and team admins/owners can delete a task. Deleting a parent task does not delete its subtasks; they become regular tasks.

## Subtasks

Subtasks are full tasks with a parent. Add them from the **Subtasks** section of a task; they are created in the parent's column and also appear on the board as their own cards (and count toward WIP limits). The parent's card shows subtask progress (completed / total). A subtask must be on the same board as its parent.

## Dependencies

The **Dependencies** section of a task has two lists:

- **Blocked by**: tasks that must be finished before this one.
- **Blocking**: tasks waiting on this one.

You can link any task in the same team, including tasks on other boards (other boards offer only open tasks in the picker). PulseBoard rejects duplicates and links that would create a cycle.

Dependencies are informational. They do not stop anyone from moving or completing a task. Cards with at least one "blocked by" link show a blocked indicator; note that the indicator does not check whether the blocking tasks are already done.

## Attachments

- Upload files from the **Attachments** section (drag and drop works). Every upload is recorded in the activity feed and notifies assignees and watchers.
- Default limit: **15 MB** per file (`UPLOAD_MAX_ATTACHMENT_KB`).
- Default allowed types: `jpg, jpeg, png, gif, webp, pdf, doc, docx, xls, xlsx, ppt, pptx, txt, csv, zip, mp4, webm`. Administrators can change the list with `UPLOAD_ATTACHMENT_TYPES` (see [Administration](administration.md#upload-limits)). Both the extension and the detected file type must match.
- Image attachments get a 200×200 thumbnail. Attachments are stored privately and are only served to team members.

Images pasted or inserted into a description or comment are uploaded separately (up to **5 MB**, `jpg, jpeg, png, gif, webp`) and stored on the public disk.

## Rich text

Descriptions and comments use the same editor. It supports headings, bold/italic/underline, lists, **task lists (checkboxes)**, links, images, tables, and code blocks with syntax highlighting. Other details:

- **Mentions.** Type `@` to mention a team member. Mentioned people are notified (see [Notifications](notifications.md)). Only active members of the task's team are notified.
- **Checkboxes in descriptions** can be ticked directly in the read-only view.
- **Copy as Markdown** is available on the description.

## Comments

- Post comments at the bottom of the task page. New top-level comments notify assignees, watchers, and anyone mentioned.
- **Replies.** Reply to a comment to start a thread. Threads are one level deep: replying to a reply attaches to the original comment. Replies notify the original commenter and everyone else who replied in the thread, plus anyone mentioned.
- **Editing.** You can edit and delete only your own comments in the UI. Edited comments are marked as edited. Adding a new mention while editing notifies the newly mentioned person.
- **Task-list checkboxes in comments** can be toggled by the comment's author directly in the comment, without opening the editor. Other people see the checkboxes read-only.
- Comment bodies are limited to 65,535 characters.

## Activity feed

The task page shows comments and, optionally, system activity. Use the toggle to switch between **Comments** only and **All activity**, and the sort button to switch between newest and oldest first (the sort order is saved to your profile; the filter is remembered in your browser).

Logged activity includes: task created; field changes (title, description, priority, due date, effort, checklists, links, recurrence, custom fields); moves between columns and boards (including automatic moves); completed and reopened; assignees added or removed; labels changed; attachments added or removed; dependencies added or removed; GitLab branch and merge request created. Comments are logged too, but only top-level comments, not replies.

## Recurring tasks

Recurrence is set in the task sidebar. When it is on, PulseBoard periodically creates a **new copy** of the task; the original stays as the "template" for future copies.

**What the backend actually supports**

| Option              | Behaviour                             |
| ------------------- | ------------------------------------- |
| Frequency `daily`   | Every _interval_ days.                |
| Frequency `weekly`  | Every _interval_ weeks.               |
| Frequency `monthly` | Every _interval_ months.              |
| Frequency `custom`  | Same as daily: every _interval_ days. |
| Interval            | Whole number, 1 or more.              |

The sidebar also shows **On days** (weekly), **On day** (monthly) and **Until** (end date) controls. These values are saved with the task but **ignored by the scheduler**: copies are not limited to the chosen weekdays or day of month, and recurrence does not stop at the end date. To stop a recurring task, turn recurrence off.

**When copies are created**

- Saving a recurrence setting schedules the first copy one interval **from the moment you save it** (not from the due date).
- The `tasks:process-recurring` command runs once a day (at midnight in the app timezone, UTC by default) via the scheduler. It creates a copy for every task whose next occurrence has passed, then advances the next occurrence by whole intervals until it is in the future, so a missed run creates at most one copy per task.
- The copy is created in the **same column** as the original, by the original task's creator, with the same title, description, priority, effort, assignees, labels and checklists (including ticked items). It does **not** copy the due date, custom fields, links, attachments, subtasks or dependencies, and the copy itself is not recurring.
- The board's WIP limit still applies. If the column is full, that run logs an error for the task and skips it.

## Task templates

Task templates prefill new tasks. They belong to a team and are managed by admins and owners.

- **Create** in **Board settings → Task templates**, or from any task with **Save as template** in the task sidebar (copies its description, checklists, labels, priority and effort).
- Template fields: name, description, priority, effort, checklists, labels.
- **Use** a template from the column's quick-add template button (any member). The task title defaults to the template name. The template's checklists are copied as-is.
- **Default template.** In board settings, pick a template to apply to every new task on that board, including tasks created through the API. Anything entered explicitly overrides the template's values.
