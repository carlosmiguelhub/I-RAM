<?php

namespace Tests\Feature;

use App\Models\ArchiveFolder;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ArchiveFolderHierarchyTest extends TestCase
{
    use RefreshDatabase;

    public function test_records_officer_can_create_nested_folders_and_receive_their_paths(): void
    {
        Sanctum::actingAs($this->recordsOfficer());

        $parentId = $this->postJson('/api/archive/folders', [
            'name' => 'Academic Records',
        ])->assertCreated()->json('folder.id');

        $childId = $this->postJson('/api/archive/folders', [
            'name' => '2026',
            'parent_id' => $parentId,
        ])->assertCreated()->json('folder.id');

        $this->postJson('/api/archive/folders', [
            'name' => 'Graduates',
            'parent_id' => $childId,
        ])->assertCreated();

        $this->getJson('/api/archive/folders')
            ->assertOk()
            ->assertJsonFragment([
                'name' => 'Graduates',
                'path' => 'Academic Records / 2026 / Graduates',
            ]);
    }

    public function test_folder_names_are_unique_only_within_the_same_parent(): void
    {
        Sanctum::actingAs($this->recordsOfficer());

        $first = ArchiveFolder::create([
            'name' => 'Department A',
            'created_by' => auth()->id(),
        ]);
        $second = ArchiveFolder::create([
            'name' => 'Department B',
            'created_by' => auth()->id(),
        ]);

        $this->postJson('/api/archive/folders', [
            'name' => '2026',
            'parent_id' => $first->id,
        ])->assertCreated();

        $this->postJson('/api/archive/folders', [
            'name' => '2026',
            'parent_id' => $second->id,
        ])->assertCreated();

        $this->postJson('/api/archive/folders', [
            'name' => '2026',
            'parent_id' => $first->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_folder_with_subfolders_cannot_be_deleted_accidentally(): void
    {
        Sanctum::actingAs($this->recordsOfficer());

        $parent = ArchiveFolder::create([
            'name' => 'Parent',
            'created_by' => auth()->id(),
        ]);
        ArchiveFolder::create([
            'name' => 'Child',
            'parent_id' => $parent->id,
            'created_by' => auth()->id(),
        ]);

        $this->deleteJson("/api/archive/folders/{$parent->id}")
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'This folder contains subfolders. Delete or move those subfolders first.'
            );

        $this->assertDatabaseHas('archive_folders', ['id' => $parent->id]);
    }

    private function recordsOfficer(): User
    {
        $role = Role::create(['name' => 'Records Officer']);

        return User::factory()->create([
            'role_id' => $role->id,
            'status' => 'active',
        ]);
    }
}
