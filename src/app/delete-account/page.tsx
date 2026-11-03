import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, List, PLAY_NAME, SUPPORT_EMAIL, Section, SupportLink, linkClass } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Delete your account — Catalyst",
  description: "How to delete your Catalyst account and everything in it, with or without the app.",
};

// Google Play's account deletion link: how to delete an account without the
// Android app, what goes and what stays.
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your account" updated="November 4, 2026">
      <p>
        This page is for Catalyst, the money and mood tracker — this website and the Android app ({PLAY_NAME} on Google
        Play), which share one account. You can delete your account and everything in it at any time, with or without the
        app.
      </p>

      <Section title="On the website (no app needed)">
        <List>
          <li>
            <Link href="/login?from=landing" className={linkClass}>
              Log in
            </Link>{" "}
            with the email and password of the account — or with Continue with Google, if that&apos;s how you signed up.
            Lost the password? Use Forgot password on the login page.
          </li>
          <li>Open Settings → Account.</li>
          <li>Under Delete account, press Delete…, type DELETE and press Delete my account.</li>
        </List>
      </Section>

      <Section title="In the Android app">
        <List>
          <li>Open Settings → Account.</li>
          <li>Under Delete account, tap Delete…, type DELETE and tap Delete my account.</li>
        </List>
        <p>Either way, the account is deleted straight away and you&apos;re signed out.</p>
      </Section>

      <Section title="Can't log in?">
        {SUPPORT_EMAIL ? (
          <p>
            Email <SupportLink /> from the address you signed up with and ask for the account to be deleted. We&apos;ll
            delete it and write back when it&apos;s done.
          </p>
        ) : (
          <p>
            Open an issue at <SupportLink /> asking for your account to be deleted — don&apos;t post your email address
            there. We&apos;ll reply with a private way to show the account is yours, then delete it and tell you when
            it&apos;s done.
          </p>
        )}
      </Section>

      <Section title="What's deleted">
        <List>
          <li>
            Your account: the email address and password, or the link to your Google account and the name and picture
            Google shared.
          </li>
          <li>
            Everything you entered: transactions, moods and their tags, notes, journal entries and habits, budgets, goals,
            bills, recurring entries, wallets and transfers, dhar records, challenges and your to-do and to-buy boards.
          </li>
          <li>
            Your settings (language, currency, notifications, dashboard, zakat figures), saved AI summaries, browser
            reminder subscriptions and the daily counts of AI use.
          </li>
        </List>
        <p>It&apos;s all removed from our database at once and can&apos;t be undone.</p>
      </Section>

      <Section title="What's kept">
        <p>
          Nothing in the database. Copies can stay in our providers&apos; routine backups and short-lived server logs
          (such as Vercel&apos;s request logs with IP addresses) until those expire. Photos you scanned were never kept.
          On the phone, deleting the account signs you out, which removes the app&apos;s offline copy; uninstalling the app
          removes everything it stored.
        </p>
      </Section>

      <Section title="Keep the account, delete the data">
        <p>
          To start fresh instead, use Settings → Account → Erase my data, on the website or in the app: every entry,
          wallet, bill, board and note goes; your login and settings stay.
        </p>
      </Section>

      <p>
        More about what we keep and why: the{" "}
        <Link href="/privacy" className={linkClass}>
          Privacy Policy
        </Link>
        .
      </p>
    </LegalPage>
  );
}
