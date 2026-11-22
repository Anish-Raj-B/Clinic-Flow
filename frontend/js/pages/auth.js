/**
 * Authentication pages: login, signup, forgot password, reset password, 404.
 * Mirrors the React pages, including validation messages and confirmation
 * states.
 */

import { authLayout } from "../layout.js";
import { icon } from "../icons.js";
import {
  alertError,
  button,
  inputField,
  logo,
  showFieldErrors,
  spinner,
} from "../components.js";
import {
  resetPassword,
  signIn,
  signUp,
  toast,
  updatePassword,
  getAuth,
} from "../store.js";
import {
  validateForgotPassword,
  validateNewPassword,
  validateSignIn,
  validateSignUp,
} from "../validation.js";
import { escapeHtml, getErrorMessage } from "../utils.js";

const state = {
  signupSent: false,
  forgotSent: false,
  signupEmail: "",
  forgotEmail: "",
};

export function resetAuthState() {
  state.signupSent = false;
  state.forgotSent = false;
  state.signupEmail = "";
  state.forgotEmail = "";
}

function setLoading(buttonEl, loading, label) {
  if (!buttonEl) return;
  buttonEl.disabled = loading;
  buttonEl.setAttribute("aria-busy", loading ? "true" : "false");
  buttonEl.innerHTML = loading ? `${spinner("icon-sm", "Working")}${escapeHtml(label)}` : escapeHtml(label);
}

function footerLink(text, href, linkText) {
  return `${escapeHtml(text)} <a href="${href}" data-link>${escapeHtml(linkText)}</a>`;
}

