"use client";

import { FormEvent, useEffect, useState } from "react";

import { apiFetch } from "../../lib/api";

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "fishbowl123",
    role: "user",
  });

  function loadUsers() {
    apiFetch<{ users: any[] }>("/users").then((data) => setUsers(data.users));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify(form),
    });
    setForm({ full_name: "", email: "", password: "fishbowl123", role: "user" });
    loadUsers();
  }

  return (
    <section className="page">
      <div className="grid twoCol">
        <article className="panel">
          <p className="eyebrow">User Management</p>
          <h2>Create admin and learner accounts</h2>
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
            <button type="submit">Add User</button>
          </form>
        </article>
        <article className="panel">
          <h3>Current Users</h3>
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
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td>{user.full_name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
