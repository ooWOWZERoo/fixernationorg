import Head from "next/head";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";

// ─── Color data ───────────────────────────────────────────────────────────────

const BRAND_SWATCHES = [
  { w: "50", hex: "#eff6ff" },
  { w: "100", hex: "#dbeafe" },
  { w: "200", hex: "#bfdbfe" },
  { w: "300", hex: "#93c5fd" },
  { w: "400", hex: "#60a5fa" },
  { w: "500", hex: "#3b82f6" },
  { w: "600", hex: "#1D4ED8", primary: true },
  { w: "700", hex: "#1d4ed8" },
  { w: "800", hex: "#1e40af" },
  { w: "900", hex: "#1e3a8a" },
];

const ACCENT_SWATCHES = [
  { w: "50", hex: "#fff7ed" },
  { w: "100", hex: "#ffedd5" },
  { w: "200", hex: "#fed7aa" },
  { w: "300", hex: "#fdba74" },
  { w: "400", hex: "#fb923c" },
  { w: "500", hex: "#f97316" },
  { w: "600", hex: "#E8620A", primary: true },
  { w: "700", hex: "#c2410c" },
  { w: "800", hex: "#9a3412" },
  { w: "900", hex: "#7c2d12" },
];

const SEMANTIC = [
  { name: "Success", bg: "#16a34a", text: "green-600" },
  { name: "Warning", bg: "#d97706", text: "amber-600" },
  { name: "Error", bg: "#dc2626", text: "red-600" },
  { name: "Info", bg: "#0284c7", text: "sky-600" },
];

