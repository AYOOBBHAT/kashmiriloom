import type { Metadata } from "next";
import { PolicyDocument, PolicySection, SupportChannels } from "@/components/policy-document";
import { policyUrl, STORE_NAME, STORE_ORIGIN } from "@/lib/site/policies";

export const metadata: Metadata = {
  title: "Contact",
  description: `Email, telephone, WhatsApp, and address for ${STORE_NAME}.`,
  alternates: { canonical: policyUrl("/contact") },
};

export default function ContactPage() {
  return (
    <PolicyDocument
      eyebrow="Contact"
      title="Contact"
      lede={`${STORE_NAME} is an individually operated shop. The website is ${STORE_ORIGIN}.`}
    >
      <PolicySection id="published" title="How to reach the shop">
        <SupportChannels />
        <p>
          Use this email, telephone number, or WhatsApp for an order, a late delivery, a shawl that arrives damaged or defective, or a question about the information the shop holds.
        </p>
        <p>
          The note on the homepage does not store the address you type and does not send it anywhere. It is not a way to reach the shop.
        </p>
      </PolicySection>
      <PolicySection id="orders" title="Payments">
        <p>
          A question about a captured Razorpay payment can also be raised with Razorpay, using the order reference from the confirmation page.
        </p>
      </PolicySection>
    </PolicyDocument>
  );
}
