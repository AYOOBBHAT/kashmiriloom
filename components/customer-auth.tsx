"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  beginGoogleSignIn,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
  type AuthFormState,
} from "@/app/(store)/auth-actions";

const emptyState: AuthFormState = { message: "", fields: {} };

const fieldClass =
  "mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, emptyState);
  return (
    <div className="grid gap-8">
      {notice ? <Notice message={notice} /> : null}
      <EmailPasswordForm
        action={action}
        pending={pending}
        state={state}
        submitLabel="Sign in"
        pendingLabel="Signing in…"
        next={next}
        passwordAutoComplete="current-password"
      />
      <p className="text-sm text-muted">
        <Link href="/forgot-password" className="text-forest underline decoration-gold underline-offset-4">
          Forgot password
        </Link>
      </p>
      <GoogleSignIn next={next} />
      <p className="text-sm text-muted">
        New to KashmiriLoom?{" "}
        <Link href="/register" className="text-forest underline decoration-gold underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(registerAction, emptyState);
  return (
    <div className="grid gap-8">
      <form action={action} className="grid gap-5">
        <input type="hidden" name="next" value={next} />
        <Alert message={state.message} />
        <label className="text-sm font-medium text-forest" htmlFor="name">
          Name
          <input id="name" name="name" autoComplete="name" required maxLength={80} className={fieldClass} />
        </label>
        {state.fields.name ? <FieldNote message={state.fields.name} /> : null}
        <EmailField error={state.fields.email} />
        <PasswordField autoComplete="new-password" error={state.fields.password} />
        <Submit pending={pending} label="Create account" pendingLabel="Creating account…" />
      </form>
      <GoogleSignIn next={next} />
      <p className="text-sm text-muted">
        Already registered?{" "}
        <Link href="/login" className="text-forest underline decoration-gold underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, emptyState);
  return (
    <form action={action} className="grid gap-5">
      <Alert message={state.message} />
      <EmailField />
      <Submit pending={pending} label="Send reset link" pendingLabel="Sending…" />
      <Link href="/login" className="text-sm text-forest underline decoration-gold underline-offset-4">
        Back to sign in
      </Link>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, emptyState);
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="token" value={token} />
      <Alert message={state.message} />
      <PasswordField autoComplete="new-password" error={state.fields.password} />
      <Submit pending={pending} label="Save new password" pendingLabel="Saving…" />
    </form>
  );
}

export function GoogleSignIn({ next, link = false }: { next: string; link?: boolean }) {
  const [state, action, pending] = useActionState(beginGoogleSignIn, emptyState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="next" value={next} />
      {link ? <input type="hidden" name="link" value="1" /> : null}
      <Alert message={state.message} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center border border-forest px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-forest hover:bg-forest hover:text-ivory disabled:opacity-60"
      >
        {pending ? "Opening Google…" : link ? "Connect Google" : "Continue with Google"}
      </button>
    </form>
  );
}

function EmailPasswordForm({
  action,
  pending,
  state,
  submitLabel,
  pendingLabel,
  next,
  passwordAutoComplete,
}: {
  action: (formData: FormData) => void;
  pending: boolean;
  state: { message: string; fields: Record<string, string> };
  submitLabel: string;
  pendingLabel: string;
  next: string;
  passwordAutoComplete: "current-password" | "new-password";
}) {
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="next" value={next} />
      <Alert message={state.message} />
      <EmailField error={state.fields.email} />
      <PasswordField autoComplete={passwordAutoComplete} error={state.fields.password} />
      <Submit pending={pending} label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

function EmailField({ error }: { error?: string }) {
  return (
    <label className="text-sm font-medium text-forest" htmlFor="email">
      Email
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={120} className={fieldClass} />
      {error ? <FieldNote message={error} /> : null}
    </label>
  );
}

function PasswordField({
  autoComplete,
  error,
}: {
  autoComplete: "current-password" | "new-password";
  error?: string;
}) {
  return (
    <label className="text-sm font-medium text-forest" htmlFor="password">
      Password
      <input
        id="password"
        name="password"
        type="password"
        autoComplete={autoComplete}
        required
        minLength={10}
        maxLength={200}
        className={fieldClass}
      />
      {error ? <FieldNote message={error} /> : null}
    </label>
  );
}

function Submit({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function Alert({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return (
    <p role="status" className="border border-gold bg-ivory px-4 py-4 text-sm leading-relaxed text-ink">
      {message}
    </p>
  );
}

function Notice({ message }: { message: string }) {
  return <p className="border border-gold/80 px-4 py-4 text-sm leading-relaxed text-ink">{message}</p>;
}

function FieldNote({ message }: { message: string }) {
  return <span className="mt-2 block text-sm text-burgundy">{message}</span>;
}
