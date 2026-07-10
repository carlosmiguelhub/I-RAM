<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemSetting extends Model
{
    protected $fillable = [
        'group',
        'key',
        'value',
        'type',
        'is_public',
    ];

    protected function casts(): array
    {
        return [
            'is_public' => 'boolean',
        ];
    }

    public function getTypedValueAttribute(): mixed
    {
        return match ($this->type) {
            'boolean' => filter_var(
                $this->value,
                FILTER_VALIDATE_BOOLEAN
            ),

            'integer' => (int) $this->value,

            'float' => (float) $this->value,

            'array', 'json' => json_decode(
                $this->value ?? '[]',
                true
            ) ?? [],

            default => $this->value,
        };
    }

    public static function getValue(
        string $key,
        mixed $default = null
    ): mixed {
        $setting = static::where('key', $key)->first();

        return $setting
            ? $setting->typed_value
            : $default;
    }

    public static function setValue(
        string $group,
        string $key,
        mixed $value,
        string $type = 'string',
        bool $isPublic = false
    ): self {
        $storedValue = match ($type) {
            'boolean' => $value ? 'true' : 'false',
            'array', 'json' => json_encode(array_values($value ?? [])),
            default => (string) $value,
        };

        return static::updateOrCreate(
            ['key' => $key],
            [
                'group' => $group,
                'value' => $storedValue,
                'type' => $type,
                'is_public' => $isPublic,
            ]
        );
    }
}