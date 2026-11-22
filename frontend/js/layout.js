/**
 * App shell (sidebar + topbar + footer) and the two-column auth layout.
 * Mirrors the original AppShell and AuthLayout components.
 */

import { APP_CONFIG } from "./config.js";
import { icon } from "./icons.js";
import { logo, fullPageLoader, button } from "./components.js";
import { getAuth, getRole, getTheme, signOut, toast, toggleTheme } from "./store.js";
import { ROLE_LABELS, escapeHtml, getErrorMessage, initials } from "./utils.js";

const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { path: "/app/dashboard", label: "Dashboard", iconName: "home", roles: ["staff", "owner"] },
      { path: "/app/book", label: "Book appointment", iconName: "calendar", roles: ["customer"] },
      {
        path: "/app/my-appointments",
        label: "My appointments",
        iconName: "calendar",
        roles: ["customer"],
      },
      {
        path: "/app/appointments",
        label: "Appointments",
        iconName: "calendar",
        roles: ["staff", "owner"],
      },
      { path: "/app/inventory", label: "Inventory", iconName: "box", roles: ["staff", "owner"] },
      { path: "/app/invoices", label: "My invoices", iconName: "receipt", roles: ["customer"] },
      { path: "/app/billing", label: "Billing", iconName: "receipt", roles: ["staff", "owner"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { path: "/app/services", label: "Services", iconName: "settings", roles: ["owner"] },
      { path: "/app/staff", label: "Staff & roles", iconName: "users", roles: ["owner"] },
      { path: "/app/analytics", label: "Analytics", iconName: "chart", roles: ["owner"] },
      { path: "/app/audit-logs", label: "Audit logs", iconName: "shield", roles: ["owner"] },
    ],
  },
];

function sidebarContent(currentPath) {
  const { profile } = getAuth();
  const role = getRole();

  const groups = NAV_GROUPS.map((group) => {
    const items = group.items.filter((item) => item.roles.includes(role));
    if (items.length === 0) return "";
    return `<div>
      <p class="nav-group-label">${escapeHtml(group.label)}</p>
      <ul class="nav-list">
        ${items
          .map(
            (item) => `<li>
              <a class="nav-link${currentPath === item.path ? " active" : ""}" href="${item.path}" data-link>
                ${icon(item.iconName)}${escapeHtml(item.label)}
              </a>
            </li>`,
          )
          .join("")}
      </ul>
    </div>`;
  }).join("");

  return `<div class="sidebar-inner">
    <div class="sidebar-brand">${logo()}</div>
    <nav class="sidebar-nav" aria-label="Main navigation">${groups}</nav>
    <div class="sidebar-user">
      <div class="sidebar-user-card">
        <span class="avatar">${escapeHtml(initials(profile ? profile.full_name : "Clinic User"))}</span>
        <div class="grow">
          <p class="small strong truncate">${escapeHtml(
            (profile && profile.full_name) || "Clinic user",
          )}</p>
          <p class="xs muted">${escapeHtml(ROLE_LABELS[role] || role)}</p>
        </div>
      </div>
      <p class="sidebar-clinic truncate">${escapeHtml(APP_CONFIG.clinicName)}</p>
    </div>
  </div>`;
}

/** Renders the full application shell around `content`. */
export function appShell({ path, content }) {
  const { profile } = getAuth();
  const role = getRole();
  const theme = getTheme();

  return `<div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-sticky">${sidebarContent(path)}</div>
    </aside>

    <div id="mobile-drawer-root"></div>

    <div class="main-col">
      <header class="topbar">
        <div class="row">
          <button type="button" class="btn-icon" id="open-drawer" aria-label="Open navigation menu" aria-expanded="false">
            ${icon("menu")}
          </button>
          <span class="drawer-logo">${logo({ size: "sm" })}</span>
          <div class="topbar-heading">
            <p class="topbar-title">${escapeHtml(APP_CONFIG.clinicName)}</p>
            <p class="topbar-sub">Appointment &amp; inventory workspace</p>
          </div>
        </div>

        <div class="row">
          <button type="button" class="btn-icon" data-theme-toggle aria-label="${
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }">${icon(theme === "dark" ? "sun" : "moon")}</button>
          <div class="topbar-user">
            <span class="badge badge-${
              role === "owner" ? "accent" : role === "staff" ? "brand" : "slate"
            }">${escapeHtml(ROLE_LABELS[role] || role)}</span>
            <span class="truncate">${escapeHtml((profile && profile.full_name) || "Clinic user")}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="sign-out" aria-label="Sign out">
            ${icon("logout", "icon-sm")}<span class="signout-label">Sign out</span>
          </button>
        </div>
      </header>

      <main class="content" id="page-content">${content}</main>

      <footer class="app-footer">
        <span class="row" style="justify-content:center">
          ${icon("alert", "icon-xs")}Keep patient records confidential. Access is logged.
        </span>
      </footer>
    </div>
  </div>`;
}

