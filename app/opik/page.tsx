import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, FlaskConical, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "How we use Opik – deepwork.ai",
  description:
    "How deepwork.ai uses Opik (Comet) for observability, evaluation, and systematic improvement of our focus coach.",
};

export default function OpikPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold text-[var(--foreground)] mb-2">
          How we improved the system using Opik
        </h1>
        <p className="text-lg text-[var(--muted)] mb-12">
          We use <strong className="text-foreground">Opik by Comet</strong> for observability, evaluation, and
          systematic improvement of our focus coach. Here’s how it works.
        </p>

        <section className="space-y-8">
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">
                Observability
              </h2>
            </div>
            <p className="text-[var(--foreground)]/90 mb-3">
              Every LLM call in the app is traced to Opik. When you talk to the <strong>Coach</strong> or
              generate a <strong>Weekly report</strong>, we create a trace with the user message, the model
              request, and the reply. Each OpenRouter call (including tool-use rounds in the coach) is logged
              as a child span.
            </p>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FlaskConical className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">
                Evaluation
              </h2>
            </div>
            <p className="text-[var(--foreground)]/90 mb-3">
              We defined evaluation datasets and run evaluations that log to Opik. For the <strong>Coach</strong>,
              we have 8 test cases: general advice, data-specific questions (e.g. “How did I do this week?”),
              and cases where we give no data so the coach should ask to clarify. For the <strong>Weekly
              summary</strong>, we have 3 synthetic weeks. We score outputs with <strong>AnswerRelevance</strong>:
              does the answer address the question?
            </p>

          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h2 className="font-heading text-xl font-semibold text-[var(--foreground)]">
                Systematic improvement
              </h2>
            </div>
            <p className="text-[var(--foreground)]/90 mb-3">
              We use Opik evaluation to show <strong>before vs after</strong>. We run the same coach eval
              with two prompts: a deliberately weak “regression” prompt (generic assistant, no focus rules) and
              our real focus-agent prompt. The regression run gets lower AnswerRelevance scores; the baseline
              run gets higher scores. In Opik we compare the two experiments to see the improvement.
            </p>
          </div>
        </section>

        <div className="mt-14 pt-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-sm text-[var(--muted)]">
            Opik is by{" "}
            <a
              href="https://www.comet.com/site/products/opik/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-primary"
            >
              Comet
            </a>
            . We use it for the hackathon to demonstrate excellent observability, evaluation, and
            data-driven improvement of our focus app.
          </p>
        </div>
      </main>
    </div>
  );
}
