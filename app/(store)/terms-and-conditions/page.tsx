import type { Metadata } from "next";
import Link from "next/link";
import { PolicyDocument, PolicySection } from "@/components/policy-document";
import { BUSINESS_ADDRESS, policyUrl, PROPRIETOR_NAME, STORE_NAME, STORE_ORIGIN } from "@/lib/site/policies";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: `How orders, prices, payment, shipping, and damaged or defective shawls work at ${STORE_NAME}.`,
  alternates: { canonical: policyUrl("/terms-and-conditions") },
};

export default function TermsPage() {
  return (
    <PolicyDocument
      eyebrow="Terms"
      title="Terms and conditions"
      lede={`These terms cover orders placed with ${STORE_NAME}, an individually operated shop run by ${PROPRIETOR_NAME}, through ${STORE_ORIGIN}. They are written for customers in India buying physical shawls.`}
    >
      <PolicySection id="orders" title="Orders">
        <p>
          You can check out as a guest or with an account. The account can use an email and password or Google sign-in. Placing an order asks the shop to reserve the shawls in the bag. The shop accepts the order as a paid order only after its server confirms the Razorpay payment. Closing the payment window, or returning to this website, does not by itself mark an order paid.
        </p>
        <p>The checkout presently running on this website opens Razorpay in test mode and does not take live payments. A later switch to live payments will still depend on that server confirmation.</p>
      </PolicySection>
      <PolicySection id="catalogue" title="Descriptions, price, and stock">
        <p>
          Shawl names, photographs, and descriptions are the catalogue text. Prices are in Indian rupees. The amount you pay is calculated on the server from the catalogue. A price typed in the browser is not used. Standard shipping is free, as the{" "}
          <Link href="/shipping-policy" className="text-forest underline decoration-gold underline-offset-4">
            shipping policy
          </Link>{" "}
          explains. Checkout does not add a separate tax line. The seller states that the business is not registered for GST. These terms do not say that every supply is tax-exempt. Whether any tax is due should be confirmed with a qualified adviser.
        </p>
        <p>
          The quantity shown in the catalogue is not a verified warehouse count. If the shawl is no longer available when the order is placed, the shop does not reserve it and does not take payment for it. An unpaid order holds the reserved quantity for 30 minutes. If the payment is not confirmed in that time, and a payment is not still being checked, the hold ends and the order is cancelled.
        </p>
      </PolicySection>
      <PolicySection id="payment" title="Payment">
        <p>
          Payment is processed by Razorpay. {STORE_NAME} does not receive or store the full card number or card security code. A failed or closed payment leaves the order unpaid. You can try the same reserved order again while the hold is still open.
        </p>
      </PolicySection>
      <PolicySection id="cancellation" title="Cancellation, damage, and support">
        <p>
          There is no button on this website for a customer to cancel a paid order. An unpaid order ends when the 30-minute hold ends, as described above. Delivery is expected in about 7 days and is not guaranteed. A shawl that arrives damaged or defective should be reported within 7 days after delivery. When {STORE_NAME} accepts that claim, {STORE_NAME} pays the return-shipping cost. The{" "}
          <Link href="/refund-policy" className="text-forest underline decoration-gold underline-offset-4">
            refund and cancellation policy
          </Link>{" "}
          explains what to send with the report.
        </p>
        <p>
          Where the Consumer Protection Act, 2019 applies, the remedies that Act provides remain available. These terms do not replace a remedy the Act requires.
        </p>
      </PolicySection>
      <PolicySection id="law" title="Law">
        <p>
          {PROPRIETOR_NAME} states {BUSINESS_ADDRESS} as the place of business. These terms are governed by the laws of India.
        </p>
      </PolicySection>
    </PolicyDocument>
  );
}
