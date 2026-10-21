"use client";

import { useActionState } from "react";
import { signIn, type AuthFormState } from "@/app/admin/actions";

const initial: AuthFormState = { message: "" };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-8 space-y-5">
      {notice ? (
        <p className="border border-gold bg-ivory px-4 py-3 text-sm leading-relaxed text-ink" role="status">
          {notice}
        </p>
      ) : null}
      {state.message ? (
        <p className="border border-burgundy/40 bg-ivory px-4 py-3 text-sm leading-relaxed text-burgundy" role="alert">
          {state.message}
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="text-sm font-medium text-forest">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={120}
          className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-forest">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={200}
          className="mt-2 w-full border border-gold/80 bg-ivory px-3 py-3 text-base text-ink outline-none focus-visible:border-forest"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center bg-burgundy px-6 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-ivory hover:bg-forest disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
