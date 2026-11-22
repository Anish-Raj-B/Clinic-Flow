/**
 * Public landing page. Same sections, copy, layout and palette as the original
 * React page, rebuilt as HTML/CSS3.
 */

import { APP_CONFIG } from "../config.js";
import { icon } from "../icons.js";
import { logo } from "../components.js";
import { getTheme } from "../store.js";
import { escapeHtml } from "../utils.js";

const FEATURES = [
  {
    iconName: "calendar",
    title: "Conflict-free scheduling",
    description:
      "Live availability per practitioner, with a PostgreSQL exclusion constraint that makes double bookings impossible.",
  },
  {
    iconName: "box",
    title: "Inventory that warns you",
    description:
      "Track stock, reorder levels and expiry dates. Get badges, digests and a full movement history.",
  },
  {
    iconName: "receipt",
    title: "Billing without spreadsheets",
    description:
      "Create invoices from appointments, add line items, mark them paid and download a branded PDF.",
  },
  {
    iconName: "chart",
    title: "Decisions from real data",
    description:
      "Daily revenue, busiest hours, top-selling items and no-show rate updated straight from your database.",
  },
  {
    iconName: "shield",
    title: "Role-aware security",
    description:
      "Row Level Security on every table. Customers only see their own records; every change is audited.",
  },
  {
    iconName: "mail",
    title: "Automated reminders",
    description:
      "Daily reminder emails, low-stock digests and booking confirmations delivered through Resend.",
  },
];

const STEPS = [
  { title: "Set up your clinic", description: "Add services, invite staff and set weekly availability in minutes." },
  {
    title: "Share your booking link",
    description: "Customers pick a service, practitioner and a genuinely free slot.",
  },
  {
    title: "Run the day",
    description: "Update statuses, bill visits, restock inventory and watch the numbers.",
  },
];

const ROLES = [
  {
    iconName: "users",
    role: "Customers",
    points: ["Book and cancel appointments", "See live free slots", "Download their invoices"],
  },
  {
    iconName: "stethoscope",
    role: "Staff",
    points: [
      "Today's schedule and status updates",
      "Inventory CRUD and stock movements",
      "Create invoices and take payment",
    ],
  },
  {
    iconName: "shield",
    role: "Owners",
    points: [
      "Manage services and staff roles",
      "Revenue and no-show analytics",
      "Full audit log access",
    ],
  },
];

const SCHEDULE = [
  { time: "09:00", name: "Amina Yusuf", service: "General consultation", tone: "tone-brand" },
  { time: "09:30", name: "Daniel Okafor", service: "Blood pressure check", tone: "tone-accent" },
  { time: "10:15", name: "Priya Sharma", service: "Vaccination", tone: "tone-amber" },
  { time: "11:00", name: "Luis Alvarez", service: "Follow-up visit", tone: "tone-brand" },
];

