// Kleiner API-Wrapper. Cookies (Session) werden mitgesendet.

async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  me: () => request("/api/me"),
  login: (password) =>
    request("/api/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request("/api/logout", { method: "POST" }),

  listProjects: () => request("/api/admin/projects"),
  createProject: (name, active = true) =>
    request("/api/admin/projects", {
      method: "POST",
      body: JSON.stringify({ name, active }),
    }),
  updateProject: (id, patch) =>
    request(`/api/admin/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),

  oauthStatus: () => request("/api/oauth/status"),

  report: (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set("date_from", from);
    if (to) params.set("date_to", to);
    return request(`/api/report?${params.toString()}`);
  },
};
