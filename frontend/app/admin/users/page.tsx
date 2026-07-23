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
  email_verified_at?: string | null;
  activated_at?: string | null;
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
  const [currentUser, setCurrentUser] = useState<ManagedUser | null>(null);

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
  const isAdmin = currentUser?.role?.name === "Admin";

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
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#075A3A] via-[#064D33] to-[#043D28] px-5 py-6 text-white shadow-xl shadow-[#075A3A]/20 sm:px-7 sm:py-7">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D9961A]/15 blur-2xl" />
          <div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-[#6B0F2B]/30 blur-3xl" />

          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#F4C25E]">
                Administration
              </p>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
                User Management
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#E5DDCC]">
                {isAdmin
                  ? "Create accounts, assign roles and departments, control access, and reset passwords."
                  : "Review and activate verified Staff accounts from your department."}
              </p>
            </div>

            {isAdmin && <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center justify-center rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[#571023] focus:outline-none focus:ring-4 focus:ring-[#D9961A]/30"
            >
              + Create User
            </button>}
          </div>
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

        <section className="relative mt-6 overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#DED5C5] sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-[#D9961A]" />
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
              className="rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-sm outline-none focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC] md:col-span-2"
            />

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
              className="rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-sm outline-none"
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
              className="rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-4 py-3 text-sm outline-none"
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
                className="min-w-0 flex-1 rounded-xl border border-[#E3DCCE] bg-[#F8F5EE] px-3 py-3 text-sm outline-none"
              >
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">
                  Inactive
                </option>
              </select>

              <button
                className="rounded-xl bg-[#075A3A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#043D28]"
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
                className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-[#DED5C5]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#2D332F]">
                      {user.name}
                    </p>
                    <p className="mt-1 truncate text-sm text-[#766F63]">
                      {user.email}
                    </p>
                  </div>
                  <StatusBadge user={user} />
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
                  canAdminister={isAdmin}
                />
              </article>
            ))}
        </section>

        <section className="relative mt-5 hidden overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#DED5C5] md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left text-sm">
              <thead className="bg-[#F7F3EA] text-xs uppercase tracking-wide text-[#817766]">
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

              <tbody className="divide-y divide-[#ECE5D8]">
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-[#766F63]"
                    >
                      Loading users...
                    </td>
                  </tr>
                )}

                {!loading && users.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-8 text-center text-[#766F63]"
                    >
                      No users found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-[#F8F5EE]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-bold text-[#2D332F]">
                          {user.name}
                        </p>
                        <p className="mt-1 text-xs text-[#766F63]">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-[#625E56]">
                        {user.role?.name || "N/A"}
                      </td>
                      <td className="px-5 py-4 text-[#625E56]">
                        {user.department?.name ||
                          "N/A"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge user={user} />
                      </td>
                      <td className="px-5 py-4 text-[#625E56]">
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
                          canAdminister={isAdmin}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#6B0F2B]/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !submitting
            ) {
              closeModal();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-[#DED5C5]">
            <header className="flex items-start justify-between border-b border-[#E3DCCE] px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D9961A]">
                  {isAdmin ? "Administrator Action" : "Account Approval"}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#252A27]">
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
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0ECE4] text-xl text-[#625E56]"
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
                    className="rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 transition hover:-translate-y-0.5 hover:bg-[#571023] disabled:opacity-60"
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
                  <p className="text-sm leading-6 text-[#625E56]">
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
                    className="rounded-xl bg-[#6B0F2B] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[#6B0F2B]/20 disabled:opacity-60"
                  >
                    {submitting
                      ? "Resetting..."
                      : "Reset Password"}
                  </button>
                </form>
              )}

              {modalMode === "status" && (
                <div>
                  <p className="text-sm leading-6 text-[#625E56]">
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
                      className="rounded-xl border border-[#E3DCCE] px-5 py-3 text-sm font-semibold text-[#514D46]"
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
  "mt-2 w-full rounded-xl border border-[#E3DCCE] bg-[#FCFAF5] px-4 py-3 text-sm text-[#2D332F] outline-none transition focus:border-[#075A3A] focus:bg-white focus:ring-4 focus:ring-[#E6F2EC]";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-semibold text-[#514D46]">
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
  canAdminister,
}: {
  user: ManagedUser;
  currentUserId?: number;
  onEdit: () => void;
  onPassword: () => void;
  onStatus: () => void;
  canAdminister: boolean;
}) {
  const isSelf = user.id === currentUserId;
  const awaitingEmailVerification =
    user.status === "inactive" && !user.email_verified_at;
  const statusDisabled = isSelf || awaitingEmailVerification;

  return (
    <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
      {canAdminister && <button
        type="button"
        onClick={onEdit}
        className="rounded-lg bg-[#F0F7F3] px-3 py-2 text-xs font-semibold text-[#075A3A] ring-1 ring-[#CFE0D6] hover:bg-[#E6F2EC]"
      >
        Edit
      </button>}

      {canAdminister && <button
        type="button"
        onClick={onPassword}
        className="rounded-lg bg-[#F0ECE4] px-3 py-2 text-xs font-semibold text-[#514D46] hover:bg-[#E3DCCE]"
      >
        Reset Password
      </button>}

      <button
        type="button"
        onClick={onStatus}
        disabled={statusDisabled}
        title={
          isSelf
            ? "You cannot deactivate your own account."
            : awaitingEmailVerification
              ? "The user must verify their email before activation."
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
  user,
}: {
  user: ManagedUser;
}) {
  const label = user.status === "active"
    ? "Active"
    : user.activated_at
      ? "Inactive"
      : "Not activated";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
          user.status === "active"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-[#E3DCCE] text-[#514D46]"
        }`}
      >
        {label}
      </span>
      {!user.email_verified_at && (
        <span className="text-[10px] font-semibold text-amber-700">Email unverified</span>
      )}
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
      <span className="text-[#A09582]">
        {label}
      </span>
      <span className="truncate font-medium text-[#514D46]">
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 text-sm text-[#766F63] shadow-sm ring-1 ring-[#DED5C5]">
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
