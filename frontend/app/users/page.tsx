"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";
import { User, getErrorMessage } from "../../lib/types";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "fishbowl123",
    role: "user",
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch<{ users: User[] }>("/users");
      setUsers(data.users);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ full_name: "", email: "", password: "fishbowl123", role: "user" });
      await loadUsers();
    } catch (createError) {
      setError(getErrorMessage(createError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page">
      <div className="grid twoCol">
        <article className="panel">
          <p className="eyebrow">User Management</p>
          <h2>Create admin and learner accounts</h2>
          {error ? <p className="errorText">{error}</p> : null}
          <form className="formStack" onSubmit={handleCreate}>
            <label>
              Full Name
              <input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
            </label>
            <label>
              Email
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label>
              Password
              <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            <label>
              Role
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <button type="submit" disabled={submitting}>{submitting ? "Adding..." : "Add User"}</button>
          </form>
        </article>
        <article className="panel">
          <h3>Current Users</h3>
          {loading ? <p className="muted">Loading users...</p> : null}
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {users.length ? (
                  users.map((user) => (
                    <tr key={user.user_id}>
                      <td>{user.full_name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No users available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
