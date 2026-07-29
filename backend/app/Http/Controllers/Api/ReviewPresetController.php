<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ReviewPreset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReviewPresetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $role = $request->user()->role?->name ?? '';

        if (! in_array($role, ['Admin', 'Records Officer'], true)) {
            return response()->json([
                'message' => 'You are not authorized to view review presets.',
            ], 403);
        }

        return $this->presetResponse();
    }

    public function adminIndex(): JsonResponse
    {
        return $this->presetResponse();
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules($request));
        $preset = ReviewPreset::create($validated);

        $this->audit($request, 'review_preset.created', $preset);

        return response()->json([
            'message' => 'Preset added.',
            'data' => $preset,
        ], 201);
    }

    public function update(
        Request $request,
        ReviewPreset $reviewPreset
    ): JsonResponse {
        $validated = $request->validate(
            $this->rules($request, $reviewPreset)
        );

        $reviewPreset->update($validated);
        $this->audit($request, 'review_preset.updated', $reviewPreset);

        return response()->json([
            'message' => 'Preset updated.',
            'data' => $reviewPreset->fresh(),
        ]);
    }

    public function destroy(
        Request $request,
        ReviewPreset $reviewPreset
    ): JsonResponse {
        $type = $reviewPreset->type;
        $reviewPreset->delete();

        $this->auditType($request, 'review_preset.deleted', $type);

        return response()->json([
            'message' => 'Preset removed.',
        ]);
    }

    private function presetResponse(): JsonResponse
    {
        $presets = ReviewPreset::query()
            ->orderBy('type')
            ->orderBy('value')
            ->get();

        return response()->json([
            'data' => $presets,
        ]);
    }

    private function rules(
        Request $request,
        ?ReviewPreset $reviewPreset = null
    ): array {
        $request->merge([
            'value' => trim((string) $request->input('value')),
        ]);

        $type = (string) $request->input('type');
        $maxLength = $type === ReviewPreset::STORAGE_LOCATION
            ? 255
            : 5000;

        return [
            'type' => [
                'required',
                Rule::in([
                    ReviewPreset::REVIEW_REMARK,
                    ReviewPreset::STORAGE_LOCATION,
                ]),
            ],
            'value' => [
                'required',
                'string',
                "max:{$maxLength}",
                Rule::unique('review_presets', 'value')
                    ->where(fn ($query) => $query->where('type', $type))
                    ->ignore($reviewPreset?->id),
            ],
        ];
    }

    private function audit(
        Request $request,
        string $action,
        ReviewPreset $preset
    ): void {
        $this->auditType($request, $action, $preset->type);
    }

    private function auditType(
        Request $request,
        string $action,
        string $type
    ): void {
        $label = $type === ReviewPreset::STORAGE_LOCATION
            ? 'storage location'
            : 'review remark';
        $verb = match ($action) {
            'review_preset.created' => 'Created',
            'review_preset.updated' => 'Updated',
            'review_preset.deleted' => 'Deleted',
            default => 'Changed',
        };

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => $action,
            'description' => "{$verb} {$label} preset.",
            'ip_address' => $request->ip(),
        ]);
    }
}
