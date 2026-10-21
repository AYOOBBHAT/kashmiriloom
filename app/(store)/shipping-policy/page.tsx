import type { Metadata } from "next";
import Link from "next/link";
import { PolicyDocument, PolicySection } from "@/components/policy-document";
import { policyUrl, STORE_NAME, SUPPORT_EMAIL } from "@/lib/site/policies";

export const metadata: Metadata = {
  title: "Shipping policy",
  description: `Standard shipping from ${STORE_NAME} is free. Delivery is expected in about 7 days and is not guaranteed.`,
  alternates: { canonical: policyUrl("/shipping-policy") },
};

export default function ShippingPolicyPage() {
  return (
    <PolicyDocument
      eyebrow="Shipping"
      title="Shipping policy"
      lede={`${STORE_NAME} sells physical shawls for delivery in India. Standard shipping is free. Delivery is expected in approximately 7 days. That is an estimate, not a guaranteed delivery date.`}
    >
      <PolicySection id="estimate" title="Delivery estimate">
        <p>
          After an order is paid, delivery is expected in about 7 days. The actual date can be sooner or later. The address, conditions on the way, and whether the shawl is still available can change it.
        </p>
        <p>
          If a shipment is late, write to{" "}
          <a className="text-forest underline decoration-gold underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          with the order reference, or use the telephone or WhatsApp number on the{" "}
          <Link href="/contact" className="text-forest underline decoration-gold underline-offset-4">
            contact page
          </Link>
          .
        </p>
      </PolicySection>
      <PolicySection id="charge" title="Shipping charge">
        <p>
          Standard shipping is free. Checkout collects an Indian delivery address and adds no delivery charge. This page does not name a courier, a tracking service, or a day by which the shawl must leave the shop.
        </p>
      </PolicySection>
      <PolicySection id="order" title="When delivery starts">
        <p>
          The shop prepares an order after the server has confirmed the Razorpay payment. An unpaid order is not treated as ready to send. The{" "}
          <Link href="/terms-and-conditions" className="text-forest underline decoration-gold underline-offset-4">
            terms
          </Link>{" "}
          explain the 30-minute hold on unpaid orders.
        </p>
      </PolicySection>
    </PolicyDocument>
  );
}
