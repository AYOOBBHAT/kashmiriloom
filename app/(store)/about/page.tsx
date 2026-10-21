import type { Metadata } from "next";
import Link from "next/link";
import { PolicyDocument, PolicySection } from "@/components/policy-document";
import { BUSINESS_ADDRESS, policyUrl, PROPRIETOR_NAME, STORE_NAME, STORE_ORIGIN } from "@/lib/site/policies";

export const metadata: Metadata = {
  title: "About",
  description: `${STORE_NAME} is an individually operated online shop for Kashmiri shawls, run by ${PROPRIETOR_NAME}.`,
  alternates: { canonical: policyUrl("/about") },
};

export default function AboutPage() {
  return (
    <PolicyDocument
      eyebrow="The house"
      title="About KashmiriLoom"
      lede={`${STORE_NAME} is an individually operated shop selling Kashmiri shawls online at ${STORE_ORIGIN}.`}
    >
      <PolicySection id="shop" title="The shop">
        <p>
          {PROPRIETOR_NAME} runs {STORE_NAME} as an individual seller. The stated place of business is {BUSINESS_ADDRESS}. The seller states that the business is not registered for GST.
        </p>
        <p>
          The edit on this website is a short list of physical shawls: Kani weaves, embroidered pieces, and everyday wool. Prices are shown in Indian rupees. The catalogue is the description of each piece.
        </p>
      </PolicySection>
      <PolicySection id="buying" title="How a purchase works">
        <p>
          You may check out as a guest, or with an email and password, or with Google. Payment goes through Razorpay. Password-reset messages, when email delivery is configured, are sent with Resend. Standard shipping is free, with delivery expected in about 7 days. A shawl that arrives damaged or defective can be reported within 7 days of delivery.
        </p>
        <p>
          <Link href="/contact" className="text-forest underline decoration-gold underline-offset-4">
            Contact
          </Link>{" "}
          has the support email, telephone, WhatsApp, and address.
        </p>
      </PolicySection>
    </PolicyDocument>
  );
}
