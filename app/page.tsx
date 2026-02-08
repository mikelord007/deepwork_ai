import CoBuildButton from "./components/CoBuildButton";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Calendar, 
  Clock,
  Lightbulb,
  Play,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Zap
} from "lucide-react";

const stats = [
  { value: "4.9", label: "Average rating" },
  { value: "50k+", label: "Focus sessions" },
  { value: "94%", label: "See results in 7 days" },
  { value: "3h+", label: "Avg. deep work gained" }
];

const features = [
  {
    icon: Sparkles,
    title: "Customization",
    description: "Tailor focus modes to your work style—coding, writing, meetings, or creative flow."
  },
  {
    icon: Target,
    title: "Goals",
    description: "Set daily and weekly focus targets. Track streaks and celebrate wins."
  },
  {
    icon: Timer,
    title: "Sessions",
    description: "Structured focus blocks with smart breaks. Pomodoro or custom durations."
  },
  {
    icon: TrendingUp,
    title: "Insights",
    description: "See patterns in when and how you focus best. Data-driven recommendations."
  }
];

const advancedFeatures = [
  {
    title: "Focus Modes",
    description: "Create custom modes for different work types. Each with its own rules, blocklists, and goals.",
    image: "modes"
  },
  {
    title: "Smart Scheduling",
    description: "AI analyzes your calendar and suggests optimal focus windows. Protects your best hours.",
    image: "scheduling"
  },
  {
    title: "Session Coaching",
    description: "Real-time nudges when you drift. Gentle, not annoying. Learns what works for you.",
    image: "coaching"
  },
  {
    title: "Progress Tracking",
    description: "Weekly reports on focus density, distraction triggers, and improvements over time.",
    image: "progress"
  },
  {
    title: "Ritual Builder",
    description: "Design morning warm-ups and shutdown routines that bookend your deep work.",
    image: "rituals"
  }
];

