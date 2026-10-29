# Custom Fields

Custom fields let a board track details PulseBoard doesn't have built in: a customer name, a severity, a story-point budget, a sign-off checkbox, a link to the spec. Each board defines its own fields. Every task on that board can then hold a value for each one.

This guide covers using custom fields in the app (for everyone), managing them in Board Settings (for team admins), and the REST API.

## Field types

| Type              | Holds                             | Stored value                                  |
| ----------------- | --------------------------------- | --------------------------------------------- |
| **Text**          | Free text, up to 1,000 characters | `"Acme Corp"`                                 |
| **Number**        | Any number (integers or decimals) | `42` or `3.5`                                 |
| **Date**          | A calendar date                   | `"2026-11-02"` (`YYYY-MM-DD`)                 |
| **Checkbox**      | Yes / no                          | `true` (unchecked is stored as no value)      |
| **URL**           | An `http://` or `https://` link   | `"https://example.com/spec"`                  |
| **Single select** | One option from a list you define | an option id, e.g. `"k3f9a0b2c1"`             |
| **Multi-select**  | Any number of options from a list | a list of option ids, e.g. `["k3f9…", "p0…"]` |

Select options each have a **label** and a **color**. An option keeps its id when you rename or recolor it, so tasks that use it are unaffected.

A field's type is fixed once the field exists. To switch types, delete the field and add a new one.

## Managing fields (team owners and admins)

Open the board, select the gear icon to go to **Board settings**, and find the **Custom fields** section. Changes in this section save immediately, and anyone viewing the board sees them without reloading.

### Add a field

1. Select **Add field**.
2. Enter a **Field name**. Names must be unique on the board (case doesn't count, so "Customer" and "customer" clash).
3. Choose a **Type**.
4. For **Single select** and **Multi-select**, add the options: type a label, select the colored dot to pick a color, and press **Enter** or **Add option** for the next one. Use the arrows to put options in order. A select field needs at least one option.
5. Check **Show on task cards** if the value should appear on the board's cards (see [Card display](#card-display)).
6. Select **Add field**.

A board can have up to 50 custom fields, and a select field up to 100 options.

### Edit a field

Select the pencil icon next to a field to rename it, toggle **Show on task cards**, or edit its options. Renaming a field or an option keeps every task's value.

**Removing an option** clears that option from every task on the board when you save. A single-select task that had it ends up empty; a multi-select task keeps its other options. The dialog warns you before you save.

### Reorder fields

Use the up and down arrows next to each field. The order applies to the task sidebar, the list view columns, card pills and the filter menu.

### Delete a field

Select the trash icon and confirm. Deleting a field:

- removes the field's value from **every task on the board** (this can't be undone),
- removes its column from the list view and its pill from cards,
- makes saved filters that used it ignore that part of the filter (the rest of the saved filter still applies).

## Setting values on a task

Open a task. The **Fields** card in the right-hand sidebar lists the board's custom fields, each with a control for its type:

- **Text, Number, URL**: type the value. It saves automatically a moment after you stop typing. A URL field shows an open-in-new-tab button once it holds a valid link.
- **Date**: pick a date.
- **Checkbox**: check or uncheck it.
- **Single select**: pick an option, or **None** to clear it.
- **Multi-select**: check any number of options.

To clear a value, empty the input (or choose **None**, or uncheck everything). The autosave indicator at the top of the task shows when changes are saved. If a value isn't valid (for example, letters in a Number field), the save fails with a message saying which field is wrong.

Anyone who can edit the task can set its values. You don't need to be an admin.

Moving a task to **another board** clears its custom field values, because each board has its own fields.

## Card display

Fields with **Show on task cards** turned on appear as small pills on the board's Kanban cards, below the title:

- select options show as colored pills with the option label,
- a checked checkbox shows a check mark and the field name,
- other types show the field name and the value, for example **Customer** Acme Corp.

Empty values don't take up space. Screen readers hear card field values as part of the card's description.

## List view columns

In the **List** view, every custom field gets its own column after **Labels**, in the board's field order. Select a column header to sort by that field (select again to reverse). Sorting works as follows:

- Number fields sort numerically.
- Select and multi-select fields sort by option order (multi-select by the first selected option).
- Text, URL and date fields sort alphabetically, which for dates is also chronological.
- Tasks without a value always sort last.

URL values in the list are clickable links.

## Filtering and saved filters

Open **Filters** on the board's toolbar. Below Priority, Status, Labels and Due date, each custom field has its own group:

| Field type              | Filter choices              |
| ----------------------- | --------------------------- |
| Single / multi-select   | Each option, plus **Empty** |
| Checkbox                | **Checked**, **Unchecked**  |
| Text, number, date, URL | **Has a value**, **Empty**  |

A task matches a field if it matches **any** choice you checked for that field (for example, _High_ or _Critical_). If you filter on several fields, the task must match **all** of them. Each active field filter shows as a removable chip in the toolbar.

Custom field filters are part of the board URL (as `cf.<field id>=…` parameters), so links you share and the browser's Back button keep them. **Save filter** stores them along with the other filters, including when you mark a saved filter as your default for the board.

## Permissions