/** Wires the shell's topbar buttons and mobile drawer after insertion. */
export function mountAppShell(root) {
  root.querySelectorAll("[data-theme-toggle]").forEach((el) => {
    el.addEventListener("click", () => toggleTheme());
  });

  const signOutButton = root.querySelector("#sign-out");
  if (signOutButton) {
    signOutButton.addEventListener("click", async () => {
      signOutButton.disabled = true;
      try {
        await signOut();
        toast.success("Signed out");
        window.history.replaceState({}, "", "/login");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch (error) {
        toast.error(getErrorMessage(error, "Could not sign out"));
        signOutButton.disabled = false;
      }
    });
  }

  const openButton = root.querySelector("#open-drawer");
  const drawerRoot = root.querySelector("#mobile-drawer-root");
  const currentPath = window.location.pathname;

  const closeDrawer = () => {
    drawerRoot.innerHTML = "";
    if (openButton) openButton.setAttribute("aria-expanded", "false");
  };

  if (openButton && drawerRoot) {
    openButton.addEventListener("click", () => {
      openButton.setAttribute("aria-expanded", "true");
      drawerRoot.innerHTML = `<div class="drawer">
        <div class="drawer-backdrop" data-drawer-close aria-hidden="true"></div>
        <div class="drawer-panel" role="dialog" aria-label="Navigation">
          <button type="button" class="btn-icon drawer-close" data-drawer-close aria-label="Close navigation">
            ${icon("close", "icon-sm")}
          </button>
          ${sidebarContent(currentPath)}
        </div>
      </div>`;
      drawerRoot.querySelectorAll("[data-drawer-close]").forEach((el) => {
        el.addEventListener("click", closeDrawer);
      });
      drawerRoot.querySelectorAll("a[data-link]").forEach((link) => {
        link.addEventListener("click", closeDrawer);
      });
    });

    // Close the drawer whenever the viewport grows to desktop width.
    const query = window.matchMedia("(min-width: 1024px)");
    query.addEventListener("change", (event) => {
      if (event.matches) closeDrawer();
    });
  }

}

/* -------------------------------------------------------------------------- */
/* Auth layout                                                               */
/* -------------------------------------------------------------------------- */

const HIGHLIGHTS = [
  "Real-time availability with database-level double-booking protection",
  "Inventory alerts before you run out or items expire",
  "Invoices, PDFs and revenue analytics in one place",
];

export function authLayout({ title, subtitle, body, footer = "" }) {
  return `<div class="auth-layout">
    <div class="auth-marketing">
      <a href="/" data-link aria-label="ClinicFlow home">${logo({ size: "lg", onDark: true })}</a>
      <div style="max-width:32rem">
        <h2 class="auth-headline">Less paperwork. More time with patients.</h2>
        <p class="auth-sub">
          ClinicFlow keeps your schedule, stock and billing in sync so your team can focus on care.
        </p>
        <ul class="auth-highlights">
          ${HIGHLIGHTS.map(
            (highlight) => `<li class="auth-highlight">
              <span class="auth-check">${icon("check", "icon-xs")}</span>${escapeHtml(highlight)}
            </li>`,
          ).join("")}
        </ul>
      </div>
      <p class="auth-footnote">${escapeHtml(APP_CONFIG.clinicName)} · ${escapeHtml(
        APP_CONFIG.clinicAddress,
      )}</p>
    </div>

    <div class="auth-main">
      <div class="auth-inner">
        <div class="auth-mobile-logo"><a href="/" data-link>${logo({ size: "lg" })}</a></div>
        <div class="auth-card">
          <h1 class="auth-title">${escapeHtml(title)}</h1>
          <p class="auth-subtitle">${escapeHtml(subtitle)}</p>
          <div class="auth-form">${body}</div>
        </div>
        ${footer ? `<div class="auth-footer">${footer}</div>` : ""}
      </div>
    </div>
  </div>`;
}

export { fullPageLoader, button };
