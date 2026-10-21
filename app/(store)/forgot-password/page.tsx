import type { Metadata } from "next";
import { Container } from "@/components/container";
import { ForgotPasswordForm } from "@/components/customer-auth";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto max-w-md">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-burgundy">Account</p>
        <h1 className="mt-3 font-serif text-5xl text-forest">Reset your password</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">
          Enter the email on your account. If it matches, a single-use reset link will be sent. The reply is the same either way.
        </p>
        <div className="mt-8">
          <ForgotPasswordForm />
        </div>
      </div>
    </Container>
  );
}
