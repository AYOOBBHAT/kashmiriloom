import type { Metadata } from "next";
import Link from "next/link";
import { PolicyDocument, PolicySection, SupportChannels } from "@/components/policy-document";
import { policyUrl, PROPRIETOR_NAME, STORE_NAME, STORE_ORIGIN, SUPPORT_EMAIL } from "@/lib/site/policies";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${STORE_NAME} uses names, contact details, delivery addresses, account records, and order records.`,
  alternates: { canonical: policyUrl("/privacy-policy") },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyDocument
      eyebrow="Privacy"
      title="Privacy policy"
      lede={`${STORE_NAME} is an individually operated shop for Kashmiri shawls at ${STORE_ORIGIN}, run by ${PROPRIETOR_NAME}. This page describes the customer information the shop collects and why.`}
    >
      <PolicySection id="who" title="Who this page is about">
        <p>
          The shop name on this website is {STORE_NAME}. {PROPRIETOR_NAME} runs it as an individual seller and is the person to contact about privacy and grievances. The seller states that the business is not registered for GST. Write to{" "}
          <a className="text-forest underline decoration-gold underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          or use the telephone or WhatsApp number on the{" "}
          <Link href="/contact" className="text-forest underline decoration-gold underline-offset-4">
            contact page
          </Link>
          .
        </p>
        <SupportChannels />
      </PolicySection>
      <PolicySection id="collected" title="Information the shop collects">
        <p>Checkout asks for the name, email address, telephone number, and delivery address of the person receiving the shawl. Delivery addresses are collected for India.</p>
        <p>
          An account is optional. If you create one, the shop stores your name, a normalised email address, and a password hash produced with Argon2id. The password itself is not stored. The account also records whether the email was confirmed by Google. You can sign in without that confirmation.
        </p>
        <p>
          Google sign-in, when it is used, sends the shop the Google subject identifier, the email address, and whether Google says that email is verified. The shop uses the Google subject, not the email alone, to recognise a returning Google customer. A matching email does not by itself attach Google to a password account.
        </p>
        <p>
          An order stores the shawl names, quantities, catalogue prices, the amount charged, payment status, fulfilment status, and the contact and address given at checkout. When Razorpay is used, the shop stores the Razorpay order id and, after the server confirms a payment, the Razorpay payment id. It does not store the full card number, expiry date, or card security code. Those details are entered in Razorpay Checkout, which is operated by Razorpay.
        </p>
        <p>
          Guest checkout does not require an account. The confirmation page shows the contact and address for that order only when the browser still has the view cookie from that checkout. A signed-in customer’s order history is limited to orders stored against that account. It does not include another customer’s address or telephone number.
        </p>
        <p>
          The bag is kept in the browser’s local storage. A customer session cookie lasts up to 14 days and is readable only by the server. Google sign-in uses a short-lived cookie for the sign-in state. Password-reset links are single-use. The shop stores a hash of the reset token, not the token itself. Reset messages are sent through Resend when that service is configured. The homepage note does not save or send the address typed into it.
        </p>
        <p>
          The shop also uses the network address supplied by its host, when that address is trustworthy, to limit repeated sign-in, registration, password-reset, and checkout attempts. It does not use a customer-supplied forwarding header as that address.
        </p>
      </PolicySection>
      <PolicySection id="why" title="Why it is collected">
        <p>The shop uses this information to reserve shawls, take payment through Razorpay, prepare delivery, show an order to the person who placed it, run optional accounts, and send a password-reset message when one is requested.</p>
        <p>Razorpay processes the payment. Resend delivers the reset message. {STORE_NAME} does not sell customer lists.</p>
      </PolicySection>
      <PolicySection id="protection" title="How it is protected">
        <p>
          Passwords, session tokens, and reset tokens are stored as hashes. Payment secrets, the Google client secret, and the Resend key stay on the server. Account and order pages are not offered from a shared cache of another customer’s details. These measures reduce ordinary exposure. They are not a promise that information cannot be lost, intercepted, or misused.
        </p>
      </PolicySection>
      <PolicySection id="requests" title="Your requests">
        <p>
          You can see the email on your account, and the orders placed while signed in, from the account pages. For a correction, a deletion request, or a grievance about personal information, write to {PROPRIETOR_NAME} at{" "}
          <a className="text-forest underline decoration-gold underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
          . The shop keeps order and account records so it can fulfil orders, answer payment questions, and handle a report of a damaged or defective shawl. Nothing here removes a right you have under Indian law, including the Digital Personal Data Protection Act, 2023, where that Act applies.
        </p>
      </PolicySection>
    </PolicyDocument>
  );
}
