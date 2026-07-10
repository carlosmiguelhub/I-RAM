"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { apiRequest } from "@/lib/api";

type Option = {
  id: number;
  name: string;
};

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  created_at: string;
  role?: Option | null;
  department?: Option | null;
};

type UserForm = {
  name: string;
  email: string;
  role_id: string;
  department_id: string;
  status: "active" | "inactive";
  password: string;
  password_confirmation: string;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  role_id: "",
  department_id: "",
  status: "active",
  password: "",
  password_confirmation: "",
};

export default function UserManagementPage() {
  const router = useRouter();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalMode, setModalMode] = useState<
    "create" | "edit" | "password" | "status" | null
  >(null);
  const [selectedUser, setSelectedUser] =
    useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedRole = useMemo(
    () =>
      roles.find(
        (role) => String(role.id) === form.role_id
      ),
    [roles, form.role_id]
  );

  const departmentRequired =
    selectedRole?.name === "Staff" ||
    selectedRole?.name === "Records Officer";

  async function loadUsers() {
    setLoading(true);
    setPageError("");

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (roleFilter) {
        params.set("role_id", roleFilter);
      }

      if (departmentFilter) {
        params.set("department_id", departmentFilter);
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const query = params.toString();
      const data = await apiRequest(
        query
          ? `/admin/users?${query}`
          : "/admin/users"
      );

      setUsers(data.data || []);
    } catch (error: unknown) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Failed to load users."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    async function initialize() {
      try {
        const [meData, optionsData] =
          await Promise.all([
            apiRequest("/me"),
            apiRequest("/options"),
          ]);

        if (meData.user?.role?.name !== "Admin") {
          router.replace("/dashboard");
          return;
        }

        setCurrentUser(meData.user);
        setRoles(optionsData.roles || []);
        setDepartments(optionsData.departments || []);
        await loadUsers();
      } catch {
        router.replace("/login");
      }
    }

    initialize();
  }, [router]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    loadUsers();
  }

  function openCreate() {
    setSelectedUser(null);
    setForm(emptyForm);
    setModalError("");
    setModalMode("create");
  }

  function openEdit(user: ManagedUser) {
    setSelectedUser(user);
    setForm({
      name: user.name,
      email: user.email,
      role_id: user.role
        ? String(user.role.id)
        : "",
      department_id: user.department
        ? String(user.department.id)
        : "",
      status: user.status,
      password: "",
      password_confirmation: "",
    });
    setModalError("");
    setModalMode("edit");
  }

  function openPassword(user: ManagedUser) {
    setSelectedUser(user);
    setForm({
      ...emptyForm,
      password: "",
      password_confirmation: "",
    });
    setModalError("");
    setModalMode("password");
  }

  function openStatus(user: ManagedUser) {
    setSelectedUser(user);
    setModalError("");
    setModalMode("status");
  }

  function closeModal() {
    if (submitting) return;

    setModalMode(null);
    setSelectedUser(null);
    setModalError("");
    setForm(emptyForm);
  }

  function updateForm(
    field: keyof UserForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submitUser(event: React.FormEvent) {
    event.preventDefault();
    setModalError("");

    if (
      departmentRequired &&
      !form.department_id
    ) {
      setModalError(
        "A department is required for Staff and Records Officer accounts."
      );
      return;
    }

    setSubmitting(true);

    try {
      const editing = modalMode === "edit";
      const endpoint = editing
        ? `/admin/users/${selectedUser?.id}`
        : "/admin/users";

      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role_id: Number(form.role_id),
        department_id: form.department_id
          ? Number(form.department_id)
          : null,
      };

      if (!editing) {
        body.status = form.status;
        body.password = form.password;
        body.password_confirmation =
          form.password_confirmation;
      }

      const data = await apiRequest(endpoint, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });

      setSuccess(data.message);
      setModalMode(null);
      setSelectedUser(null);
      setModalError("");
      setForm(emptyForm);
      await loadUsers();
    } catch (error: unknown) {
      setModalError(
        error instanceof Error
          ? error.message
          : "Unable to save user."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPassword(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!selectedUser) return;

    setSubmitting(true);
    setModalError("");

    try {
      const data = await apiRequest(
        `/admin/users/${selectedUser.id}/password`,
        {
          method: "PATCH",
          body: JSON.stringify({
            password: form.password,
            password_confirmation:
              form.password_confirmation,
          }),
        }
      );

      setSuccess(data.message);
      setModalMode(null);
      setSelectedUser(null);
      setModalError("");
      setForm(emptyForm);
    } catch (error: unknown) {
      setModalError(
        error instanceof Error
          ? error.message
          : "Unable to reset password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStatus() {
    if (!selectedUser) return;

    setSubmitting(true);
    setModalError("");

    const nextStatus =
      selectedUser.status === "active"
        ? "inactive"
        : "active";

    try {
      const data = await apiRequest(
        `/admin/users/${selectedUser.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
        }
      );

      setSuccess(data.message);
      setModalMode(null);
      setSelectedUser(null);
      setModalError("");
      setForm(emptyForm);
      await loadUsers();
    } catch (error: unknown) {
      setModalError(
        error instanceof Error
          ? error.message
          : "Unable to update status."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="w-full">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Administration
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
              User Management
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Create accounts, assign roles and departments,
              control access, and reset passwords.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            + Create User
          </button>
        </section>

        {success && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        )}

        {pageError && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {pageError}
          </div>
        )}

        <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <form
            onSubmit={handleSearch}
            className="grid gap-3 md:grid-cols-5"
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name or email..."
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50 md:col-span-2"
            />

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="">All roles</option>
              {roles.map((role) => (
                <option
                  key={role.id}
                  value={role.id}
                >
                  {role.name}
                </option>
              ))}
            </select>

            <select
              value={departmentFilter}
              onChange={(event) =>
                setDepartmentFilter(
                  event.target.value
                )
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option
                  key={department.id}
                  value={department.id}
                >
                  {department.name}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none"
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">
                  Inactive
                </option>
              </select>

              <button
                className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                Search
              </button>
            </div>
          </form>
        </section>

        <section className="mt-5 space-y-3 md:hidden">
          {loading && (
            <EmptyState text="Loading users..." />
          )}

          {!loading && users.length === 0 && (
            <EmptyState text="No users found." />
          )}

          {!loading &&
            users.map((user) => (
              <article
                key={user.id}
                className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">
                      {user.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <StatusBadge
                    status={user.status}
                  />
                </div>

                <div className="mt-4 space-y-2 text-sm">
                  <InfoRow
                    label="Role"
                    value={user.role?.name || "N/A"}
                  />
                  <InfoRow
                    label="Department"
                    value={
                      user.department?.name || "N/A"
                    }
                  />
                  <InfoRow
                    label="Created"
                    value={formatDate(user.created_at)}
                  />
                </div>

                <UserActions
                  user={user}
                  currentUserId={currentUser?.id}
                  onEdit={() => openEdit(user)}
                  onPassword={() =>
                    openPassword(user)
                  }
                  onStatus={() => openStatus(user)}
                />
              </article>
            ))}
        </section>

        <section className="mt-5 hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">
                    Department
                  </th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Created</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-slate-500"
                    >
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-slate-500"
                    >
                      No users found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900">
                          {user.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {user.role?.name || "N/A"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {user.department?.name ||
                          "N/A"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={user.status}
                        />
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <UserActions
                          user={user}
                          currentUserId={
                            currentUser?.id
                          }
                          onEdit={() =>
                            openEdit(user)
                          }
                          onPassword={() =>
                            openPassword(user)
                          }
                          onStatus={() =>
                            openStatus(user)
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !submitting
            ) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <header className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  Administrator Action
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {modalMode === "create" &&
                    "Create User"}
                  {modalMode === "edit" &&
                    "Edit User"}
                  {modalMode === "password" &&
                    "Reset Password"}
                  {modalMode === "status" &&
                    `${
                      selectedUser?.status ===
                      "active"
                        ? "Deactivate"
                        : "Activate"
                    } User`}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-600"
              >
                ×
              </button>
            </header>

            <div className="p-6">
              {modalError && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {modalError}
                </div>
              )}

              {(modalMode === "create" ||
                modalMode === "edit") && (
                <form
                  onSubmit={submitUser}
                  className="grid gap-5"
                >
                  <FormField label="Full Name">
                    <input
                      required
                      value={form.name}
                      onChange={(event) =>
                        updateForm(
                          "name",
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Email Address">
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateForm(
                          "email",
                          event.target.value
                        )
                      }
                      className={inputClass}
                    />
                  </FormField>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Role">
                      <select
                        required
                        value={form.role_id}
                        onChange={(event) =>
                          updateForm(
                            "role_id",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Select role
                        </option>
                        {roles.map((role) => (
                          <option
                            key={role.id}
                            value={role.id}
                          >
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      label={`Department${
                        departmentRequired
                          ? " *"
                          : ""
                      }`}
                    >
                      <select
                        value={form.department_id}
                        onChange={(event) =>
                          updateForm(
                            "department_id",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      >
                        <option value="">
                          No department
                        </option>
                        {departments.map(
                          (department) => (
                            <option
                              key={department.id}
                              value={department.id}
                            >
                              {department.name}
                            </option>
                          )
                        )}
                      </select>
                    </FormField>
                  </div>

                  {modalMode === "create" && (
                    <>
                      <FormField label="Initial Status">
                        <select
                          value={form.status}
                          onChange={(event) =>
                            updateForm(
                              "status",
                              event.target.value
                            )
                          }
                          className={inputClass}
                        >
                          <option value="active">
                            Active
                          </option>
                          <option value="inactive">
                            Inactive
                          </option>
                        </select>
                      </FormField>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField label="Password">
                          <input
                            required
                            type="password"
                            value={form.password}
                            onChange={(event) =>
                              updateForm(
                                "password",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </FormField>

                        <FormField label="Confirm Password">
                          <input
                            required
                            type="password"
                            value={
                              form.password_confirmation
                            }
                            onChange={(event) =>
                              updateForm(
                                "password_confirmation",
                                event.target.value
                              )
                            }
                            className={inputClass}
                          />
                        </FormField>
                      </div>
                    </>
                  )}

                  <button
                    disabled={submitting}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {submitting
                      ? "Saving..."
                      : modalMode === "create"
                      ? "Create User"
                      : "Save Changes"}
                  </button>
                </form>
              )}

              {modalMode === "password" && (
                <form
                  onSubmit={submitPassword}
                  className="grid gap-5"
                >
                  <p className="text-sm leading-6 text-slate-600">
                    Set a new password for{" "}
                    <strong>
                      {selectedUser?.name}
                    </strong>
                    . Their existing sessions will be
                    signed out.
                  </p>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="New Password">
                      <input
                        required
                        type="password"
                        value={form.password}
                        onChange={(event) =>
                          updateForm(
                            "password",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Confirm Password">
                      <input
                        required
                        type="password"
                        value={
                          form.password_confirmation
                        }
                        onChange={(event) =>
                          updateForm(
                            "password_confirmation",
                            event.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </FormField>
                  </div>

                  <button
                    disabled={submitting}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {submitting
                      ? "Resetting..."
                      : "Reset Password"}
                  </button>
                </form>
              )}

              {modalMode === "status" && (
                <div>
                  <p className="text-sm leading-6 text-slate-600">
                    {selectedUser?.status ===
                    "active"
                      ? `Deactivate ${selectedUser.name}? They will be signed out and unable to log in.`
                      : `Activate ${selectedUser?.name}? They will be allowed to log in again.`}
                  </p>

                  <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={submitting}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={submitStatus}
                      disabled={submitting}
                      className={`rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 ${
                        selectedUser?.status ===
                        "active"
                          ? "bg-red-600 hover:bg-red-700"
                          : "bg-emerald-600 hover:bg-emerald-700"
                      }`}
                    >
                      {submitting
                        ? "Processing..."
                        : selectedUser?.status ===
                          "active"
                        ? "Deactivate User"
                        : "Activate User"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      {children}
    </label>
  );
}

function UserActions({
  user,
  currentUserId,
  onEdit,
  onPassword,
  onStatus,
}: {
  user: ManagedUser;
  currentUserId?: number;
  onEdit: () => void;
  onPassword: () => void;
  onStatus: () => void;
}) {
  const isSelf = user.id === currentUserId;

  return (
    <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
      >
        Edit
      </button>

      <button
        type="button"
        onClick={onPassword}
        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
      >
        Reset Password
      </button>

      <button
        type="button"
        onClick={onStatus}
        disabled={isSelf}
        title={
          isSelf
            ? "You cannot deactivate your own account."
            : undefined
        }
        className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
          user.status === "active"
            ? "bg-red-50 text-red-700 hover:bg-red-100"
            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
        }`}
      >
        {user.status === "active"
          ? "Deactivate"
          : "Activate"}
      </button>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: "active" | "inactive";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${
        status === "active"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-200 text-slate-700"
      }`}
    >
      {status}
    </span>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">
        {label}
      </span>
      <span className="truncate font-medium text-slate-700">
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
      {text}
    </div>
  );
}

function formatDate(date: string) {
  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