// ─── Layout helpers ───────────────────────────────────────────────────────────

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-6">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Sub({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignPage() {
  return (
    <>
      <Head>
        <title>Design System — Stage 0 Preview | Fixer Nation</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div id="main-content" className="min-h-screen bg-slate-50">
        {/* Sticky header */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-brand-600 text-base">Fixer Nation</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500">Design System</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="primary">Stage 0</Badge>
              <Badge>v0.1.0</Badge>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto flex gap-8 px-6 py-10">
          {/* Sidebar */}
          <nav className="hidden lg:flex flex-col gap-0.5 w-44 shrink-0 self-start sticky top-20">
            {[
              ["#colors", "Colors"],
              ["#typography", "Typography"],
              ["#buttons", "Buttons"],
              ["#cards", "Cards"],
              ["#forms", "Forms"],
              ["#badges", "Badges"],
              ["#alerts", "Alerts"],
              ["#admin", "Admin Theme"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="block rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-brand-600 transition-colors no-underline"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Main */}
          <main className="flex-1 min-w-0 space-y-16">
            {/* ── Colors ──────────────────────────────────────────────────────── */}
            <Section id="colors" title="Colors">
              <div className="space-y-8">
                <Sub title="Brand Blue — primary interactive color">
                  <div className="flex gap-1.5 flex-wrap">
                    {BRAND_SWATCHES.map((s) => (
                      <div key={s.w} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-11 h-11 rounded-lg shadow-sm ${s.primary ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
                          style={{ background: s.hex }}
                          title={`brand-${s.w} ${s.hex}`}
                        />
                        <span className="text-[10px] text-slate-400 font-mono">{s.w}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Primary interactive: <code className="font-mono">brand-600 #1D4ED8</code>
                  </p>
                </Sub>

                <Sub title="Accent Orange — secondary / CTA color">
                  <div className="flex gap-1.5 flex-wrap">
                    {ACCENT_SWATCHES.map((s) => (
                      <div key={s.w} className="flex flex-col items-center gap-1">
                        <div
                          className={`w-11 h-11 rounded-lg shadow-sm ${s.primary ? "ring-2 ring-slate-900 ring-offset-2" : ""}`}
                          style={{ background: s.hex }}
                          title={`accent-${s.w} ${s.hex}`}
                        />
                        <span className="text-[10px] text-slate-400 font-mono">{s.w}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Primary CTA: <code className="font-mono">accent-600 #E8620A</code>
                  </p>
                </Sub>

                <Sub title="Semantic Colors">
                  <div className="flex flex-wrap gap-3">
                    {SEMANTIC.map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <div
                          className="w-8 h-8 rounded-lg"
                          style={{ background: c.bg }}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {c.name}
                          </p>
                          <p className="text-xs font-mono text-slate-400">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Sub>
              </div>
            </Section>

            {/* ── Typography ──────────────────────────────────────────────────── */}
            <Section id="typography" title="Typography">
              <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                {[
                  {
                    label: "h1 · text-4xl font-bold",
                    el: (
                      <p className="text-4xl font-bold text-slate-900">
                        The quick brown fox
                      </p>
                    ),
                  },
                  {
                    label: "h2 · text-3xl font-semibold",
                    el: (
                      <p className="text-3xl font-semibold text-slate-900">
                        The quick brown fox
                      </p>
                    ),
                  },
                  {
                    label: "h3 · text-2xl font-semibold",
                    el: (
                      <p className="text-2xl font-semibold text-slate-900">
                        The quick brown fox
                      </p>
                    ),
                  },
                  {
                    label: "h4 · text-xl font-semibold",
                    el: (
                      <p className="text-xl font-semibold text-slate-900">
                        The quick brown fox
                      </p>
                    ),
                  },
                  {
                    label: "Body Large · text-lg leading-relaxed",
                    el: (
                      <p className="text-lg text-slate-700 leading-relaxed max-w-prose">
                        Fixer Nation connects members with trusted service
                        providers, expert content, and a community of people who
                        get things done.
                      </p>
                    ),
                  },
                  {
                    label: "Body · text-base",
                    el: (
                      <p className="text-base text-slate-700 leading-relaxed max-w-prose">
                        Fixer Nation connects members with trusted service
                        providers, expert content, and a community of people who
                        get things done.
                      </p>
                    ),
                  },
                  {
                    label: "Small / Caption · text-sm text-slate-500",
                    el: (
                      <p className="text-sm text-slate-500">
                        Caption, metadata, timestamps, helper text.
                      </p>
                    ),
                  },
                ].map(({ label, el }) => (
                  <div key={label} className="flex flex-col gap-2 px-6 py-4">
                    <p className="text-xs font-mono text-slate-400">{label}</p>
                    {el}
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Buttons ─────────────────────────────────────────────────────── */}
            <Section id="buttons" title="Buttons">
              <div className="space-y-6">
                <Sub title="Variants">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                  </div>
                </Sub>
                <Sub title="Sizes">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm">Small</Button>
                    <Button size="md">Medium</Button>
                    <Button size="lg">Large</Button>
                  </div>
                </Sub>
                <Sub title="States">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button isLoading>Saving…</Button>
                    <Button disabled>Disabled</Button>
                    <Button variant="outline" disabled>
                      Disabled Outline
                    </Button>
                  </div>
                </Sub>
              </div>
            </Section>

            {/* ── Cards ───────────────────────────────────────────────────────── */}
            <Section id="cards" title="Cards">
              <div className="grid sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Default Card</CardTitle>
                    <CardDescription>
                      A container for grouped content and actions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">
                      Body content goes here. Use cards to group related
                      information.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button size="sm">Action</Button>
                    <Button size="sm" variant="ghost">
                      Cancel
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="border-brand-200 bg-brand-50/40">
                  <CardHeader>
                    <CardTitle>Highlighted Card</CardTitle>
                    <CardDescription>
                      border-brand-200 bg-brand-50 for emphasis.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-600">
                      Tinted with brand colors to draw attention to featured
                      content.
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Badge variant="primary">Featured</Badge>
                  </CardFooter>
                </Card>

                {/* Stat card */}
                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Total Members</p>
                        <p className="text-3xl font-bold text-slate-900 mt-0.5">
                          1,284
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          ↑ 12% from last month
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                        <svg
                          className="w-6 h-6 text-brand-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue stat */}
                <Card>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-500">Monthly Revenue</p>
                        <p className="text-3xl font-bold text-slate-900 mt-0.5">
                          $8,420
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          ↑ 8% from last month
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-accent-100 flex items-center justify-center shrink-0">
                        <svg
                          className="w-6 h-6 text-accent-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </Section>

            {/* ── Forms ───────────────────────────────────────────────────────── */}
            <Section id="forms" title="Forms">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Sub title="Input States">
                    <div className="space-y-3">
                      <Input label="Default" placeholder="Enter text…" />
                      <Input
                        label="With helper text"
                        description="We'll never share your email."
                        type="email"
                        placeholder="you@example.com"
                      />
                      <Input
                        label="Required field"
                        required
                        placeholder="Required"
                      />
                      <Input
                        label="Error state"
                        error="This field is required."
                        defaultValue="bad input"
                      />
                      <Input
                        label="Disabled"
                        disabled
                        defaultValue="Not editable"
                      />
                    </div>
                  </Sub>
                </div>

                <div>
                  <Sub title="Form Card Example">
                    <Card>
                      <CardHeader>
                        <CardTitle>Update Profile</CardTitle>
                        <CardDescription>
                          Changes are saved immediately.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <Input label="Full name" defaultValue="Alex Johnson" required />
                          <Input
                            label="Email"
                            type="email"
                            defaultValue="alex@example.com"
                            required
                          />
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button size="sm">Save changes</Button>
                        <Button size="sm" variant="ghost">
                          Discard
                        </Button>
                      </CardFooter>
                    </Card>
                  </Sub>
                </div>
              </div>
            </Section>

            {/* ── Badges ──────────────────────────────────────────────────────── */}
            <Section id="badges" title="Badges">
              <div className="flex flex-wrap gap-3">
                <Badge>Default</Badge>
                <Badge variant="primary">Primary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="primary">Active Member</Badge>
                <Badge variant="success">Payment Verified</Badge>
                <Badge variant="warning">Grace Period</Badge>
                <Badge variant="danger">Expired</Badge>
                <Badge variant="outline">Pending Review</Badge>
              </div>
            </Section>

            {/* ── Alerts ──────────────────────────────────────────────────────── */}
            <Section id="alerts" title="Alerts">
              <div className="space-y-3">
                <Alert variant="info" title="Information">
                  Your Morning Boost digest is ready. Check your dashboard.
                </Alert>
                <Alert variant="success" title="Payment confirmed">
                  Your membership is active. Welcome to Fixer Nation!
                </Alert>
                <Alert variant="warning" title="Subscription renewing soon">
                  Your annual membership renews in 7 days. Update your billing
                  info if needed.
                </Alert>
                <Alert variant="error" title="Payment failed">
                  We couldn&apos;t charge your card. Please update your payment
                  method to stay active.
                </Alert>
              </div>
            </Section>

            {/* ── Admin Theme ─────────────────────────────────────────────────── */}
            <Section id="admin" title="Admin Theme (Dark)">
              <div className="rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
                {/* Topbar */}
                <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5">
                  <span className="text-sm font-bold text-white">
                    Fixer Nation
                  </span>
                  <span className="text-slate-600 text-sm">/</span>
                  <span className="text-sm text-slate-400">Admin</span>
                  <span className="flex-1" />
                  <Badge variant="success">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                    Production
                  </Badge>
                  <div className="w-7 h-7 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center">
                    SA
                  </div>
                </div>

                <div className="flex">
                  {/* Sidebar */}
                  <aside className="w-48 shrink-0 bg-slate-900/70 border-r border-slate-800 p-2.5 space-y-0.5">
                    {[
                      ["Dashboard", true],
                      ["Consumers", false],
                      ["Service Providers", false],
                      ["Commerce", false],
                      ["Content", false],
                      ["Email & CRM", false],
                      ["Automations", false],
                      ["Settings", false],
                    ].map(([label, active]) => (
                      <div
                        key={String(label)}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm cursor-default ${
                          active
                            ? "bg-brand-600 text-white font-medium"
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-sm shrink-0 ${
                            active ? "bg-white/40" : "bg-slate-700"
                          }`}
                        />
                        {label}
                      </div>
                    ))}
                  </aside>

                  {/* Content area */}
                  <div className="flex-1 p-5 min-w-0">
                    <h3 className="text-sm font-semibold text-white mb-4">
                      Dashboard
                    </h3>
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Consumers", value: "1,284", bg: "bg-brand-600" },
                        { label: "Revenue", value: "$8,420", bg: "bg-accent-600" },
                        { label: "Service Providers", value: "47", bg: "bg-green-600" },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-xl bg-slate-800 border border-slate-700 p-3"
                        >
                          <div
                            className={`w-5 h-1 rounded-full ${s.bg} mb-2`}
                          />
                          <p className="text-lg font-bold text-white">{s.value}</p>
                          <p className="text-xs text-slate-500">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <Alert variant="info">
                      Admin surfaces: <code className="font-mono text-xs">bg-slate-950</code> base ·{" "}
                      <code className="font-mono text-xs">bg-slate-900</code> card ·{" "}
                      <code className="font-mono text-xs">border-slate-800</code>
                    </Alert>
                  </div>
                </div>
              </div>
            </Section>

            <p className="text-center text-xs text-slate-400 pb-4">
              Fixer Nation Design System · Stage 0 · v0.1.0 ·{" "}
              <span className="font-mono">CUSTOMIZE: update tailwind.config.ts brand/accent values</span>
            </p>
          </main>
        </div>
      </div>
    </>
  );
}