const testimonials = [
  {
    quote: "deepwork.ai finally made me understand why some days I'm unstoppable and others I can't focus for 10 minutes. The patterns were eye-opening.",
    author: "Sarah K.",
    role: "Product Designer"
  },
  {
    quote: "As a founder, every hour matters. This tool helped me reclaim 2+ hours of real deep work every day. Worth every penny.",
    author: "Marcus T.",
    role: "Startup Founder"
  },
  {
    quote: "I've tried every productivity app. This is the first one that actually learns MY brain instead of forcing a system on me.",
    author: "Priya M.",
    role: "Software Engineer"
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Decorative blobs */}
      <div className="blob-purple w-96 h-96 -top-48 -right-48 fixed opacity-50" />
      <div className="blob-green w-64 h-64 top-1/3 -left-32 fixed opacity-30" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="w-9 h-9 flex-shrink-0" />
              <span className="font-heading font-semibold text-foreground">deepwork.ai</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-muted hover:text-foreground transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-muted hover:text-foreground transition-colors">How it works</a>
              <a href="#testimonials" className="text-sm text-muted hover:text-foreground transition-colors">Testimonials</a>
              <a href="#faq" className="text-sm text-muted hover:text-foreground transition-colors">FAQ</a>
            </div>

            <a href="/login" className="btn-secondary text-xs sm:text-sm px-3 sm:px-5">
              Login
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-12 lg:pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-8">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Transform your{" "}
                <span className="text-primary">focus habits</span>{" "}
                with deepwork.ai
              </h1>

              <p className="text-lg text-muted max-w-lg">
                Your AI-powered focus coach that understands how your mind actually works, 
                then helps you build sustainable deep work habits—without the guilt.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a href="/login" className="btn-primary text-base inline-flex">
                  Login
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button className="inline-flex items-center gap-2 text-muted hover:text-foreground transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center">
                    <Play className="w-4 h-4 text-primary fill-primary" />
                  </div>
                  <span className="text-sm font-medium">Watch demo</span>
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end pb-16 sm:pb-0">
              {/* Decorative clouds/blobs */}
              <div className="absolute -top-8 right-0 w-20 h-12 bg-gray-200/50 dark:bg-gray-700/50 rounded-full blur-sm hidden sm:block" />
              <div className="absolute -top-4 right-24 w-14 h-8 bg-gray-200/40 dark:bg-gray-700/40 rounded-full blur-sm hidden sm:block" />
              <div className="absolute top-8 -right-4 w-16 h-10 bg-gray-200/30 dark:bg-gray-700/30 rounded-full blur-sm hidden sm:block" />

              {/* Phone frame */}
              <div className="relative w-64 sm:w-72 bg-foreground ring-1 ring-black dark:ring-gray-700 rounded-[2.5rem] sm:rounded-[3rem] p-2 sm:p-3 shadow-float">
                <div className="bg-background rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-3 text-xs text-muted">
                    <span>9:41</span>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-2 bg-foreground/20 rounded-sm" />
                    </div>
                  </div>

                  {/* App content */}
                  <div className="px-4 pb-6 space-y-4">
                    {/* Focus score card */}
                    <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-4 text-white">
                      <p className="text-xs opacity-80">Today&apos;s Focus</p>
                      <p className="text-3xl font-bold mt-1">87<span className="text-lg">/100</span></p>
                      <div className="flex items-center gap-1 mt-2">
                        <TrendingUp className="w-3 h-3" />
                        <span className="text-xs">+12% from yesterday</span>
                      </div>
                    </div>

                    {/* Session card */}
                    <div className="card !p-4 !rounded-2xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-light dark:bg-primary/20 flex items-center justify-center">
                            <Brain className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">Deep Work</p>
                            <p className="text-xs text-muted">45 min session</p>
                          </div>
                        </div>
                        <button className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                          <Play className="w-3 h-3 text-white fill-white" />
                        </button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                        <Clock className="w-4 h-4 text-primary mb-1" />
                        <p className="text-xs text-muted">Focus time</p>
                        <p className="font-semibold">3h 24m</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-3">
                        <Zap className="w-4 h-4 text-amber-500 mb-1" />
                        <p className="text-xs text-muted">Streak</p>
                        <p className="font-semibold">7 days 🔥</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mascot placeholder */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 lg:left-8">
                <div className="card !p-2 sm:!p-3 !rounded-xl sm:!rounded-2xl flex items-center gap-2 sm:gap-3 w-48 sm:w-56">
                  <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-primary-light dark:bg-primary/20 flex items-center justify-center text-xl sm:text-2xl">
                    🧠
                  </div>
                  <div>
                    <p className="font-semibold text-xs sm:text-sm">Focus companion</p>
                    <p className="text-[10px] sm:text-xs text-muted">Thrives on your deep work!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tagline Section */}
      <section className="section bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-title">
            Understand your mind. Train your focus.
          </h2>
          <p className="section-subtitle">
            deepwork.ai watches how you actually work—not how you think you work. 
            It learns your patterns, finds your triggers, and coaches you toward 
            calmer, more focused days.
          </p>
        </div>
      </section>

      {/* Explore Features Section */}
      <section id="features" className="section bg-primary-light/30 dark:bg-primary/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: Phone with UI */}
            <div className="relative order-2 lg:order-1">
              {/* Phone mockup */}
              <div className="relative w-64 mx-auto bg-foreground ring-1 ring-black dark:ring-gray-700 rounded-[3rem] p-3 shadow-float">
                <div className="bg-background rounded-[2.5rem] overflow-hidden">
                  <div className="px-4 py-6 space-y-3">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-muted">Good morning</p>
                        <p className="font-semibold">Your focus plan</p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800" />
                    </div>

                    {/* Tasks */}
                    {["Deep work: Code review", "Admin: Email inbox", "Creative: Writing"].map((task, i) => (
                      <div key={task} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          i === 0 ? "bg-primary text-white" : "bg-gray-200 dark:bg-gray-700"
                        }`}>
                          {i === 0 ? <Zap className="w-4 h-4" /> : <Clock className="w-4 h-4 text-muted" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{task}</p>
                          <p className="text-xs text-muted">{45 - i * 10} min</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Decorative mascot */}
              <div className="absolute -right-2 sm:-right-4 bottom-16 sm:bottom-20 w-16 sm:w-24 h-16 sm:h-24 hidden sm:flex">
                <div className="w-full h-full rounded-full bg-primary-light dark:bg-primary/20 flex items-center justify-center text-2xl sm:text-4xl">
                  🎯
                </div>
              </div>
            </div>

            {/* Right: Feature list */}
            <div className="order-1 lg:order-2 space-y-8">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
                  Explore endless possibilities
                </h2>
                <p className="mt-4 text-muted text-lg">
                  Design your perfect focus system with customizable modes, 
                  smart scheduling, and AI-powered insights.
                </p>
              </div>

              <div className="grid gap-4">
                {features.map((feature) => (
                  <div key={feature.title} className="card !p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-light dark:bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <feature.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{feature.title}</h3>
                      <p className="text-sm text-muted mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Functionality */}
      <section id="how-it-works" className="section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2 className="section-title">Discover advanced functionality</h2>
            <p className="section-subtitle">
              Under the friendly surface is a serious engine for understanding 
              and training your focus.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {advancedFeatures.map((feature, i) => (
              <div key={feature.title} className={`card ${i === 0 ? "md:col-span-2 lg:col-span-1" : ""}`}>
                {/* Placeholder for feature image */}
                <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl mb-4 flex items-center justify-center">
                  {i === 0 && <BarChart3 className="w-12 h-12 text-primary/30" />}
                  {i === 1 && <Calendar className="w-12 h-12 text-primary/30" />}
                  {i === 2 && <Lightbulb className="w-12 h-12 text-primary/30" />}
                  {i === 3 && <TrendingUp className="w-12 h-12 text-primary/30" />}
                  {i === 4 && <Sparkles className="w-12 h-12 text-primary/30" />}
                </div>
                <h3 className="font-semibold text-lg">{feature.title}</h3>
                <p className="text-sm text-muted mt-2">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="section bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="section-header">
            <h2 className="section-title">Testimonials</h2>
            <p className="section-subtitle">
              Join thousands of builders who&apos;ve transformed their focus habits.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.author} className="card flex flex-col">
                <p className="text-foreground flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <p className="font-semibold text-sm">{t.author}</p>
                  <p className="text-xs text-muted">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="section">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-title">About deepwork.ai</h2>
          <p className="section-subtitle">
            We started deepwork.ai because we were tired of productivity apps 
            that made us feel bad. No shame. No hustle-culture platitudes. 
            Just honest data about how your mind works, and an AI coach that 
            helps you train it—gently.
          </p>
          <div className="mt-8 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-primary-light dark:bg-primary/20 flex items-center justify-center text-4xl">
              🧠
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-gray-900 text-white py-20 lg:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                Transform your focus habits with{" "}
                <span className="text-primary">deepwork.ai</span>
              </h2>
              <p className="mt-4 text-gray-300 text-lg">
                Sign in to start your focus sessions and track your progress.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="/login" className="btn-primary inline-flex">
                  Login
                  <ArrowRight className="w-4 h-4" />
                </a>
                <CoBuildButton />
              </div>
            </div>

            {/* App preview placeholder */}
            <div className="hidden sm:flex justify-center gap-3 lg:gap-4">
              <div className="w-24 lg:w-32 h-44 lg:h-56 bg-gray-800 rounded-2xl lg:rounded-3xl" />
              <div className="w-28 lg:w-36 h-52 lg:h-64 bg-gray-700 rounded-2xl lg:rounded-3xl -mt-4" />
              <div className="w-20 lg:w-28 h-36 lg:h-48 bg-gray-800 rounded-2xl lg:rounded-3xl mt-4" />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="w-8 h-8 flex-shrink-0" />
              <span className="text-sm">deepwork.ai · Data-driven focus coach</span>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
