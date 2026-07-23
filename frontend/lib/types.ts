export type AuthUser = {
  id: number;
  name: string;
  email?: string | null;
  status?: string | null;
  email_verified_at?: string | null;
  activated_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  role?: {
    id?: number;
    name?: string | null;
  } | null;
  department?: {
    id?: number;
    name?: string | null;
  } | null;
};

export function getErrorMessage(
  error: unknown,
  fallback: string
): string {
  return error instanceof Error && error.message
    ? error.message
    : fallback;
}
