import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, Section } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service — Catalyst",
  description: "The terms for using Catalyst, the website and the Android app.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 18, 2026">
      <p>By using Catalyst — this website and the Android app — you agree to these terms.</p>

      <Section title="What Catalyst is">
        <p>
          A personal tool to record your money and your moods. It isn&apos;t financial, medical or other professional
          advice. AI summaries, amounts read from photos and suggestions from bKash / Nagad messages can be wrong — check
          them before you rely on them.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          Keep your password safe; you&apos;re responsible for what happens in your account. Use an email address you can
          reach, so you can reset your password.
        </p>
      </Section>

      <Section title="Your data">
        <p>
          What you enter is yours. We store and use it only to run Catalyst, as the{" "}
          <Link href="/privacy" className="text-amber underline underline-offset-2 hover:text-amber/80">
            Privacy Policy
          </Link>{" "}
          explains, and you can delete it at any time in Settings → Delete account.
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Don&apos;t use Catalyst to break the law, try to reach other people&apos;s data, overload or attack the service,
          or get around the daily limits on the AI features.
        </p>
      </Section>

      <Section title="Free and as is">
        <p>
          Catalyst is free and provided as is, without warranties of any kind. Features can change, and the service can be
          interrupted or stopped. Keep your own copy of anything important.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          As far as the law allows, we aren&apos;t liable for losses that come from using Catalyst — including wrong
          figures, lost data or missed reminders.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms; the date at the top shows the latest version. Using Catalyst after a change means you
          accept the new terms.
        </p>
      </Section>

      <Section title="Contact">
        <Contact />
      </Section>
    </LegalPage>
  );
}
