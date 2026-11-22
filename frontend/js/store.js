/**
 * Application state: authentication session/profile, theme and toasts.
 * Replaces the React AuthContext, ThemeContext and ToastContext.
 */

import { supabase } from "./supabase.js";
import { icon } from "./icons.js";
import { getErrorMessage, cn } from "./utils.js";

/* -------------------------------------------------------------------------- */
/* Auth                                                                      */
/* -------------------------------------------------------------------------- */

const authState = {
  session: null,
  user: null,
  profile: null,
  loading: true,
};

const authListeners = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch the profile row. The auth trigger normally creates it immediately, but
 * we retry briefly to absorb replication/trigger latency right after signup.
 */
async function fetchProfileWithRetry(userId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (data) return data;
    if (error && error.code !== "PGRST116") throw error;
    if (attempt < 2) await sleep(700);
  }
  return null;
}

function emitAuth() {
  for (const listener of authListeners) listener(getAuth());
}

export function getAuth() {
  return authState;
}

export function getRole() {
  return (authState.profile && authState.profile.role) || "customer";
}

export function isStaff() {
  const role = getRole();
  return role === "staff" || role === "owner";
}

export function isOwner() {
  return getRole() === "owner";
}

export function subscribeAuth(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

async function loadProfile(userId) {
  try {
    authState.profile = await fetchProfileWithRetry(userId);
  } catch {
    authState.profile = null;
  }
  emitAuth();
}

export async function initAuth() {
  const { data } = await supabase.auth.getSession();
  authState.session = data.session;
  authState.user = (data.session && data.session.user) || null;
  authState.loading = false;
  emitAuth();

  if (authState.user) {
    await loadProfile(authState.user.id);
  }

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    authState.session = nextSession;
    authState.user = (nextSession && nextSession.user) || null;
    authState.loading = false;
    if (nextSession && nextSession.user) {
      void loadProfile(nextSession.user.id);
    } else {
      authState.profile = null;
      emitAuth();
    }
  });
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email).trim(),
    password,
  });
  if (error) throw error;
  authState.session = data.session;
  authState.user = data.user;
  if (data.user) {
    authState.profile = await fetchProfileWithRetry(data.user.id);
  }
  emitAuth();
}

export async function signUp({ email, password, fullName, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email: String(email).trim(),
    password,
    options: {
      data: {
        full_name: String(fullName).trim(),
        phone: phone ? String(phone).trim() : null,
      },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
  if (error) throw error;
  return { requiresEmailConfirmation: data.session === null };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  authState.session = null;
  authState.user = null;
  authState.profile = null;
  emitAuth();
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(String(email).trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function refreshProfile() {
  if (!authState.user) return;
  await loadProfile(authState.user.id);
}

/* -------------------------------------------------------------------------- */
/* Theme                                                                     */
/* -------------------------------------------------------------------------- */

const THEME_KEY = "clinicflow-theme";
let currentTheme = "light";

function readStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getTheme() {
  return currentTheme;
}

function applyTheme(theme, persist) {
  currentTheme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
  if (persist) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Storage can be unavailable (private browsing); the theme still applies.
    }
  }
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.innerHTML = icon(theme === "dark" ? "sun" : "moon", "icon");
    button.setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
  });
}

export function initTheme() {
  applyTheme(readStoredTheme() || systemTheme(), false);
}

export function toggleTheme() {
  applyTheme(currentTheme === "dark" ? "light" : "dark", true);
}

/* -------------------------------------------------------------------------- */
/* Toasts                                                                    */
/* -------------------------------------------------------------------------- */

const TOAST_STYLES = {
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  error:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  info: "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200",
};

const timers = new Map();

function toastStack() {
  let stack = document.getElementById("toast-root");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-root";
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("role", "status");
    document.body.appendChild(stack);
  }
  return stack;
}

function dismiss(id) {
  const element = document.getElementById(id);
  if (element) element.remove();
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }
}

function push(message, variant) {
  const stack = toastStack();
  const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const item = document.createElement("div");
  item.id = id;
  item.className = cn(
    "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg",
    "toast",
    `toast-${variant}`,
    TOAST_STYLES[variant] || "",
  );
  item.innerHTML = `
    <span class="toast-symbol" aria-hidden="true">${
      variant === "success" ? "✓" : variant === "error" ? "!" : "i"
    }</span>
    <p class="grow break-word">${escapeText(message)}</p>
    <button type="button" class="toast-close" aria-label="Dismiss notification"><span aria-hidden="true">✕</span></button>`;

  item.querySelector(".toast-close").addEventListener("click", () => dismiss(id));
  stack.appendChild(item);

  while (stack.children.length > 4) {
    stack.firstElementChild.remove();
  }

  const timer = setTimeout(() => dismiss(id), variant === "error" ? 7000 : 4500);
  timers.set(id, timer);
}

function escapeText(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}

export const toast = {
  success: (message) => push(message, "success"),
  error: (message) => push(message, "error"),
  info: (message) => push(message, "info"),
  dismiss,
};

export { getErrorMessage };
