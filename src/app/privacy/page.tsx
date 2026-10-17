import type { Metadata } from "next";
import { Contact, LegalPage, List, Section } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Catalyst",
  description: "What Catalyst keeps, why, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 18, 2026">
      <p>
        Catalyst is a money and mood tracker: this website and an Android app that share one account. This page explains
        what we keep, why, and the choices you have.
      </p>

      <Section title="What we keep">
        <List>
          <li>
            <strong className="text-ink">Your account</strong> — your email address and password (stored only as a secure
            hash by our sign-in provider) or, if you use Continue with Google, the name, email address and profile picture
            Google shares with us.
          </li>
          <li>
            <strong className="text-ink">What you enter</strong> — transactions, moods and their tags, notes, journal
            entries, habits, budgets, goals, bills, wallets, transfers, dhar records and your to-do and to-buy boards.
          </li>
          <li>
            <strong className="text-ink">Your settings</strong> — language, currency, reminder settings and dashboard
            sections, kept with your account so the website and the app match.
          </li>
          <li>
            <strong className="text-ink">AI summaries</strong> — summaries you ask for are saved to your account, so they
            show again without being rewritten.
          </li>
          <li>
            <strong className="text-ink">Browser reminders</strong> — if you turn on notifications in a browser, we keep
            that browser&apos;s push address, its keys and its time zone, only to send your reminders.
          </li>
          <li>
            <strong className="text-ink">Daily limits</strong> — a count of how many photos and summaries your account used
            each day (no content), so the free AI features can&apos;t be overused.
          </li>
        </List>
        <p>
          We use all of this only to run Catalyst for you. We don&apos;t show ads, sell or rent your data, or use tracking
          or analytics tools. Every record is locked to your account in the database, so no other user can see it.
        </p>
      </Section>

      <Section title="Photos and AI">
        <p>
          When you scan a memo, a receipt, a screenshot of your notes or a list, the photo is sent from our server to
          Google&apos;s Gemini AI, which reads it. We don&apos;t keep the photo — you check what was found, and only the
          entries you add are saved.
        </p>
        <p>
          When you ask for an AI summary or recap, a digest of your entries for that period — amounts, categories, moods
          and the text of the notes, journal entries and tickets in it — is sent to Gemini to write the summary. Google
          processes this data under the{" "}
          <a href="https://ai.google.dev/gemini-api/terms" className="text-amber underline underline-offset-2 hover:text-amber/80">
            Gemini API terms
          </a>
          .
        </p>
      </Section>

      <Section title="On your phone (Android app)">
        <List>
          <li>A copy of your data is kept on the phone so the app works offline. It&apos;s removed when you sign out.</li>
          <li>Reminders are scheduled on the phone itself.</li>
          <li>
            <strong className="text-ink">bKash / Nagad messages</strong> — only if you turn this on in Settings, the app
            reads confirmation messages from those two senders on the phone to suggest entries. The messages are never
            uploaded; only the entries you choose to add are saved.
          </li>
          <li>To tell you about updates, the app asks GitHub for the latest version, so GitHub sees that request.</li>
        </List>
      </Section>

      <Section title="Cookies and browser storage">
        <p>
          The website uses a sign-in cookie to keep you logged in, and stores a few preferences in your browser (theme,
          language, currency, reminder settings and Vault Mode). There are no advertising or tracking cookies.
        </p>
      </Section>

      <Section title="Services that help run Catalyst">
        <List>
          <li><strong className="text-ink">Supabase</strong> — the database, sign-in, and account emails.</li>
          <li><strong className="text-ink">Vercel</strong> — hosts the website and keeps short-lived request logs, such as IP addresses.</li>
          <li><strong className="text-ink">Google</strong> — Gemini AI for photos and summaries, and Google sign-in if you use it.</li>
          <li><strong className="text-ink">GitHub</strong> — Android app downloads and update checks.</li>
        </List>
      </Section>

      <Section title="Your choices">
        <List>
          <li>Change or delete any entry at any time.</li>
          <li>
            Delete your account in Settings → Delete account (on the website or in the app). It removes your account and
            everything in it, permanently.
          </li>
          <li>Turn reminders, browser notifications and bKash / Nagad messages on or off in Settings.</li>
        </List>
      </Section>

      <Section title="Children">
        <p>Catalyst isn&apos;t meant for children under 13.</p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes, we&apos;ll update this page and the date at the top.</p>
      </Section>

      <Section title="Contact">
        <Contact />
      </Section>
    </LegalPage>
  );
}
