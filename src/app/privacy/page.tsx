import type { Metadata } from "next";
import Link from "next/link";
import { Contact, LegalPage, List, PLAY_NAME, Section, linkClass } from "@/components/landing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Catalyst",
  description: "What Catalyst keeps, why, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="November 4, 2026">
      <p>
        Catalyst is a money and mood tracker: this website and an Android app ({PLAY_NAME} on Google Play) that share
        one account. This page explains what we keep, why, and the choices you have.
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
            entries, habits, budgets, goals, bills, wallets, transfers, dhar records, challenges and your to-do and to-buy
            boards. Recurring incomes and expenses are kept with the time zone they were set up in, so our server can add
            each one to your ledger at its time.
          </li>
          <li>
            <strong className="text-ink">Your settings</strong> — language, currency, which notifications you get,
            dashboard sections and the figures you enter in the zakat calculator, kept with your account so the website
            and the app match.
          </li>
          <li>
            <strong className="text-ink">AI summaries</strong> — summaries you ask for are saved to your account, so they
            show again without being rewritten.
          </li>
          <li>
            <strong className="text-ink">Browser reminders</strong> — if you turn on notifications in a browser, we keep
            that browser&apos;s push address, its keys and its time zone, only to send your reminders and alerts.
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
            <strong className="text-ink">bKash / Nagad messages</strong> — when you share a message to the app (or
            paste one in Settings), it&apos;s read on the phone to suggest an entry. The app has no permission to read
            your SMS; messages are never uploaded, and only the entries you choose to add are saved.
          </li>
          <li>
            Your login is kept in storage that Android encrypts with the phone&apos;s keystore.
          </li>
          <li>
            The app from Google Play is updated by Google Play. The app from GitHub asks GitHub for the latest version to
            tell you about updates, so GitHub sees that request.
          </li>
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
          <li><strong className="text-ink">Google Play</strong> — installs and updates the Android app.</li>
          <li><strong className="text-ink">GitHub</strong> — Android app downloads outside Google Play, and their update checks.</li>
        </List>
        <p>
          They handle data only to provide their part of Catalyst. We don&apos;t share your data with anyone else, unless
          the law requires it.
        </p>
      </Section>

      <Section title="Keeping it safe">
        <p>
          Everything between the apps and our servers travels encrypted (HTTPS), and the database is encrypted where it&apos;s
          stored. Each record is locked to its account in the database, so no other user can read it.
        </p>
      </Section>

      <Section title="How long we keep it">
        <p>
          As long as you have an account. An entry you delete is gone at once; deleting your account removes it and
          everything in it. Copies can stay in our providers&apos; routine backups and short-lived server logs until those
          expire.
        </p>
      </Section>

      <Section title="Your choices">
        <List>
          <li>Change or delete any entry at any time.</li>
          <li>Erase all your data but keep the account: Settings → Account → Erase my data.</li>
          <li>
            Delete your account in Settings → Account → Delete account, on the website or in the app. It removes your account
            and everything in it, permanently — the{" "}
            <Link href="/delete-account" className={linkClass}>
              Delete your account
            </Link>{" "}
            page shows how, even without the app.
          </li>
          <li>Turn reminders and browser notifications on or off in Settings.</li>
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
