import React from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3 text-sm md:text-base">{children}</div>
  </div>
);

export default function Terms() {
  return (
    <div className="min-h-screen bg-background" data-testid="terms-page">
      <header className="border-b border-border bg-matte-900">
        <div className="container mx-auto px-4 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-secondary" data-testid="terms-home-link">
            <Package className="h-6 w-6 text-gold-500" />
            <span className="font-heading text-xl font-bold">IslandHop</span>
          </Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-gold-500 flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-foreground mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-10 text-sm">Last updated: June 2026</p>

        <Section title="1. Acceptance of Terms">
          <p>These Terms of Service ("Terms") govern your access to and use of the IslandHop platform, mobile
          application, and website (the "Service"). By creating an account or using the Service, you agree to be
          bound by these Terms. If you do not agree, do not use the Service.</p>
        </Section>

        <Section title="2. The Service">
          <p>IslandHop is a technology platform that connects customers with independent drivers, restaurants,
          merchants, and service professionals for on-demand delivery, taxi, courier, grocery, pharmacy, and
          related logistics services across Trinidad &amp; Tobago and the Caribbean. IslandHop facilitates these
          connections and payments but is not itself a transportation or delivery carrier.</p>
        </Section>

        <Section title="3. Accounts &amp; Eligibility">
          <p>You must be at least 18 years old and provide accurate, complete registration information. You are
          responsible for safeguarding your account credentials and for all activity under your account. You may
          select a role (customer, driver, merchant) and certain roles require additional verification.</p>
        </Section>

        <Section title="4. Customer Terms">
          <p>Customers may place orders, pay via supported methods (card, wallet, PayPal, WiPay, or cash where
          available), and track deliveries. Prices, delivery fees, and applicable taxes are shown before checkout.
          You agree to provide accurate delivery details and to be available to receive your order.</p>
        </Section>

        <Section title="5. Driver Terms">
          <p>Drivers operate as independent contractors, not employees of IslandHop. Drivers must hold a valid
          driver's licence, vehicle registration and insurance where required, and pass IslandHop's verification.
          Drivers are responsible for their own taxes, vehicle costs, and compliance with local laws. IslandHop may
          suspend or remove drivers for safety violations, fraud, low ratings, or breach of these Terms. Earnings,
          incentives, and payout schedules are described in the driver dashboard and may change with notice.</p>
        </Section>

        <Section title="6. Merchant Terms">
          <p>Merchants are responsible for the accuracy of their listings, pricing, availability, food safety,
          licensing, and quality of goods. IslandHop charges service/commission fees as agreed during onboarding.
          Merchants must fulfil accepted orders promptly and comply with applicable regulations.</p>
        </Section>

        <Section title="7. Payments, Wallet &amp; Payouts">
          <p>Payments are processed by third-party processors (Stripe, PayPal, WiPay). The IslandHop Wallet lets
          users hold balances, fund deposits, and request withdrawals. Withdrawals and driver/merchant payouts may
          be subject to review, verification, minimum thresholds, and processing times. You authorise IslandHop to
          deduct applicable fees, commissions, and refunds from relevant balances.</p>
        </Section>

        <Section title="8. Cancellations &amp; Refunds">
          <p>Cancellation and refund eligibility depends on order status and the reason for cancellation. Refunds,
          where granted, are returned to the original payment method or wallet. Abuse of cancellations or refunds
          may result in account restrictions.</p>
        </Section>

        <Section title="9. Acceptable Use">
          <p>You agree not to misuse the Service, including: violating laws; harassing drivers, merchants, or
          staff; submitting false information; attempting to defraud the platform; reverse-engineering the app; or
          interfering with its operation. We may suspend or terminate accounts that breach these Terms.</p>
        </Section>

        <Section title="10. Disclaimers &amp; Limitation of Liability">
          <p>The Service is provided "as is" without warranties of any kind. IslandHop is not liable for the acts
          or omissions of independent drivers or merchants. To the maximum extent permitted by law, IslandHop's
          aggregate liability is limited to the amounts you paid for the order giving rise to the claim. We are not
          liable for indirect, incidental, or consequential damages.</p>
        </Section>

        <Section title="11. Indemnification">
          <p>You agree to indemnify and hold harmless IslandHop and its affiliates from claims arising out of your
          use of the Service, your content, or your violation of these Terms or applicable law.</p>
        </Section>

        <Section title="12. Changes &amp; Termination">
          <p>We may modify the Service or these Terms at any time. Material changes will be notified in-app or by
          email. We may suspend or terminate your access for breach. You may stop using the Service at any time.</p>
        </Section>

        <Section title="13. Governing Law">
          <p>These Terms are governed by the laws of Trinidad &amp; Tobago. Disputes are subject to the exclusive
          jurisdiction of its courts.</p>
        </Section>

        <Section title="14. Contact">
          <p>Questions about these Terms? Contact <a className="text-gold-500 hover:underline" href="mailto:support@islandhoptt.com">support@islandhoptt.com</a>.</p>
        </Section>

        <p className="text-xs text-muted-foreground border-t border-border pt-6">
          See also our <Link to="/privacy-policy" className="text-gold-500 hover:underline">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}
