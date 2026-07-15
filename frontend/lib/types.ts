export type AuthUser = {
  id: number;
  name: string;
  email?: string | null;
  status?: string | null;
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
