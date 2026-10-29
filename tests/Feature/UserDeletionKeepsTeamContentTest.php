<?php

namespace Tests\Feature;

use App\Actions\Teams\CreateBotUser;
use App\Actions\Teams\DeleteTeam;
use App\Models\Board;
use App\Models\Column;
use App\Models\Task;
use App\Models\TaskDependency;
use App\Models\TaskTemplate;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Deleting a user must not be blocked by (or delete) the shared team content
 * they created; their authorship is cleared instead.
 */
class UserDeletionKeepsTeamContentTest extends TestCase
{
    use RefreshDatabase;

    private Team $team;

    private Board $board;

    private Column $column;

    private User $colleague;

    protected function setUp(): void
    {
        parent::setUp();

        $this->team = Team::factory()->create();
        $this->board = Board::factory()->create(['team_id' => $this->team->id]);
        $this->column = Column::factory()->create(['board_id' => $this->board->id]);
        $this->colleague = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $this->colleague->id, 'role' => 'owner']);
    }

    /**
     * Give $author one of everything that references its creator.
     *
     * @return array{task: Task, other: Task, dependency: TaskDependency, template: TaskTemplate}
     */
    private function createContentBy(User $author): array
    {
        $task = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $author->id,
        ]);
        $other = Task::factory()->create([
            'board_id' => $this->board->id,
            'column_id' => $this->column->id,
            'created_by' => $this->colleague->id,
        ]);

        // $author assigned the colleague to a colleague's task.
        $other->assignees()->attach($this->colleague->id, ['assigned_by' => $author->id, 'assigned_at' => now()]);

        $dependency = TaskDependency::create([
            'task_id' => $other->id,
            'depends_on_task_id' => $task->id,
            'created_by' => $author->id,
        ]);

        $template = TaskTemplate::create([
            'team_id' => $this->team->id,
            'name' => 'Bug report',
            'priority' => 'none',
            'created_by' => $author->id,
        ]);

        return compact('task', 'other', 'dependency', 'template');
    }

    public function test_user_who_created_content_can_delete_their_account(): void
    {
        $user = User::factory()->create();
        TeamMember::create(['team_id' => $this->team->id, 'user_id' => $user->id, 'role' => 'member']);
        $content = $this->createContentBy($user);

        $this->actingAs($user)
            ->delete('/profile', ['password' => 'password'])
            ->assertSessionHasNoErrors()
            ->assertRedirect('/');

        $this->assertNull($user->fresh());

        // The team's content survives with its creator cleared.
        $this->assertNull($content['task']->fresh()->created_by);
        $this->assertNull($content['dependency']->fresh()->created_by);
        $this->assertNull($content['template']->fresh()->created_by);
        $this->assertDatabaseHas('task_assignees', [
            'task_id' => $content['other']->id,
            'user_id' => $this->colleague->id,
            'assigned_by' => null,
        ]);
    }

    public function test_deleting_a_team_deletes_a_bot_that_created_team_content(): void
    {
        $bot = CreateBotUser::run($this->team, ['name' => 'Deploy Bot']);

        // A bot-created task template outlives the boards, which DeleteTeam
        // removes first, so it used to block deleting the bot.
        TaskTemplate::create([
            'team_id' => $this->team->id,
            'name' => 'Release',
            'priority' => 'none',
            'created_by' => $bot->id,
        ]);
        $this->createContentBy($bot);

        DeleteTeam::run($this->team);

        $this->assertDatabaseMissing('teams', ['id' => $this->team->id]);
        $this->assertDatabaseMissing('users', ['id' => $bot->id]);
    }

    public function test_task_page_shows_a_task_whose_creator_was_deleted(): void
    {
        $user = User::factory()->create();
        $content = $this->createContentBy($user);
        $user->delete();

        $task = $content['task']->fresh();

        $this->actingAs($this->colleague)
            ->get(route('tasks.show', [$this->team->slug, $this->board->slug, $task->getRouteKey()]))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->where('task.created_by', null)->where('task.creator', null));
    }
}
