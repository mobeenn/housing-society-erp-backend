/* Manual Phase 9 acceptance check. Run with the backend listening on :5000. */
async function api(path, options = {}) {
  const response = await fetch(`http://localhost:5000/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

function accessModules(grid) {
  return grid.data.modules.map((module) => ({
    key: module.key,
    isVisible: module.isVisible,
    actions: module.actions,
  }));
}

async function run() {
  const adminLogin = await api("/auth/login", {
    method: "POST",
    body: { email: "admin@housing-society.local", password: "SuperAdmin@123" },
  });
  if (!adminLogin.ok) throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  const adminToken = adminLogin.data.data.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  const catalog = await api("/permissions/catalog", { headers: adminHeaders });
  if (!catalog.ok || !Array.isArray(catalog.data.data.modules) || catalog.data.data.actions.length !== 10) {
    throw new Error("Dynamic module/action catalog is not available");
  }

  const adminAccess = await api("/rbac/my-access", { headers: adminHeaders });
  if (!adminAccess.ok || adminAccess.data.data.isSuperAdmin !== true || adminAccess.data.data.modules.length < 30) {
    throw new Error("Super Admin effective access is incomplete");
  }

  const rolesResponse = await api("/roles", { headers: adminHeaders });
  const receptionist = rolesResponse.data.data.find((role) => role.name === "Receptionist");
  if (!receptionist) throw new Error("Receptionist role not found");

  const originalGrid = await api(`/rbac/roles/${receptionist._id}/access`, { headers: adminHeaders });
  if (!originalGrid.ok) throw new Error("Could not read Receptionist access grid");
  const originalModules = accessModules(originalGrid.data);

  const email = "receptionist.demo@housing.local";
  const userLogin = await api("/auth/login", {
    method: "POST",
    body: { email, password: "DemoRole@123" },
  });
  if (!userLogin.ok) throw new Error(`Receptionist demo login failed: ${JSON.stringify(userLogin.data)}`);
  const userHeaders = { Authorization: `Bearer ${userLogin.data.data.accessToken}` };

  const enabled = structuredClone(originalModules);
  const enabledFinance = enabled.find((module) => module.key === "payments");
  enabledFinance.isVisible = true;
  enabledFinance.actions.view = true;
  const enableResponse = await api(`/rbac/roles/${receptionist._id}/access`, {
    method: "PUT",
    headers: adminHeaders,
    body: { modules: enabled },
  });
  if (!enableResponse.ok) throw new Error("Could not enable Finance access");
  const enabledAccess = await api("/rbac/my-access", { headers: userHeaders });
  if (!enabledAccess.data.data.modules.find((module) => module.key === "payments")?.isVisible) {
    throw new Error("Finance did not become visible after PUT");
  }
  const allowedPayment = await api("/payments?limit=1", { headers: userHeaders });
  if (allowedPayment.status !== 200) throw new Error(`Expected Finance API 200, got ${allowedPayment.status}`);

  const disabled = structuredClone(enabled);
  const disabledFinance = disabled.find((module) => module.key === "payments");
  disabledFinance.isVisible = false;
  disabledFinance.actions.view = false;
  const disableResponse = await api(`/rbac/roles/${receptionist._id}/access`, {
    method: "PUT",
    headers: adminHeaders,
    body: { modules: disabled },
  });
  if (!disableResponse.ok) throw new Error("Could not disable Finance access");
  const disabledAccess = await api("/rbac/my-access", { headers: userHeaders });
  if (disabledAccess.data.data.modules.find((module) => module.key === "payments")?.isVisible) {
    throw new Error("Finance remained visible after PUT");
  }
  const blockedPayment = await api("/payments?limit=1", { headers: userHeaders });
  if (blockedPayment.status !== 403) throw new Error(`Expected Finance API 403, got ${blockedPayment.status}`);
  const allowedMembers = await api("/members?limit=1", { headers: userHeaders });
  if (allowedMembers.status !== 200) throw new Error(`Expected Members API 200, got ${allowedMembers.status}`);

  const nonSuperGrid = await api(`/rbac/roles/${receptionist._id}/access`, { headers: userHeaders });
  if (nonSuperGrid.status !== 403) throw new Error(`Expected non-Super Admin grid read 403, got ${nonSuperGrid.status}`);

  // Always restore the role's original grid, even after a failed assertion.
  await api(`/rbac/roles/${receptionist._id}/access`, {
    method: "PUT",
    headers: adminHeaders,
    body: { modules: originalModules },
  });
  console.log("PASS: dynamic RBAC migration, effective access, grid update, sidebar/API visibility, and Super Admin boundary verified.");
}

run().catch((error) => {
  console.error("FAIL:", error.message);
  process.exitCode = 1;
});
