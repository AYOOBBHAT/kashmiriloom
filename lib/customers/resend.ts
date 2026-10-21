import "server-only";

import { Resend } from "resend";
import type { Mailer } from "@/lib/customers/accounts";
import { readEmailFrom } from "@/lib/customers/config";

type SendClient = {
  emails: {
    send(message: { from: string; to: string; subject: string; text: string }): Promise<unknown>;
  };
};

export function createResendMailer(client: SendClient | null = defaultClient(), from = readEmailFrom()): Mailer {
  return {
    async sendPasswordReset(message) {
      if (!client || !from) {
        throw new Error("Password reset email is not configured.");
      }
      await client.emails.send({
        from,
        to: message.to,
        subject: "Reset your KashmiriLoom password",
        text: [
          "A password reset was requested for your KashmiriLoom account.",
          "",
          `Open this link to choose a new password. It expires in 30 minutes and works once:`,
          message.resetUrl,
          "",
          "If you did not ask for this, you can ignore the message.",
        ].join("\n"),
      });
    },
  };
}

function defaultClient(): SendClient | null {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  if (apiKey.length < 8) {
    return null;
  }
  return new Resend(apiKey);
}
