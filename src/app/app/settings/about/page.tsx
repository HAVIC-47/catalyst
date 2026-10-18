"use client";

// About the app (Settings → About the app): everything Catalyst does on the web.
// The Android app lists its own features, with what's new after each update.
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarDays,
  Flame,
  HandHeart,
  LineChart,
  Repeat,
  ClipboardPaste,
  Coins,
  HandCoins,
  KeyRound,
  Languages,
  LayoutGrid,
  ListTodo,
  MonitorSmartphone,
  NotebookPen,
  PiggyBank,
  Plus,
  Receipt,
  RefreshCw,
  ScanLine,
  ScanText,
  ShieldCheck,
  SlidersHorizontal,
  Smile,
  Sparkles,
  SunMoon,
  Target,
  UserX,
  Vault,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAppData } from "@/hooks/use-app-data";
import { Logo } from "@/components/ui/logo";
import { tr } from "@/lib/i18n";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
}

interface Group {
  title: string;
  accent: string;
  features: Feature[];
}

const GOOGLE = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN === "on";

// Built at render, so the text follows the language.
function groups(): Group[] {
  return [
    {
      title: tr("Money"),
      accent: tr("& entries"),
      features: [
        { icon: Plus, title: tr("Quick entry"), body: tr("Expense, income, savings or a mood in a few clicks — each with a time, place and note.") },
        {
          icon: Receipt,
          title: tr("Ledger"),
          body: tr('Every entry by day, with search (even "october" or "monday") and filters. The pen on any entry changes or deletes it — every total follows.'),
        },
        {
          icon: ScanLine,
          title: tr("Memo scanner"),
          body: tr("Upload a photo of a memo or receipt, or a screenshot of your notes: its lines become entries for you to check. Reads Bengali and English, printed or handwritten."),
        },
        {
          icon: Wallet,
          title: tr("Wallets"),
          body: tr("Cash, bKash, Nagad and Bank to start. See what's in each; transfers move money between them without counting as spending."),
        },
        {
          icon: Bell,
          title: tr("Bills"),
          body: tr("Due dates, repeats and overdue warnings. Tick a bill when you pay it: the expense is logged and the bill moves to its next date."),
        },
        {
          icon: Repeat,
          title: tr("Recurring income and expenses"),
          body: tr("Salary on the 1st, rent, subscriptions: set the day (once or twice a month, weekly…) and the time, and each one is added by itself — with a notification."),
        },
        { icon: PiggyBank, title: tr("Budgets"), body: tr("Monthly limits per category that fill up as you spend, with alerts at 80% and 100%.") },
        { icon: Target, title: tr("Goals"), body: tr("Savings targets with progress bars and quick additions.") },
        { icon: HandCoins, title: tr("Dhar / baki"), body: tr("Money you lent or borrowed, per person: part payments, settle in full or write off.") },
        { icon: Vault, title: tr("Vault Mode"), body: tr("Count every income and expense against your savings pool.") },
        { icon: LineChart, title: tr("Net worth"), body: tr("Wallets plus what you're owed, minus what you owe — month by month on the dashboard.") },
        { icon: HandHeart, title: tr("Zakat calculator"), body: tr("Wallets and dhar come in by themselves; add gold, silver and the rest to see the nisab and the 2.5% due.") },
      ],
    },
    {
      title: tr("Mood"),
      accent: tr("& days"),
      features: [
        { icon: Smile, title: tr("Mood check-in"), body: tr("Five moods, with what the day was about — work, family, travel…") },
        {
          icon: CalendarDays,
          title: tr("Calendar"),
          body: tr("Week, month and year views. Every day is tinted by its mood and its money; click one to log."),
        },
        { icon: NotebookPen, title: tr("Journal"), body: tr("A daily log with a mood, plus habits to tick off each day.") },
        {
          icon: Flame,
          title: tr("Streaks and challenges"),
          body: tr("A streak for every day you log something, and challenges like no-spend days or spending under an amount — with notifications."),
        },
        { icon: Smile, title: tr("Mood-spend alerts"), body: tr("A heads-up when a low day comes with a lot more spending than usual.") },
        {
          icon: LayoutGrid,
          title: tr("Dashboard"),
          body: tr("The month at a glance: spent, earned, saved, average mood, the mood × money trend and charts by category."),
        },
      ],
    },
    {
      title: tr("Lists"),
      accent: tr("& plans"),
      features: [
        {
          icon: ListTodo,
          title: tr("To-do and To buy"),
          body: tr("Boards with columns and numbered tickets — priority, due dates, notes and prices. Drag with the mouse, by touch or from the keyboard."),
        },
        {
          icon: ScanText,
          title: tr("Lists from a screenshot"),
          body: tr("On a board, Scan a list adds every item from a screenshot or photo of a list — ticked items land as done, with Undo."),
        },
      ],
    },
    {
      title: tr("AI"),
      accent: tr("& insights"),
      features: [
        {
          icon: Sparkles,
          title: tr("AI summaries"),
          body: tr("A weekly, monthly or yearly read of your money, mood, journal, goals, bills and boards — with suggestions."),
        },
        { icon: CalendarCheck, title: tr("AI monthly recap"), body: tr("The month in one read on the dashboard, with what to do differently next time.") },
      ],
    },
    {
      title: tr("On the"),
      accent: tr("web"),
      features: [
        {
          icon: BellRing,
          title: tr("Reminders"),
          body: tr("The reminders bar shows what's due; turn on browser notifications in Settings → Notifications, and turn off any kind you don't want."),
        },
        {
          icon: ClipboardPaste,
          title: tr("Paste a screenshot"),
          body: tr("On a computer, paste a screenshot (Ctrl+V) into the memo or list scanner — or drop an image on the memo scanner."),
        },
        { icon: MonitorSmartphone, title: tr("Any screen"), body: tr("A sidebar on a computer, a bottom bar on a phone — the same pages everywhere.") },
      ],
    },
    {
      title: tr("Your"),
      accent: tr("way"),
      features: [
        { icon: Languages, title: "বাংলা", body: tr("The whole app in Bangla, with Bengali dates and digits.") },
        {
          icon: Coins,
          title: tr("Currency"),
          body: tr("Taka by default; switch to dollar, Canadian dollar, euro, rupee and more. Nothing is converted."),
        },
        { icon: SunMoon, title: tr("Dark and light"), body: tr("Dark by default — the sun / moon button switches.") },
        {
          icon: SlidersHorizontal,
          title: tr("Your dashboard"),
          body: tr("Choose which sections the dashboard shows — the Android app follows the same choice."),
        },
      ],
    },
    {
      title: tr("Account"),
      accent: tr("& sync"),
      features: [
        {
          icon: RefreshCw,
          title: tr("One account, two apps"),
          body: tr("The same login and the same data as the Android app — anything added on one shows up on the other."),
        },
        {
          icon: KeyRound,
          title: tr("Sign-in"),
          body: GOOGLE
            ? tr("Email and password or Google — and Forgot password if you lose it.")
            : tr("Email and password — and Forgot password if you lose it."),
        },
        { icon: ShieldCheck, title: tr("Private"), body: tr("Your entries are locked to your account — no one else can read them.") },
        { icon: UserX, title: tr("Delete account"), body: tr("Removes the account and everything in it, from Settings.") },
      ],
    },
  ];
}

export default function AboutPage() {
  useAppData(); // follow the language
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/app/settings"
        className="mb-5 inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {tr("Settings")}
      </Link>

      <div className="mb-6">
        <div className="label mb-2">{tr("About the app")}</div>
        <h1 className="font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {tr("Everything it")}{" "}<span className="serif-italic text-amber/90">{tr("does.")}</span>
        </h1>
      </div>

      <section className="card mb-6 flex items-center gap-4 p-5 sm:p-6">
        <Logo size={56} />
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-ink">{tr("Catalyst")}</h2>
          <p className="mt-1 max-w-xl text-sm text-ink/55">
            {tr("Mood × money: an honest ledger that maps every taka against how the day actually felt.")}
          </p>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {groups().map((g) => (
          <section key={g.title + g.accent} className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-xl font-semibold text-ink">
              {g.title}{" "}<span className="serif-italic text-amber/90">{g.accent}</span>
            </h2>
            <ul className="space-y-3.5">
              {g.features.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber/10 text-amber">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-ink/55">{body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