function errorBanner(message) {
  return message ? alertError(message) : "";
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

export function renderLogin(ctx) {
  const next = ctx.query.get("next") || "/app";
  return {
    html: authLayout({
      title: "Welcome back",
      subtitle: "Sign in to manage appointments, inventory and invoices.",
      body: `<form id="login-form" novalidate>
        <div id="login-error">${errorBanner("")}</div>
        ${inputField({
          id: "email",
          label: "Email address",
          type: "email",
          placeholder: "you@clinic.com",
          attrs: 'autocomplete="email"',
        })}
        ${inputField({
          id: "password",
          label: "Password",
          type: "password",
          placeholder: "••••••••",
          attrs: 'autocomplete="current-password"',
        })}
        <div class="row" style="justify-content:flex-end">
          <a class="btn-link" href="/forgot-password" data-link style="font-size:0.875rem">Forgot password?</a>
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="login-submit">Sign in</button>
      </form>`,
      footer: footerLink("New to ClinicFlow?", "/signup", "Create an account"),
    }),
    mount(root) {
      const form = root.querySelector("#login-form");
      const submit = root.querySelector("#login-submit");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const result = validateSignIn(values);
        showFieldErrors(form, result.errors);
        const errorSlot = root.querySelector("#login-error");
        if (!result.valid) {
          if (errorSlot) errorSlot.innerHTML = errorBanner("Please fix the highlighted fields.");
          return;
        }
        setLoading(submit, true, "Signing in…");
        try {
          await signIn(values.email, values.password);
          toast.success("Welcome back");
          ctx.navigate(next.startsWith("/") ? next : "/app", { replace: true });
        } catch (error) {
          const message = getErrorMessage(error, "Could not sign in");
          if (errorSlot) errorSlot.innerHTML = errorBanner(message);
          toast.error(message);
          setLoading(submit, false, "Sign in");
        }
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Signup                                                                     */
/* -------------------------------------------------------------------------- */

export function renderSignup(ctx) {
  if (state.signupSent) {
    return {
      html: authLayout({
        title: "Check your inbox",
        subtitle: "One more step to activate your ClinicFlow account.",
        body: `<div class="text-center" style="display:flex;flex-direction:column;align-items:center;padding:0.5rem 0">
          <span class="auth-icon-circle badge-emerald" style="width:48px;height:48px">${icon("check")}</span>
          <p class="small muted mt-4">
            We sent a confirmation link to <strong>${escapeHtml(state.signupEmail || "your email")}</strong>.
            Open it to verify your account, then sign in. Don&apos;t forget to check spam.
          </p>
          ${button("Back to sign in", { variant: "outline", action: "go-login", attrs: 'style="margin-top:1.25rem"' })}
        </div>`,
        footer: footerLink("Already verified?", "/login", "Sign in"),
      }),
      mount(root) {
        const go = root.querySelector('[data-action="go-login"]');
        if (go) go.addEventListener("click", () => ctx.navigate("/login"));
      },
    };
  }

  return {
    html: authLayout({
      title: "Create your account",
      subtitle:
        "New accounts start with customer access. A clinic owner can promote you to staff later.",
      body: `<form id="signup-form" novalidate>
        <div id="signup-error">${errorBanner("")}</div>
        ${inputField({
          id: "fullName",
          label: "Full name",
          placeholder: "Dr. Jane Doe",
          attrs: 'autocomplete="name"',
        })}
        <div class="form-grid two">
          ${inputField({
            id: "email",
            label: "Email address",
            type: "email",
            placeholder: "you@clinic.com",
            attrs: 'autocomplete="email"',
          })}
          ${inputField({
            id: "phone",
            label: "Phone (optional)",
            type: "tel",
            placeholder: "+1 555 010 2030",
            attrs: 'autocomplete="tel"',
          })}
        </div>
        <div class="form-grid two">
          ${inputField({
            id: "password",
            label: "Password",
            type: "password",
            placeholder: "At least 8 characters",
            hint: "Include a letter and a number.",
            attrs: 'autocomplete="new-password"',
          })}
          ${inputField({
            id: "confirmPassword",
            label: "Confirm password",
            type: "password",
            placeholder: "Repeat password",
            attrs: 'autocomplete="new-password"',
          })}
        </div>
        <button type="submit" class="btn btn-primary btn-block" id="signup-submit">Create account</button>
        <p class="xs muted text-center">
          By creating an account you agree to keep patient information confidential.
        </p>
      </form>`,
      footer: footerLink("Already registered?", "/login", "Sign in"),
    }),
    mount(root) {
      const form = root.querySelector("#signup-form");
      const submit = root.querySelector("#signup-submit");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const result = validateSignUp(values);
        showFieldErrors(form, result.errors);
        const errorSlot = root.querySelector("#signup-error");
        if (!result.valid) {
          if (errorSlot) errorSlot.innerHTML = errorBanner("Please fix the highlighted fields.");
          return;
        }
        setLoading(submit, true, "Creating account…");
        try {
          const signUpResult = await signUp({
            email: values.email,
            password: values.password,
            fullName: values.fullName,
            phone: values.phone,
          });
          if (signUpResult.requiresEmailConfirmation) {
            state.signupSent = true;
            state.signupEmail = String(values.email).trim();
            ctx.rerender();
          } else {
            toast.success("Account created. Welcome to ClinicFlow!");
            ctx.navigate("/app", { replace: true });
          }
        } catch (error) {
          const message = getErrorMessage(error, "Could not create your account");
          if (errorSlot) errorSlot.innerHTML = errorBanner(message);
          toast.error(message);
          setLoading(submit, false, "Create account");
        }
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Forgot password                                                            */
/* -------------------------------------------------------------------------- */

export function renderForgotPassword(ctx) {
  if (state.forgotSent) {
    return {
      html: authLayout({
        title: "Reset your password",
        subtitle: "We'll email you a secure link to choose a new password.",
        body: `<div class="text-center" style="display:flex;flex-direction:column;align-items:center">
          <span class="auth-icon-circle badge-brand" style="width:48px;height:48px">${icon("mail")}</span>
          <p class="small muted mt-4">
            If an account exists for <strong>${escapeHtml(
              state.forgotEmail,
            )}</strong>, a reset link is on its way. The link expires after one hour.
          </p>
          ${button("Use a different email", {
            variant: "outline",
            action: "different-email",
            attrs: 'style="margin-top:1.25rem"',
          })}
        </div>`,
        footer: footerLink("", "/login", "Back to sign in"),
      }),
      mount(root) {
        const again = root.querySelector('[data-action="different-email"]');
        if (again) {
          again.addEventListener("click", () => {
            state.forgotSent = false;
            ctx.rerender();
          });
        }
      },
    };
  }

  return {
    html: authLayout({
      title: "Reset your password",
      subtitle: "We'll email you a secure link to choose a new password.",
      body: `<form id="forgot-form" novalidate>
        <div id="forgot-error">${errorBanner("")}</div>
        ${inputField({
          id: "email",
          label: "Email address",
          type: "email",
          placeholder: "you@clinic.com",
          attrs: 'autocomplete="email"',
        })}
        <button type="submit" class="btn btn-primary btn-block" id="forgot-submit">Send reset link</button>
      </form>`,
      footer: footerLink("", "/login", "Back to sign in"),
    }),
    mount(root) {
      const form = root.querySelector("#forgot-form");
      const submit = root.querySelector("#forgot-submit");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const result = validateForgotPassword(values);
        showFieldErrors(form, result.errors);
        const errorSlot = root.querySelector("#forgot-error");
        if (!result.valid) {
          if (errorSlot) errorSlot.innerHTML = errorBanner("Please fix the highlighted fields.");
          return;
        }
        setLoading(submit, true, "Sending…");
        try {
          await resetPassword(values.email);
          state.forgotSent = true;
          state.forgotEmail = String(values.email).trim();
          toast.success("Password reset email sent");
          ctx.rerender();
        } catch (error) {
          const message = getErrorMessage(error, "Could not send the reset email");
          if (errorSlot) errorSlot.innerHTML = errorBanner(message);
          toast.error(message);
          setLoading(submit, false, "Send reset link");
        }
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Reset password                                                             */
/* -------------------------------------------------------------------------- */

export function renderResetPassword(ctx) {
  const { session } = getAuth();

  if (!session) {
    return {
      html: authLayout({
        title: "Reset link needed",
        subtitle: "Open the reset link from your email to continue.",
        body: `<div class="alert alert-warning" role="alert">
          This page must be opened from the password reset email. Request a new link if yours has
          expired.
        </div>
        ${button("Request a new link", {
          variant: "outline",
          block: true,
          action: "request-link",
          attrs: 'style="margin-top:1rem"',
        })}`,
        footer: footerLink("", "/login", "Back to sign in"),
      }),
      mount(root) {
        const request = root.querySelector('[data-action="request-link"]');
        if (request) request.addEventListener("click", () => ctx.navigate("/forgot-password"));
      },
    };
  }

  return {
    html: authLayout({
      title: "Choose a new password",
      subtitle: "Pick something you haven't used before.",
      body: `<form id="reset-form" novalidate>
        <div id="reset-error">${errorBanner("")}</div>
        ${inputField({
          id: "password",
          label: "New password",
          type: "password",
          placeholder: "At least 8 characters",
          attrs: 'autocomplete="new-password"',
        })}
        ${inputField({
          id: "confirmPassword",
          label: "Confirm new password",
          type: "password",
          placeholder: "Repeat password",
          attrs: 'autocomplete="new-password"',
        })}
        <button type="submit" class="btn btn-primary btn-block" id="reset-submit">Update password</button>
      </form>`,
      footer: footerLink("", "/app", "Continue to ClinicFlow"),
    }),
    mount(root) {
      const form = root.querySelector("#reset-form");
      const submit = root.querySelector("#reset-submit");
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        const result = validateNewPassword(values);
        showFieldErrors(form, result.errors);
        const errorSlot = root.querySelector("#reset-error");
        if (!result.valid) {
          if (errorSlot) errorSlot.innerHTML = errorBanner("Please fix the highlighted fields.");
          return;
        }
        setLoading(submit, true, "Updating…");
        try {
          await updatePassword(values.password);
          toast.success("Password updated. You can now use your new password.");
          ctx.navigate("/app", { replace: true });
        } catch (error) {
          const message = getErrorMessage(error, "Could not update your password");
          if (errorSlot) errorSlot.innerHTML = errorBanner(message);
          toast.error(message);
          setLoading(submit, false, "Update password");
        }
      });
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Profile-missing screen & 404                                               */
/* -------------------------------------------------------------------------- */

export function renderProfileMissing() {
  return `<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;padding:1rem;background:var(--bg)">
    <div class="card pad" style="max-width:28rem;text-align:center;width:100%">
      <h1 style="font-size:1.125rem;font-weight:600">Your profile is not ready yet</h1>
      <p class="small muted mt-2">
        We could not load your ClinicFlow profile. Refresh the page, or sign out and sign in again.
        If this keeps happening, ask your clinic owner to check your account.
      </p>
      <div class="mt-4" style="display:flex;flex-direction:column;gap:0.5rem">
        ${button("Refresh page", { action: "reload" })}
        ${button("Sign out", { variant: "outline", action: "profile-signout" })}
      </div>
    </div>
  </div>`;
}

export function renderNotFound() {
  return `<div style="display:flex;min-height:100vh;flex-direction:column;align-items:center;justify-content:center;padding:1rem;text-align:center;background:var(--bg)">
    ${logo({ size: "lg" })}
    <p class="mt-6" style="font-size:3.75rem;font-weight:800;color:var(--brand-600);line-height:1">404</p>
    <h1 class="mt-2" style="font-size:1.25rem;font-weight:600">We couldn't find that page</h1>
    <p class="small muted mt-2" style="max-width:24rem">
      The link may be broken, or the page may have moved. Head back to your workspace to continue.
    </p>
    <div class="mt-4 row">
      <a class="btn btn-primary" href="/app" data-link>Go to workspace</a>
      <a class="btn btn-outline" href="/" data-link>Home</a>
    </div>
  </div>`;
}
