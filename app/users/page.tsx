"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Shield, Trash2, Users as UsersIcon, XCircle } from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useUserRole } from "@/lib/use-role";
import type { CustomerSummary } from "@/types/customer";

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  status: "active" | "pending" | "rejected";
  createdAt: string;
  customers: Array<{ id: string; name: string }>;
};

export default function UsersPage() {
  const { isAdmin } = useUserRole();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<ManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<"editor" | "viewer">("viewer");
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const [usersResponse, customersResponse] = await Promise.all([
      fetch("/api/users"),
      fetch("/api/customers"),
    ]);

    const usersJson = await usersResponse.json();
    const customersJson = await customersResponse.json();

    if (!usersResponse.ok) {
      throw new Error(usersJson.error || "Failed to load users");
    }
    if (!customersResponse.ok) {
      throw new Error(customersJson.error || "Failed to load customers");
    }

    setUsers(usersJson.data ?? []);
    setCustomers(customersJson);
  }

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          setError(error instanceof Error ? error.message : "Failed to load admin data");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingCount = useMemo(
    () => users.filter((user) => user.status === "pending").length,
    [users],
  );

  function openApproveModal(user: ManagedUser) {
    setSelectedUser(user);
    setSelectedRole(user.role === "admin" ? "editor" : user.role === "viewer" ? "viewer" : "editor");
    setSelectedCustomerIds(user.customers.map((customer) => customer.id));
    setMessage(null);
    setError(null);
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setError(null);
    setMessage(null);

    const response = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Failed to update user");
    }

    await loadData();
    return json as { notified?: boolean };
  }

  async function handleApprove() {
    if (!selectedUser) return;

    try {
      const result = await patchUser(selectedUser.id, {
        role: selectedRole,
        status: "active",
        customerIds: selectedCustomerIds,
      });

      setSelectedUser(null);
      setMessage(
        result.notified
          ? "User approved and notified by email."
          : "User approved.",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to approve user");
    }
  }

  async function handleReject(user: ManagedUser) {
    try {
      await patchUser(user.id, { status: "rejected" });
      setMessage("User rejected.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to reject user");
    }
  }

  async function handleDelete(user: ManagedUser) {
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to delete user");
      }

      await loadData();
      setMessage("User deleted.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to delete user");
    }
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="text-center">
            <p className="text-2xl font-black uppercase tracking-tight">Admin Only</p>
            <p className="mt-2 text-sm text-muted">
              You do not have permission to manage users.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout searchPlaceholder="Search users or assigned customers...">
      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Admin</p>
            <h1 className="text-3xl font-black uppercase tracking-tight">User Management</h1>
            <p className="mt-1 text-sm text-muted">
              Approve access, assign customer visibility, and manage roles.
            </p>
          </div>
          <div className="badge badge-warning">
            {pendingCount} pending
          </div>
        </div>

        {message ? <p className="mb-4 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mb-4 text-sm text-[var(--danger)]">{error}</p> : null}

        <div className="card-elevated overflow-hidden">
          <div className="border-b border-[var(--line)] px-6 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wider">All Users</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-1">
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    User
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Role
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Status
                  </th>
                  <th className="px-6 py-3.5 text-[11px] font-bold uppercase tracking-widest text-muted">
                    Customers
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-bold uppercase tracking-widest text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {isLoading ? (
                  <tr>
                    <td className="px-6 py-8 text-sm text-muted" colSpan={5}>
                      Loading users...
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const immutable = user.email === "austinm.altman@gmail.com";

                    return (
                      <tr key={user.id}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold">{user.name || "No Name"}</p>
                              <p className="text-xs text-muted">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="badge badge-muted inline-flex items-center gap-1.5">
                            {user.role === "admin" ? <Shield className="size-3" /> : null}
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`badge ${
                              user.status === "active"
                                ? "badge-success"
                                : user.status === "pending"
                                  ? "badge-warning"
                                  : "badge-muted"
                            }`}
                          >
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {user.customers.length === 0 ? (
                              <span className="text-xs text-muted">No assigned customers</span>
                            ) : (
                              user.customers.map((customer) => (
                                <span key={customer.id} className="badge badge-primary">
                                  {customer.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {user.status === "pending" ? (
                              <>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={immutable}
                                  onClick={() => openApproveModal(user)}
                                >
                                  <CheckCircle2 className="size-4" /> Approve
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={immutable}
                                  onClick={() => {
                                    void handleReject(user);
                                  }}
                                >
                                  <XCircle className="size-4" /> Reject
                                </button>
                              </>
                            ) : null}
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={immutable}
                              onClick={() => {
                                void handleDelete(user);
                              }}
                            >
                              <Trash2 className="size-4" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedUser ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-[var(--line)] bg-surface-0 p-6 shadow-[var(--shadow-lg)]">
              <div className="mb-6">
                <p className="eyebrow mb-2">Approve User</p>
                <h2 className="text-2xl font-black uppercase tracking-tight">
                  {selectedUser.name || selectedUser.email}
                </h2>
                <p className="mt-1 text-sm text-muted">{selectedUser.email}</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
                    Role
                  </label>
                  <select
                    className="input"
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as "editor" | "viewer")}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">
                    Customer Access
                  </label>
                  <div className="grid gap-2 rounded-xl border border-[var(--line)] p-3">
                    {customers.map((customer) => {
                      const checked = selectedCustomerIds.includes(customer.id);
                      return (
                        <label key={customer.id} className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedCustomerIds((current) =>
                                event.target.checked
                                  ? [...current, customer.id]
                                  : current.filter((id) => id !== customer.id),
                              );
                            }}
                          />
                          <span>{customer.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={() => void handleApprove()}>
                  <UsersIcon className="size-4" /> Approve User
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
