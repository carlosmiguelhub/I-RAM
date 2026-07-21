<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DocumentRequest;
use App\Models\Record;
use App\Services\InAppNotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DocumentRequestController extends Controller
{
    public function __construct(
        private readonly InAppNotificationService $notifications
    ) {}

    private function roleName(Request $request): string
    {
        return $request->user()->role?->name ?? '';
    }

    private function canManageRequests(Request $request): bool
    {
        return in_array(
            $this->roleName($request),
            ['Admin', 'Records Officer'],
            true
        );
    }

    private function requestRelations(): array
    {
        return [
            'record.category',
            'record.department',
            'record.archiveFolder',
            'record.files',
            'requester.role',
            'requester.department',
            'assignee.role',
        ];
    }

    private function audit(
        Request $request,
        Record $record,
        string $action,
        string $description
    ): void {
        AuditLog::create([
            'user_id' => $request->user()->id,
            'record_id' => $record->id,
            'action' => $action,
            'description' => $description,
            'ip_address' => $request->ip(),
        ]);
    }

    private function requesterHasDocumentAccess(
        DocumentRequest $documentRequest
    ): bool {
        return in_array(
            $documentRequest->status,
            ['approved', 'ready_for_pickup', 'released'],
            true
        ) && (
            $documentRequest->expires_at === null
            || $documentRequest->expires_at->isFuture()
        );
    }

    private function hideFilesWithoutAccess(
        Request $request,
        DocumentRequest $documentRequest
    ): void {
        if (
            ! $this->canManageRequests($request)
            && ! $this->requesterHasDocumentAccess($documentRequest)
        ) {
            $documentRequest->record?->unsetRelation('files');
        }
    }

    public function catalog(Request $request)
    {
        $query = Record::query()
            ->with([
                'category',
                'department',
                'archiveFolder',
                'archiver',
            ])
            ->where('status', 'archived')
            ->where('staff_visible', true)
            ->whereIn('access_level', [
                'internal',
                'restricted',
            ]);

        if ($request->filled('search')) {
            $search = trim((string) $request->search);

            $query->where(function ($query) use ($search) {
                $query
                    ->where(
                        'record_code',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhere(
                        'title',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhere(
                        'description',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhere(
                        'source',
                        'like',
                        "%{$search}%"
                    );
            });
        }

        if ($request->filled('category_id')) {
            $query->where(
                'category_id',
                $request->category_id
            );
        }

        if ($request->filled('department_id')) {
            $query->where(
                'department_id',
                $request->department_id
            );
        }

        if ($request->filled('access_level')) {
            $allowedLevels = [
                'internal',
                'restricted',
            ];

            if (! in_array(
                $request->access_level,
                $allowedLevels,
                true
            )) {
                return response()->json([
                    'message' => 'Invalid access level.',
                ], 422);
            }

            $query->where(
                'access_level',
                $request->access_level
            );
        }

        return response()->json(
            $query
                ->latest('archived_at')
                ->paginate(12)
        );
    }

    public function index(Request $request)
    {
        $query = DocumentRequest::query()
            ->with($this->requestRelations());

        if ($this->canManageRequests($request)) {
            if ($request->filled('status')) {
                $query->where(
                    'status',
                    $request->status
                );
            }

            if ($request->filled('requested_by')) {
                $query->where(
                    'requested_by',
                    $request->requested_by
                );
            }
        } else {
            $query->where(
                'requested_by',
                $request->user()->id
            );

            if ($request->filled('status')) {
                $query->where(
                    'status',
                    $request->status
                );
            }
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);

            $query->whereHas(
                'record',
                function ($recordQuery) use ($search) {
                    $recordQuery
                        ->where(
                            'record_code',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'title',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        $requests = $query->latest()->paginate(10);

        $requests->getCollection()->each(
            fn (DocumentRequest $documentRequest) => $this->hideFilesWithoutAccess(
                $request,
                $documentRequest
            )
        );

        return response()->json($requests);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'record_id' => [
                'required',
                'exists:records,id',
            ],
            'purpose' => [
                'required',
                'string',
                'max:1000',
            ],
            'urgency' => [
                'required',
                'in:normal,urgent',
            ],
            'preferred_format' => [
                'required',
                'in:digital,printed,view_only',
            ],
            'request_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $record = Record::findOrFail(
            $validated['record_id']
        );

        if ($record->status !== 'archived') {
            return response()->json([
                'message' => 'Only archived records may be requested.',
            ], 422);
        }

        if (
            ! $record->staff_visible
            || $record->access_level === 'confidential'
        ) {
            return response()->json([
                'message' => 'This record is not available for staff requests.',
            ], 403);
        }

        $existingRequest = DocumentRequest::query()
            ->where('record_id', $record->id)
            ->where(
                'requested_by',
                $request->user()->id
            )
            ->whereIn('status', [
                'pending',
                'under_review',
                'approved',
                'ready_for_pickup',
            ])
            ->exists();

        if ($existingRequest) {
            return response()->json([
                'message' => 'You already have an active request for this record.',
            ], 422);
        }

        $documentRequest = DB::transaction(
            function () use (
                $request,
                $record,
                $validated
            ) {
                $documentRequest =
                    DocumentRequest::create([
                        'record_id' => $record->id,
                        'requested_by' => $request->user()->id,
                        'purpose' => $validated['purpose'],
                        'urgency' => $validated['urgency'],
                        'preferred_format' => $validated['preferred_format'],
                        'request_notes' => $validated['request_notes']
                            ?? null,
                        'status' => 'pending',
                    ]);

                $this->audit(
                    $request,
                    $record,
                    'created_document_request',
                    "Requested access to archived record: {$record->record_code}"
                );

                return $documentRequest;
            }
        );

        $this->notifications->notifyManagers(
            $request->user(),
            'New document request',
            "{$request->user()->name} requested {$record->record_code}: {$record->title}.",
            'document_request.submitted',
            '/document-requests?status=pending',
            [
                'record_id' => $record->id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Document request submitted successfully.',
            'request' => $documentRequest->load(
                $this->requestRelations()
            ),
        ], 201);
    }

    public function show(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (
            ! $this->canManageRequests($request)
            && (int) $documentRequest->requested_by
                !== (int) $request->user()->id
        ) {
            return response()->json([
                'message' => 'You are not allowed to view this request.',
            ], 403);
        }

        $documentRequest->load($this->requestRelations());
        $this->hideFilesWithoutAccess($request, $documentRequest);

        return response()->json([
            'request' => $documentRequest,
        ]);
    }

    public function startReview(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (! $this->canManageRequests($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may review requests.',
            ], 403);
        }

        if ($documentRequest->status !== 'pending') {
            return response()->json([
                'message' => 'Only pending requests can be placed under review.',
            ], 422);
        }

        $documentRequest->update([
            'status' => 'under_review',
            'assigned_to' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        $this->audit(
            $request,
            $documentRequest->record,
            'started_document_request_review',
            "Started reviewing request for record: {$documentRequest->record->record_code}"
        );

        $this->notifications->notifyUser(
            $documentRequest->requester,
            $request->user(),
            'Document request under review',
            "Your request for {$documentRequest->record->record_code} is being reviewed.",
            'document_request.review_started',
            '/document-requests?status=under_review',
            [
                'record_id' => $documentRequest->record_id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Document request is now under review.',
            'request' => $documentRequest
                ->fresh()
                ->load($this->requestRelations()),
        ]);
    }

    public function approve(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (! $this->canManageRequests($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may approve requests.',
            ], 403);
        }

        if (! in_array(
            $documentRequest->status,
            ['pending', 'under_review'],
            true
        )) {
            return response()->json([
                'message' => 'This request cannot be approved in its current status.',
            ], 422);
        }

        $validated = $request->validate([
            'review_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
            'expires_at' => [
                'nullable',
                'date',
                'after:now',
            ],
        ]);

        $documentRequest->update([
            'status' => 'approved',
            'assigned_to' => $request->user()->id,
            'review_notes' => $validated['review_notes'] ?? null,
            'reviewed_at' => now(),
            'approved_at' => now(),
            'rejected_at' => null,
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        $this->audit(
            $request,
            $documentRequest->record,
            'approved_document_request',
            "Approved request for record: {$documentRequest->record->record_code}"
        );

        $this->notifications->notifyUser(
            $documentRequest->requester,
            $request->user(),
            'Document request approved',
            "Your request for {$documentRequest->record->record_code} was approved.",
            'document_request.approved',
            '/document-requests?status=approved',
            [
                'record_id' => $documentRequest->record_id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Document request approved successfully.',
            'request' => $documentRequest
                ->fresh()
                ->load($this->requestRelations()),
        ]);
    }

    public function reject(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (! $this->canManageRequests($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may reject requests.',
            ], 403);
        }

        if (! in_array(
            $documentRequest->status,
            ['pending', 'under_review'],
            true
        )) {
            return response()->json([
                'message' => 'This request cannot be rejected in its current status.',
            ], 422);
        }

        $validated = $request->validate([
            'review_notes' => [
                'required',
                'string',
                'max:5000',
            ],
        ]);

        $documentRequest->update([
            'status' => 'rejected',
            'assigned_to' => $request->user()->id,
            'review_notes' => $validated['review_notes'],
            'reviewed_at' => now(),
            'rejected_at' => now(),
            'approved_at' => null,
            'expires_at' => null,
        ]);

        $this->audit(
            $request,
            $documentRequest->record,
            'rejected_document_request',
            "Rejected request for record: {$documentRequest->record->record_code}"
        );

        $this->notifications->notifyUser(
            $documentRequest->requester,
            $request->user(),
            'Document request rejected',
            "Your request for {$documentRequest->record->record_code} was rejected.",
            'document_request.rejected',
            '/document-requests?status=rejected',
            [
                'record_id' => $documentRequest->record_id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Document request rejected.',
            'request' => $documentRequest
                ->fresh()
                ->load($this->requestRelations()),
        ]);
    }

    public function release(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (! $this->canManageRequests($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may release documents.',
            ], 403);
        }

        $requiredStatus = $documentRequest->preferred_format === 'printed'
            ? 'ready_for_pickup'
            : 'approved';

        if ($documentRequest->status !== $requiredStatus) {
            return response()->json([
                'message' => $documentRequest->preferred_format === 'printed'
                    ? 'A printed document must be marked ready for pickup before it can be released.'
                    : 'Only approved requests can be released.',
            ], 422);
        }

        $validated = $request->validate([
            'review_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $documentRequest->update([
            'status' => 'released',
            'assigned_to' => $request->user()->id,
            'review_notes' => $validated['review_notes']
                ?? $documentRequest->review_notes,
            'released_at' => now(),
        ]);

        $this->audit(
            $request,
            $documentRequest->record,
            'released_requested_document',
            "Released requested record: {$documentRequest->record->record_code}"
        );

        $this->notifications->notifyUser(
            $documentRequest->requester,
            $request->user(),
            'Document request completed',
            "The requested document {$documentRequest->record->record_code} was released to you.",
            'document_request.released',
            '/document-requests?status=released',
            [
                'record_id' => $documentRequest->record_id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Requested document marked as released.',
            'request' => $documentRequest
                ->fresh()
                ->load($this->requestRelations()),
        ]);
    }

    public function readyForPickup(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (! $this->canManageRequests($request)) {
            return response()->json([
                'message' => 'Only an Administrator or Records Officer may prepare documents for pickup.',
            ], 403);
        }

        if (
            $documentRequest->preferred_format !== 'printed'
            || $documentRequest->status !== 'approved'
        ) {
            return response()->json([
                'message' => 'Only approved printed requests can be marked ready for pickup.',
            ], 422);
        }

        $validated = $request->validate([
            'review_notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $documentRequest->update([
            'status' => 'ready_for_pickup',
            'assigned_to' => $request->user()->id,
            'review_notes' => $validated['review_notes']
                ?? $documentRequest->review_notes,
            'ready_for_pickup_at' => now(),
        ]);

        $this->audit(
            $request,
            $documentRequest->record,
            'prepared_requested_document_for_pickup',
            "Prepared requested record for pickup: {$documentRequest->record->record_code}"
        );

        $this->notifications->notifyUser(
            $documentRequest->requester,
            $request->user(),
            'Document ready for pickup',
            "Your printed copy of {$documentRequest->record->record_code} is ready for pickup.",
            'document_request.ready_for_pickup',
            '/document-requests?status=ready_for_pickup',
            [
                'record_id' => $documentRequest->record_id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Printed document marked ready for pickup.',
            'request' => $documentRequest
                ->fresh()
                ->load($this->requestRelations()),
        ]);
    }

    public function cancel(
        Request $request,
        DocumentRequest $documentRequest
    ) {
        if (
            (int) $documentRequest->requested_by
                !== (int) $request->user()->id
        ) {
            return response()->json([
                'message' => 'You may only cancel your own request.',
            ], 403);
        }

        if (! in_array(
            $documentRequest->status,
            ['pending', 'under_review'],
            true
        )) {
            return response()->json([
                'message' => 'This request can no longer be cancelled.',
            ], 422);
        }

        $documentRequest->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);

        $this->audit(
            $request,
            $documentRequest->record,
            'cancelled_document_request',
            "Cancelled request for record: {$documentRequest->record->record_code}"
        );

        $this->notifications->notifyManagers(
            $request->user(),
            'Document request cancelled',
            "{$request->user()->name} cancelled the request for {$documentRequest->record->record_code}.",
            'document_request.cancelled',
            '/document-requests?status=cancelled',
            [
                'record_id' => $documentRequest->record_id,
                'document_request_id' => $documentRequest->id,
            ]
        );

        return response()->json([
            'message' => 'Document request cancelled.',
            'request' => $documentRequest
                ->fresh()
                ->load($this->requestRelations()),
        ]);
    }
}