| Action                            | Who can do it                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| See fields and values             | Every team member                                                                   |
| Set or clear values on a task     | Anyone who can edit the task                                                        |
| Add, edit, reorder, delete fields | Team **owners** and **admins** (the same people who can manage the board's columns) |

The API enforces the same rules. On top of that, the API token needs the right [ability](#token-abilities).

## API (v1)

All endpoints live under `/api/v1` and take a Sanctum personal access token: `Authorization: Bearer <token>`. `{team}` accepts the team's id or slug. `{board}` accepts the board's id or slug.

### Token abilities

| Endpoint                                   | Ability needed   |
| ------------------------------------------ | ---------------- |
| `GET` list fields, board, tasks            | any token (read) |
| Create / update tasks with `custom_fields` | `write`          |
| Create, update, reorder, delete fields     | `manage`         |

A `manage` token still needs a user who is a team owner or admin, or the request fails with `403`.

### List fields

`GET /api/v1/teams/{team}/boards/{board}/custom-fields`

```json
{
    "data": [
        {
            "id": "9d1c6a2e-8f0b-4a51-9a51-2b7c0e7f4d11",
            "board_id": "9d1c69f0-2c4e-4b9e-8d0a-6f3b1a2c5e77",
            "name": "Severity",
            "type": "select",
            "options": [
                { "id": "k3f9a0b2c1", "label": "Minor", "color": "#22c55e" },
                { "id": "p07dxq4m2z", "label": "Major", "color": "#ef4444" }
            ],
            "sort_order": 0,
            "show_on_card": true,
            "created_at": "2026-10-28T14:02:11.000000Z",
            "updated_at": "2026-10-28T14:02:11.000000Z"
        }
    ]
}
```

`GET /api/v1/teams/{team}/boards/{board}` also includes the definitions as `data.custom_fields`.

### Create a field

`POST /api/v1/teams/{team}/boards/{board}/custom-fields` (`manage`)

```json
{
    "name": "Severity",
    "type": "select",
    "show_on_card": true,
    "options": [
        { "label": "Minor", "color": "#22c55e" },
        { "label": "Major", "color": "#ef4444" }
    ]
}
```

| Field             | Rules                                                                             |
| ----------------- | --------------------------------------------------------------------------------- |
| `name`            | required, up to 100 characters, unique on the board (case-insensitive)            |
| `type`            | required: `text`, `number`, `date`, `checkbox`, `url`, `select` or `multi_select` |
| `show_on_card`    | optional boolean, default `false`                                                 |
| `options`         | required for `select` / `multi_select` (1 to 100 items), ignored for other types  |
| `options.*.label` | required, up to 100 characters, unique within the field                           |
| `options.*.color` | optional `#rrggbb`, default `#64748b`                                             |

The server generates option ids. Returns `201` with the field in `data`.

### Update a field

`PUT /api/v1/teams/{team}/boards/{board}/custom-fields/{field}` (`manage`)

Send only what changes. To keep an option (and every task's value for it), include its `id`. Options without an id are created. Existing options you leave out are **deleted and cleared from all tasks**.

```json
{
    "name": "Impact",
    "options": [
        { "id": "p07dxq4m2z", "label": "Major", "color": "#ef4444" },
        { "label": "Critical", "color": "#7f1d1d" }
    ]
}
```

Here _Minor_ (`k3f9a0b2c1`) is removed. `type` can be sent, but only with the field's current type. A different type returns `422`. Returns `200` with the updated field.

### Reorder fields

`PUT /api/v1/teams/{team}/boards/{board}/custom-fields` (`manage`)

```json
{ "field_ids": ["9d1c6a2e-…", "9d1c6b77-…"] }
```

Listed fields come first, in the given order. Fields you leave out keep their relative order after them. An id that isn't a field on this board returns `422`. Returns `200` with the board's fields in their new order.

### Delete a field

`DELETE /api/v1/teams/{team}/boards/{board}/custom-fields/{field}` (`manage`)

Deletes the field and clears its value from every task on the board. Returns `204`.

### Task values

Task responses (list, show, create, update, move) include `custom_fields`: an object keyed by field id, or `null` when the task has no values.

```json
{
    "data": {
        "id": "9d1c7f02-…",
        "title": "Checkout fails on Safari",
        "custom_fields": {
            "9d1c6a2e-8f0b-4a51-9a51-2b7c0e7f4d11": "p07dxq4m2z",
            "9d1c6b77-1e2d-4c3b-8a9f-0d1e2f3a4b5c": 3.5
        }
    }
}
```

To set values, send `custom_fields` when you create a task (`POST …/columns/{column}/tasks`) or update one (`PUT …/tasks/{task}`) with a `write` token:

```json
{
    "custom_fields": {
        "9d1c6a2e-8f0b-4a51-9a51-2b7c0e7f4d11": "k3f9a0b2c1",
        "9d1c6b77-1e2d-4c3b-8a9f-0d1e2f3a4b5c": null
    }
}
```

How updates work:

- **Partial**: only the fields you send change. Other fields keep their values.
- `null`, `""`, `[]` or (for a checkbox) `false` clears that field's value.
- `"custom_fields": null` clears **all** of the task's values.
- Keys that aren't fields on the task's board are ignored.
- Each value is validated against its field's type: numbers must be numeric (within ±10^15), dates must be real `YYYY-MM-DD` dates, URLs must be absolute `http(s)` links (up to 2,048 characters), text can be up to 1,000 characters, select values must be one of the field's option ids, and multi-select values must be a list of them. Checkboxes take `true`/`false`.
- An invalid value fails the whole request with `422`, and the error is keyed by field id:

```json
{
    "message": "Severity must be one of the field's options.",
    "errors": {
        "custom_fields.9d1c6a2e-8f0b-4a51-9a51-2b7c0e7f4d11": [
            "Severity must be one of the field's options."
        ]
    }
}
```

Multi-select values are stored in the field's option order, whatever order you send them in.

## Real-time updates

Changes to field definitions broadcast a `BoardChanged` event (`custom_field.created`, `custom_field.updated`, `custom_field.reordered`, `custom_field.deleted`) on the board's private channel, so open boards and task pages refresh. Value changes go through the normal task update, so they appear in the task's activity log and refresh other viewers the same way other task edits do.
