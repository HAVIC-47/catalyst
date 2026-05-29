import { Eye, Brain, Compass } from "lucide-react";

const WHY = [
  {
    icon: Eye,
    title: "See the pattern",
    body: "Spending alone tells half the story. Catalyst draws the other half — the mood underneath each transaction — so the trigger stops hiding.",
  },
  {
    icon: Brain,
    title: "Catch yourself before you spend",
    body: "When you can see that low-mood Sundays cost ৳2,400 in impulse buys, you stop guessing. The next Sunday, you decide differently.",
  },
  {
    icon: Compass,
    title: "Your money, your terms",
    body: "Custom categories, custom activities, your own goals and budgets. No preset can describe your life — Catalyst lets you shape it.",
  },
];

export function Why() {
  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <div className="label mb-3">Why Catalyst</div>
          <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Most trackers count taka. <br className="hidden sm:block" />
            <span className="serif-italic text-amber/90">Catalyst counts you.</span>
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {WHY.map((w) => {
            const Icon = w.icon;
            return (
              <div key={w.title} className="rounded-2xl border border-line bg-card p-7">
                <Icon className="mb-5 h-6 w-6 text-amber" aria-hidden />
                <h3 className="font-display text-xl font-semibold text-ink">{w.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink/55">{w.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
