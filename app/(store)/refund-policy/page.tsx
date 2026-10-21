import type { Metadata } from "next";
import Link from "next/link";
import { PolicyDocument, PolicySection } from "@/components/policy-document";
import { policyUrl, STORE_NAME, SUPPORT_EMAIL } from "@/lib/site/policies";

export const metadata: Metadata = {
  title: "Refund and cancellation policy",
  description: `Report a damaged or defective shawl from ${STORE_NAME} within 7 days of delivery. Return shipping for an accepted claim is paid by the shop.`,
  alternates: { canonical: policyUrl("/refund-policy") },
};

export default function RefundPolicyPage() {
  return (
    <PolicyDocument
      eyebrow="Refunds"
      title="Refund and cancellation policy"
      lede={`${STORE_NAME} asks customers to report a shawl that arrives damaged or defective within 7 days after delivery. Where the Consumer Protection Act, 2019 applies, the remedies that Act provides remain available.`}
    >
      <PolicySection id="damage" title="Damaged or defective shawls">
        <p>
          If the shawl you receive is damaged or defective, report it within 7 days after delivery. Include the order reference, a description of the problem, and photographs or other evidence of the damage or defect.
        </p>
        <p>
          Send the report to{" "}
          <a className="text-forest underline decoration-gold underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          , or call or message the telephone and WhatsApp number on the{" "}
          <Link href="/contact" className="text-forest underline decoration-gold underline-offset-4">
            contact page
          </Link>
          .
        </p>
        <p>When {STORE_NAME} accepts the claim, {STORE_NAME} pays the cost of sending the shawl back.</p>
      </PolicySection>
      <PolicySection id="approval" title="Refunds">
        <p>
          A refund of an online payment is sent through the payment process for that payment, including Razorpay when Razorpay handled it. Your bank or card issuer may take further time after the refund is sent.
        </p>
        <p>
          The seven-day report is how the shop asks to hear about a damaged or defective shawl promptly. It does not replace a remedy the Consumer Protection Act, 2019 requires where that Act applies.
        </p>
      </PolicySection>
      <PolicySection id="unpaid" title="Unpaid orders">
        <p>
          An order that is never paid has no confirmed payment to refund. The{" "}
          <Link href="/terms-and-conditions" className="text-forest underline decoration-gold underline-offset-4">
            terms
          </Link>{" "}
          explain that an unpaid reservation ends after 30 minutes unless a payment is still being checked. There is no button on this website for a customer to cancel a paid order.
        </p>
      </PolicySection>
    </PolicyDocument>
  );
}