export function renderLanding() {
  const theme = getTheme();
  return `<div class="landing">
    <header class="landing-header">
      <div class="landing-header-inner">
        <a href="/" data-link aria-label="ClinicFlow home">${logo()}</a>
        <nav class="landing-nav">
          <a href="#features">Features</a>
          <a href="#roles">For your team</a>
          <a href="#how">How it works</a>
        </nav>
        <div class="landing-actions">
          <button type="button" class="btn-icon" data-theme-toggle aria-label="${
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }">${icon(theme === "dark" ? "sun" : "moon")}</button>
          <a class="btn btn-ghost btn-sm" href="/login" data-link>Log in</a>
          <a class="btn btn-primary btn-sm" href="/signup" data-link>Get started</a>
        </div>
      </div>
    </header>

    <main>
      <section class="hero">
        <div class="hero-inner">
          <div>
            <span class="eyebrow">${icon("sparkle", "icon-xs")}Built for small clinics &amp; pharmacies</span>
            <h1 class="hero-title">
              Ditch the paper register.
              <span class="accent-line">Run your clinic from one place.</span>
            </h1>
            <p class="hero-lead">
              ClinicFlow replaces notebooks and WhatsApp threads with real-time booking,
              inventory tracking, invoices and analytics. No double bookings. No surprise
              stock-outs.
            </p>
            <div class="hero-actions">
              <a class="btn btn-primary btn-lg" href="/signup" data-link>
                Create your account ${icon("chevron", "icon-sm")}
              </a>
              <a class="btn btn-outline btn-lg" href="/login" data-link>Sign in to your clinic</a>
            </div>
            <dl class="hero-stats">
              <div><dt>Double bookings</dt><dd>0</dd></div>
              <div><dt>Record lookup</dt><dd>&lt;1s</dd></div>
              <div><dt>Setup time</dt><dd>Minutes</dd></div>
            </dl>
          </div>

          <div class="hero-visual">
            <div class="hero-glow" aria-hidden="true"></div>
            <div class="schedule-preview">
              <div class="preview-head">
                <div>
                  <p class="small strong">Today&apos;s schedule</p>
                  <p class="xs muted">${escapeHtml(APP_CONFIG.clinicName)}</p>
                </div>
                <span class="pill badge-emerald">
                  <span style="width:6px;height:6px;border-radius:999px;background:#10b981"></span>Live
                </span>
              </div>
              <ul class="schedule-list">
                ${SCHEDULE.map(
                  (row) => `<li>
                    <div class="time-col"><span>${row.time}</span><span>30 min</span></div>
                    <span class="color-bar ${row.tone}" aria-hidden="true"></span>
                    <div class="grow">
                      <p class="small strong truncate">${escapeHtml(row.name)}</p>
                      <p class="xs muted truncate">${escapeHtml(row.service)}</p>
                    </div>
                    <span class="badge badge-brand" style="display:none" data-wide-badge>Confirmed</span>
                  </li>`,
                ).join("")}
              </ul>
              <div class="preview-cards">
                <div class="mini-card">
                  <p class="xs muted row">${icon("clock", "icon-xs")}Next up</p>
                  <p class="small strong mt-1">09:00 · Amina Yusuf</p>
                </div>
                <div class="mini-card amber">
                  <p class="xs row" style="color:#b45309">${icon("box", "icon-xs")}Low stock</p>
                  <p class="small strong mt-1">2 items need reorder</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" class="section">
        <div class="section-head">
          <p class="section-label" style="color:var(--brand-600)">Everything in one workspace</p>
          <h2 class="section-title">Built for the way small clinics actually work</h2>
          <p class="section-lead">
            No enterprise bloat. Just the workflows that keep your day running and your records safe.
          </p>
        </div>
        <div class="feature-grid">
          ${FEATURES.map(
            (feature) => `<div class="feature-card">
              <span class="icon-box">${icon(feature.iconName)}</span>
              <h3>${escapeHtml(feature.title)}</h3>
              <p>${escapeHtml(feature.description)}</p>
            </div>`,
          ).join("")}
        </div>
      </section>

      <section id="roles" class="roles-band">
        <div class="roles-inner">
          <div class="section-head">
            <h2 class="section-title" style="margin-top:0">One system, three clear roles</h2>
            <p class="section-lead">
              Everyone sees exactly what they need. Permissions are enforced in the database, not
              just the interface.
            </p>
          </div>
          <div class="roles-grid">
            ${ROLES.map(
              (item) => `<div class="role-card">
                <span class="icon-box tone-accent" style="background:var(--accent-50);color:var(--accent-600)">${icon(
                  item.iconName,
                )}</span>
                <h3>${escapeHtml(item.role)}</h3>
                <ul class="role-points">
                  ${item.points
                    .map((point) => `<li>${icon("check", "icon-sm")}${escapeHtml(point)}</li>`)
                    .join("")}
                </ul>
              </div>`,
            ).join("")}
          </div>
        </div>
      </section>

      <section id="how" class="section">
        <div class="steps-layout">
          <div class="steps-intro">
            <h2 class="section-title" style="margin-top:0">
              From paper to ClinicFlow in an afternoon
            </h2>
            <p class="section-lead">
              Invite your team, import your stock list and let customers book online. Your first
              week is usually the hardest - after that it runs itself.
            </p>
            <div class="mt-6 col" style="gap:0.75rem">
              <p class="small muted row">${icon("pin", "icon-sm")}Works on clinic desktops, tablets and phones</p>
              <p class="small muted row">${icon("phone", "icon-sm")}${escapeHtml(APP_CONFIG.clinicPhone)}</p>
            </div>
          </div>
          <ol class="steps-grid">
            ${STEPS.map(
              (step, index) => `<li class="step-card">
                <span class="step-num">${index + 1}</span>
                <h3>${escapeHtml(step.title)}</h3>
                <p>${escapeHtml(step.description)}</p>
              </li>`,
            ).join("")}
          </ol>
        </div>
      </section>

      <section class="section" style="padding-top:0">
        <div class="cta-banner">
          <div class="cta-inner">
            <div>
              <h2 style="font-size:1.5rem;font-weight:700">Ready to see your schedule clearly?</h2>
              <p class="mt-2" style="color:rgba(239,248,255,0.9);max-width:36rem">
                Create an account as a customer, or ask your clinic owner for a staff role.
              </p>
            </div>
            <a class="btn btn-lg" style="background:#fff;color:#1b50af" href="/signup" data-link>
              Get started free ${icon("chevron", "icon-sm")}
            </a>
          </div>
        </div>
      </section>
    </main>

    <footer class="landing-footer">
      <div class="landing-footer-inner">
        ${logo({ size: "sm" })}
        <p class="xs muted">
          © ${new Date().getFullYear()} ClinicFlow. Appointment &amp; inventory management for small
          clinics.
        </p>
        <div class="row gap-4">
          <a class="xs muted" href="/login" data-link>Log in</a>
          <a class="xs muted" href="/signup" data-link>Sign up</a>
        </div>
      </div>
    </footer>
  </div>`;
}

export function mountLanding(root) {
  root.querySelectorAll("[data-theme-toggle]").forEach((el) => {
    el.addEventListener("click", async () => {
      const { toggleTheme } = await import("../store.js");
      toggleTheme();
    });
  });
  root.querySelectorAll("[data-wide-badge]").forEach((el) => {
    if (window.matchMedia("(min-width: 640px)").matches) el.style.display = "inline-flex";
  });
}
