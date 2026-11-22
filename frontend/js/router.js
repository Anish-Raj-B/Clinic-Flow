/**
 * History-API router with the same route table, role gates and redirects as the
 * original React Router setup. No framework: each page returns HTML plus an
 * optional mount function.
 */

import { isSupabaseConfigured } from "./config.js";
import {
  getAuth,
  getRole,
  initTheme,
  signOut,
  toast,
} from "./store.js";
import { fullPageLoader, inlineLoader } from "./components.js";
import { getErrorMessage } from "./utils.js";
import { appShell, mountAppShell } from "./layout.js";
import {
  renderForgotPassword,
  renderLogin,
  renderNotFound,
  renderProfileMissing,
  renderResetPassword,
  renderSignup,
  resetAuthState,
} from "./pages/auth.js";
import { renderLanding, mountLanding } from "./pages/landing.js";
import * as customer from "./pages/customer.js";
import * as staff from "./pages/staff.js";
import * as owner from "./pages/owner.js";

const routes = [
  { path: "/", render: () => ({ html: renderLanding(), mount: mountLanding }) },
  { path: "/login", guest: true, render: renderLogin, reset: resetAuthState },
  { path: "/signup", guest: true, render: renderSignup, reset: resetAuthState },
  {
    path: "/forgot-password",
    guest: true,
    render: renderForgotPassword,
    reset: resetAuthState,
  },
  { path: "/reset-password", render: renderResetPassword },
  { path: "/app", render: null },
  {
    path: "/app/dashboard",
    app: true,
    roles: ["staff", "owner"],
    render: staff.renderDashboard,
  },
  {
    path: "/app/book",
    app: true,
    roles: ["customer"],
    render: customer.renderBookAppointment,
  },
  {
    path: "/app/my-appointments",
    app: true,
    roles: ["customer"],
    render: customer.renderMyAppointments,
  },
  {
    path: "/app/invoices",
    app: true,
    roles: ["customer"],
    render: customer.renderMyInvoices,
  },
  {
    path: "/app/appointments",
    app: true,
    roles: ["staff", "owner"],
    render: staff.renderAppointments,
  },
  {
    path: "/app/inventory",
    app: true,
    roles: ["staff", "owner"],
    render: staff.renderInventory,
  },
  {
    path: "/app/billing",
    app: true,
    roles: ["staff", "owner"],
    render: staff.renderBilling,
  },
  {
    path: "/app/services",
    app: true,
    roles: ["owner"],
    render: owner.renderServices,
  },
  {
    path: "/app/staff",
    app: true,
    roles: ["owner"],
    render: owner.renderStaff,
  },
  {
    path: "/app/analytics",
    app: true,
    roles: ["owner"],
    render: owner.renderAnalytics,
  },
  {
    path: "/app/audit-logs",
    app: true,
    roles: ["owner"],
    render: owner.renderAuditLogs,
  },
];

let renderToken = 0;
let currentRoute = null;

function normalisePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState({}, "", path);
  } else if (path !== window.location.pathname + window.location.search) {
    window.history.pushState({}, "", path);
  }
  void render();
}

function buildContext(path, query) {
  return {
    path,
    query,
    navigate,
    rerender: () => render(),
  };
}

function bindProfileMissing(root) {
  const reload = root.querySelector('[data-action="reload"]');
  if (reload) reload.addEventListener("click", () => window.location.reload());
  const out = root.querySelector('[data-action="profile-signout"]');
  if (out) {
    out.addEventListener("click", async () => {
      try {
        await signOut();
        navigate("/login", { replace: true });
      } catch (error) {
        toast.error(getErrorMessage(error, "Could not sign out"));
      }
    });
  }
}

export async function render() {
  const token = ++renderToken;
  const app = document.getElementById("app");
  if (!app) return;

  const banner = document.getElementById("config-banner");
  if (banner) {
    banner.innerHTML = isSupabaseConfigured
      ? ""
      : `<div class="config-banner">Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code> and set SUPABASE_URL and SUPABASE_ANON_KEY.</div>`;
  }

  const path = normalisePath(window.location.pathname);
  const query = new URLSearchParams(window.location.search);
  const auth = getAuth();
  const role = getRole();

  // Leaving a route resets any page-local confirmation state.
  if (currentRoute && currentRoute.path !== path && typeof currentRoute.reset === "function") {
    currentRoute.reset();
  }

  // /app sends each role to its natural landing page.
  if (path === "/app") {
    if (auth.loading) {
      app.innerHTML = fullPageLoader();
      return;
    }
    if (!auth.session) {
      navigate(`/login?next=${encodeURIComponent("/app")}`, { replace: true });
      return;
    }
    navigate(role === "customer" ? "/app/book" : "/app/dashboard", { replace: true });
    return;
  }

  const route = routes.find((item) => item.path === path);
  if (!route) {
    currentRoute = null;
    app.innerHTML = renderNotFound();
    bindLinks(app);
    return;
  }
  currentRoute = route;

  if (route.guest) {
    if (auth.loading) {
      app.innerHTML = fullPageLoader();
      return;
    }
    if (auth.session) {
      navigate("/app", { replace: true });
      return;
    }
  }

  if (route.app) {
    if (auth.loading) {
      app.innerHTML = fullPageLoader();
      return;
    }
    if (!auth.session) {
      navigate(`/login?next=${encodeURIComponent(path)}`, { replace: true });
      return;
    }
    if (!auth.profile) {
      app.innerHTML = renderProfileMissing();
      bindProfileMissing(app);
      return;
    }
    if (route.roles && !route.roles.includes(role)) {
      navigate("/app", { replace: true });
      return;
    }
    app.innerHTML = `<div class="content-loader">${inlineLoader("Loading ClinicFlow")}</div>`;
  }

  const ctx = buildContext(path, query);
  let page;
  try {
    page = await route.render(ctx);
  } catch (error) {
    toast.error(getErrorMessage(error, "Could not load this page"));
    app.innerHTML = appShell({
      path,
      content: `<div class="alert alert-error" role="alert">${getErrorMessage(
        error,
        "Could not load this page",
      )}</div>`,
    });
    mountAppShell(app);
    bindLinks(app);
    return;
  }
  if (token !== renderToken) return;

  if (route.app) {
    app.innerHTML = appShell({ path, content: page.html });
    mountAppShell(app);
  } else {
    app.innerHTML = page.html;
  }

  if (typeof page.mount === "function") {
    page.mount(app);
  }
  bindLinks(app);

  if (route.app || path !== "/") {
    window.scrollTo({ top: 0, behavior: "auto" });
  }
}

/** Delegated SPA links: only same-origin paths, never modifier clicks. */
function bindLinks(root) {
  if (root.dataset.linksBound === "true") return;
  root.dataset.linksBound = "true";
  root.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target.closest("a");
    if (!anchor) return;
    if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    event.preventDefault();
    if (href.startsWith("#")) return;
    navigate(href);
  });
}

export function startRouter() {
  initTheme();
  bindLinks(document.getElementById("app"));
  window.addEventListener("popstate", () => void render());
  void render();
}
