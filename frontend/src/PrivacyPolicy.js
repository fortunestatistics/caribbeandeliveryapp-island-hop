import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3 text-sm md:text-base">{children}</div>
  </div>
);

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background" data-testid="privacy-policy-page">
      <header className="border-b border-border bg-matte-900">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-secondary" data-testid="privacy-home-link">
            <Package className="h-6 w-6 text-gold-500" />
            <span className="font-heading text-xl font-bold">IslandHop</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-gold-500 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-10 text-sm">Last updated: June 2026</p>

        <Section title="1. Introduction">
          <p>IslandHop ("IslandHop", "we", "us", or "our") operates an on-demand logistics and delivery
          platform connecting customers with drivers, restaurants, merchants, and service professionals across
          Trinidad &amp; Tobago and the wider Caribbean (the "Service"). This Privacy Policy explains how we collect,
          use, disclose, and safeguard your information when you use our mobile application and website.</p>
          <p>By using the Service, you agree to the collection and use of information in accordance with this policy.</p>
        </Section>

        <Section title="2. Information We Collect">
          <p><strong>Account &amp; profile data:</strong> name, email address, phone number, password (hashed),
          profile photo, and user role (customer, driver, merchant, or admin).</p>
          <p><strong>Location data:</strong> precise GPS location for customers (delivery addresses) and drivers
          (real-time tracking during active trips), used to match, route, and track orders.</p>
          <p><strong>Order &amp; transaction data:</strong> order details, delivery addresses, items, prices,
          wallet balances, and payment records.</p>
          <p><strong>Payment data:</strong> processed securely by third-party processors (Stripe, PayPal, WiPay).
          We do not store full card numbers on our servers.</p>
          <p><strong>Driver/merchant onboarding data:</strong> vehicle details, identification documents, business
          registration, and banking/payout information required for verification and payouts.</p>
          <p><strong>Device &amp; usage data:</strong> device identifiers, app version, log data, and analytics.</p>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use your information to: create and manage your account; match customers with drivers and
          merchants; process orders, payments, and payouts; provide real-time tracking; send transactional and
          service notifications (via SMS, WhatsApp, email, and push); verify driver and merchant eligibility;
          prevent fraud and abuse; provide customer support; and comply with legal obligations.</p>
        </Section>

        <Section title="4. Location Data">
          <p>Driver location is collected in the background only while a driver is online/on an active trip, to
          enable order matching, navigation, live tracking, and safety. Customers may share location to set
          delivery points. You can disable location permissions in your device settings, though this will limit
          core functionality of the Service.</p>
        </Section>

        <Section title="5. Sharing &amp; Disclosure">
          <p>We share information only as needed to operate the Service: with the driver/merchant fulfilling your
          order (limited to what is necessary, e.g., name, delivery location, order details); with payment
          processors; with service providers (cloud hosting, messaging via Twilio, email via Microsoft 365); and
          where required by law or to protect rights and safety. We do not sell your personal information.</p>
        </Section>

        <Section title="6. Data Retention &amp; Security">
          <p>We retain personal data for as long as your account is active or as needed to provide the Service and
          comply with legal, tax, and accounting obligations. We apply industry-standard safeguards including
          encrypted transport (HTTPS), hashed passwords, and access controls. No method of transmission or storage
          is 100% secure.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>You may access, update, or request deletion of your personal data, and opt out of non-essential
          communications. To exercise these rights, contact us at the address below. Deleting your account may
          remove access to historical orders and wallet balances subject to applicable law.</p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>The Service is not directed to individuals under 18. We do not knowingly collect data from children.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. Material changes will be notified within the app
          or by email. Continued use of the Service after changes constitutes acceptance.</p>
        </Section>

        <Section title="10. SMS, WhatsApp &amp; Mobile Information">
          <p className="font-semibold text-foreground">No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All other categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.</p>
          <p>With your consent, IslandHop uses Twilio to send transactional and service messages by SMS and WhatsApp — including one-time passcodes (OTP), order confirmations, driver and delivery status updates, and account alerts. Consent to receive these messages is collected when you provide your mobile number at sign-up or in your profile.</p>
          <p>Message and data rates may apply and message frequency varies. You can opt out of text messages at any time by replying <strong>STOP</strong>; reply <strong>HELP</strong> for assistance. Opting out may limit service notifications such as delivery tracking. See our <Link to="/terms-and-conditions" className="text-gold-500 hover:underline">Terms &amp; Conditions</Link> for full messaging terms.</p>
        </Section>

        <Section title="11. Contact Us">
          <p>For privacy questions or requests, contact <a className="text-gold-500 hover:underline" href="mailto:support@islandhoptt.com">support@islandhoptt.com</a>.
          IslandHop is operated under the laws of Trinidad &amp; Tobago.</p>
        </Section>

        <p className="text-xs text-muted-foreground border-t border-border pt-6">
          See also our <Link to="/terms-and-conditions" className="text-gold-500 hover:underline">Terms &amp; Conditions</Link>.
        </p>
      </main>
    </div>
  );
}
