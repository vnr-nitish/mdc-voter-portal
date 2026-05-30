"use client";

import Image from "next/image";
import { useState } from "react";

const domainOptions = ["Technical", "Non-Technical"] as const;

const domainItems = [
  {
    title: "DataVerse",
    category: "Technical",
    desc: "Analytics, data storytelling, dashboards, and visual insight-building for MDC.",
  },
  {
    title: "WebArc",
    category: "Technical",
    desc: "Modern web development, interactive interfaces, and responsive product thinking.",
  },
  {
    title: "Competitive Programming",
    category: "Technical",
    desc: "Sharpening problem-solving skills through algorithmic challenges and coding contests.",
  },
  {
    title: "Content",
    category: "Non-Technical",
    desc: "Copywriting, storytelling, social posts, and editorial work that gives MDC its voice.",
  },
  {
    title: "Design",
    category: "Non-Technical",
    desc: "UX/UI and graphic design creating visuals, interfaces, and brand identity for MDC.",
  },
  {
    title: "Public Relations",
    category: "Non-Technical",
    desc: "Outreach, partnerships, communication, and event presence that expands MDC's reach.",
  },
  {
    title: "Photography",
    category: "Non-Technical",
    desc: "Photography and videography documenting events and behind-the-scenes moments.",
  },
] as const;

const whatWeDoItems = [
  {
    title: "Workshops",
    subtitle: "Hands-on sessions that build practical skill.",
    description:
      "Dive deep into modern technologies with interactive workshops led by industry experts and experienced peers.",
    image: "/WorkShop.jpg",
  },
  {
    title: "Coding Contests",
    subtitle: "Compete, solve, and improve in public.",
    description:
      "Challenge your problem-solving skills in regular coding contests and hackathons. Compete with top minds and push your limits.",
    image: "/CodingContest.jpg",
  },
  {
    title: "Technical Sessions",
    subtitle: "Expert talks and seminars that keep MDC current.",
    description:
      "Stay ahead of the curve with insights from industry leaders and technical deep dives into emerging trends.",
    image: "/TechnicalSession.jpg",
  },
] as const;

const stats = [
  { label: "Active members", value: "40+" },
  { label: "Domain tracks", value: "7" },
  { label: "Secure voting window", value: "5 min" },
  { label: "Approvals required", value: "1" },
] as const;

const visionMissionItems = [
  {
    label: "Our Vision",
    title: "Grow a stronger developer community.",
    description:
      "MDC aims to provide abundant technical resources, facilitate peer discussions, and contribute to the open source community while fostering student upskilling and growth.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          d="M12 4.5c-4.5 0-8.5 3.2-8.5 7.5s4 7.5 8.5 7.5 8.5-3.2 8.5-7.5-4-7.5-8.5-7.5z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
        />
        <circle cx="12" cy="12" r="3" strokeWidth={1.6} />
      </svg>
    ),
  },
  {
    label: "Our Mission",
    title: "Share skills, guidance, and opportunities.",
    description:
      "MDC is an innovator's network, providing technical skill sharing, expert guidance, and collaboration opportunities for developers with meaningful exposure to open source technologies.",
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          d="M12 3l3.5 7h7.5l-6 4.6 2.2 7.4-7.2-4.2-7.2 4.2 2.2-7.4-6-4.6h7.5L12 3z"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
        />
      </svg>
    ),
  },
] as const;

const votingSteps = [
  {
    title: "Login",
    text: "Sign in with your institutional email or registration identity.",
  },
  {
    title: "Verify",
    text: "Capture a live photo and wait for admin approval.",
  },
  {
    title: "Vote",
    text: "Your ballot opens for 5 minutes after approval.",
  },
  {
    title: "Lock",
    text: "A single registration number cannot vote twice.",
  },
] as const;

function DomainIcon({ title }: { title: string }) {
  switch (title) {
    case "DataVerse":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M4 5.5h16v11.5H4V5.5zm3.2 8.8v-2.6m4.1 2.6V8.8m4.1 5.5v-4.1m4.1 4.1V7.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
          <path
            d="M5.8 17.2l3.2-2.7 2.6 1.5 3.4-3.9 3.2 1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    case "WebArc":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 0c2.7 2.2 4.5 5.4 4.5 9s-1.8 6.8-4.5 9m0-18C9.3 5.2 7.5 8.4 7.5 12s1.8 6.8 4.5 9M3 12h18M4.8 7.5h14.4M4.8 16.5h14.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.65}
          />
        </svg>
      );
    case "Competitive Programming":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M4 6.5h16v11H4v-11zm5 2.8L6.4 12 9 14.7m6-5.4l2.6 2.7-2.6 2.7M11.5 15.8l1.8-7.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    case "Content":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M6 4.5h8.5L19.5 9v10.5H6V4.5zm8.5 0V9h5M4.5 19.5l1.1-3.8 7.8-7.8 2.7 2.7-7.8 7.8-3.8 1.1z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    case "Design":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M13.8 4.2a8.2 8.2 0 00-8 8.4c0 2.8 2.1 5 4.8 5h1.2c.9 0 1.7.8 1.7 1.7v.6c0 1 .8 1.8 1.9 1.8a6.9 6.9 0 006.6-7.1c0-5.2-3.9-9.4-8.2-10.4zM8.4 10.7h.01M11.2 8.7h.01M14.3 10h.01"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
          <path
            d="M3.8 5.2l4.2 4.2m-2.5-5.9l2.2 2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    case "Public Relations":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M7.4 10.1a2.6 2.6 0 115.2 0 2.6 2.6 0 01-5.2 0zM4.8 18.3a5.2 5.2 0 0110.4 0M16.4 9.2c1.3.2 2.3 1.3 2.3 2.7s-1 2.5-2.3 2.7m2.9-6.2c1.7.5 2.9 2 2.9 3.9s-1.2 3.4-2.9 3.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    case "Photography":
      return (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M4 8h3l2-3h6l2 3h3v10H4V8zm8 8a3.5 3.5 0 100-7 3.5 3.5 0 000 7z"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      );
    default:
      return null;
  }
}

function FeatureIcon({ title }: { title: string }) {
  switch (title) {
    case "Workshops":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M4 7h16M7 3v4m10-4v4M6 11h12M6 15h12M8 19h8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    case "Coding Contests":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M9 8l-4 4 4 4m6-8l4 4-4 4m-2-10-2 12"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      );
    case "Technical Sessions":
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            d="M12 4v16m-6-6h12M7 8l5-4 5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<(typeof domainOptions)[number]>("Technical");

  const filteredDomains = domainItems.filter((item) => item.category === activeCategory);
  const isNonTechnical = activeCategory === "Non-Technical";

  return (
    <div className="page-frame min-h-screen bg-cream text-ink">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-16 pt-4 sm:px-6 md:gap-10 md:px-10 lg:px-12">
        <header className="sticky top-4 z-30 rounded-[1.75rem] border border-charcoal/10 bg-white/80 px-5 py-4 shadow-[0_18px_50px_rgba(8,31,92,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <a href="#top" className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#1f4bb3] to-[#0b1f5a] shadow-[0_10px_24px_rgba(8,31,92,0.28)] ring-1 ring-white/40">
                <Image
                  src="/mdclogobw.png"
                  alt="MDC"
                  width={34}
                  height={34}
                  className="h-8 w-8 object-contain"
                  priority
                />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-charcoal">MDC</p>
                <p className="text-xs text-ink/60">Meta Developer Communities, GITAM</p>
              </div>
            </a>
            <a
              href="/voter"
              className="inline-flex items-center justify-center rounded-full bg-charcoal px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-[#28408d]"
            >
              Voter Login
            </a>
          </div>
        </header>

        <section id="top" className="grid items-center gap-8 py-4 lg:grid-cols-[1.08fr_0.92fr] lg:gap-12 lg:py-8">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-charcoal/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-charcoal shadow-sm">
              Secure student voting portal
            </span>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-5xl font-bold leading-[1.02] text-ink md:text-6xl">
                Vote for the students shaping MDC's next chapter.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-ink/72 md:text-lg">
                Institutional email sign-in, registration approval, live photo verification, and a strict voting window are all built into one secure flow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#vote"
                className="inline-flex items-center justify-center rounded-full bg-charcoal px-6 py-3 text-sm font-semibold text-cream transition hover:bg-[#28408d]"
              >
                See Voting Flow
              </a>
              <a
                href="#domains"
                className="inline-flex items-center justify-center rounded-full border border-charcoal/15 bg-white/80 px-6 py-3 text-sm font-semibold text-charcoal transition hover:border-charcoal/30"
              >
                Explore Domains
              </a>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <div className="glass-panel rounded-3xl px-4 py-4 transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_54px_rgba(8,31,92,0.18)]" key={item.label}>
                  <p className="text-2xl font-bold text-ink">{item.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-ink/60">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-[#0b8fb0]/15 blur-2xl" />
            <div className="absolute -bottom-8 right-2 h-28 w-28 rounded-full bg-[#334eac]/15 blur-3xl" />
            <div className="overflow-hidden rounded-[2rem] border border-charcoal/10 bg-white shadow-[0_30px_90px_rgba(8,31,92,0.18)]">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/team-photo.jpg"
                  alt="MDC community"
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                />
              </div>
            </div>
            <div className="absolute -bottom-5 left-5 rounded-2xl border border-charcoal/10 bg-white px-4 py-3 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal">MDC at GITAM</p>
              <p className="mt-1 text-sm text-ink/70">A community built around code, design, content, and collaboration.</p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-charcoal/10 bg-white/75 p-7 shadow-[0_22px_60px_rgba(8,31,92,0.08)] backdrop-blur md:p-9">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-charcoal">Voting overview</p>
              <h2 className="mt-3 text-3xl font-bold text-ink md:text-4xl">One verification step, one vote, one clean outcome.</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-ink/72">
                Students log in with their institutional credentials, confirm their registration number, capture a live photograph, and wait for admin approval before a timed voting session begins.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Secure login", "Institutional email with controlled access."],
                ["Live approval", "Admin reviews the photo and registration match."],
                ["Timed ballot", "The vote window closes automatically after 5 minutes."],
                ["Single session", "The same registration number cannot vote twice."],
              ].map(([title, body]) => (
                <div className="rounded-3xl border border-charcoal/10 bg-[#f9fcff] p-5 transition duration-300 hover:-translate-y-1 hover:border-charcoal/30" key={title}>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/68">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-charcoal">Who we are</p>
            <h2 className="text-4xl font-bold text-ink md:text-5xl">Pioneering the future of student builders.</h2>
            <p className="max-w-2xl text-base leading-7 text-ink/72">
              Meta Developer Communities is a collective of tech enthusiasts, designers, writers, and problem solvers at GITAM. The focus is simple: bridge classroom knowledge with practical, industry-standard work.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="glass-panel rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_rgba(8,31,92,0.16)]">
                <p className="text-sm font-semibold text-ink">Connected teams</p>
                <p className="mt-2 text-sm leading-6 text-ink/68">Technical and non-technical domains working in one coordinated community.</p>
              </div>
              <div className="glass-panel rounded-3xl p-5 transition duration-300 hover:-translate-y-1 hover:shadow-[0_26px_50px_rgba(8,31,92,0.16)]">
                <p className="text-sm font-semibold text-ink">Practical growth</p>
                <p className="mt-2 text-sm leading-6 text-ink/68">Workshops, contests, sessions, and events that create real experience.</p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[2rem] border border-charcoal/10 bg-white shadow-[0_24px_70px_rgba(8,31,92,0.14)]">
              <div className="relative aspect-[16/11] w-full">
                <Image
                  src="/MDC.jpg"
                  alt="MDC team"
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 100vw"
                />
              </div>
            </div>
            <div className="absolute -bottom-5 right-5 rounded-2xl border border-charcoal/10 bg-white px-4 py-3 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal">Active members</p>
              <p className="text-xl font-bold text-ink">40+</p>
            </div>
          </div>
        </section>

        <section id="domains" className="space-y-6 rounded-[2rem] border border-charcoal/10 bg-white/75 p-7 shadow-[0_22px_60px_rgba(8,31,92,0.08)] backdrop-blur md:p-9">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-charcoal">Domains</p>
            <h2 className="mt-3 text-4xl font-bold text-ink">Our focus areas</h2>
            <div className="mt-5 inline-flex rounded-full border border-charcoal/15 bg-white p-1 text-xs font-semibold shadow-sm">
              {domainOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setActiveCategory(option)}
                  className={`rounded-full px-4 py-2 transition ${
                    activeCategory === option ? "bg-charcoal text-cream" : "text-charcoal"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`grid gap-5 ${
              isNonTechnical ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
            }`}
          >
            {filteredDomains.map((item) => (
              <div className="glass-panel group rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_54px_rgba(8,31,92,0.18)]" key={item.title}>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal/10 text-charcoal transition duration-300 group-hover:scale-110 group-hover:bg-charcoal/15 group-hover:text-[#1f4bb3]">
                  <DomainIcon title={item.title} />
                </div>
                <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink/70">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6 rounded-[2rem] border border-charcoal/10 bg-white/75 p-7 shadow-[0_22px_60px_rgba(8,31,92,0.08)] backdrop-blur md:p-9">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-charcoal">What we do</p>
            <h2 className="mt-3 text-4xl font-bold text-ink">Events and learning that feel coherent.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-ink/72">
              Every program sits inside the same visual language: practical, polished, and focused on student growth instead of generic club noise.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {whatWeDoItems.map((item) => (
              <article className="glass-panel overflow-hidden rounded-[1.75rem] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_30px_54px_rgba(8,31,92,0.18)]" key={item.title}>
                <div className="relative aspect-[16/10] w-full">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 30vw, 100vw"
                  />
                </div>
                <div className="space-y-3 p-6">
                  <div className="flex items-center gap-3 text-charcoal">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-charcoal/10">
                      <FeatureIcon title={item.title} />
                    </span>
                    <p className="text-lg font-semibold text-ink">{item.title}</p>
                  </div>
                  <h3 className="text-xl font-semibold text-ink">{item.subtitle}</h3>
                  <p className="text-sm leading-6 text-ink/70">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          {visionMissionItems.map((item) => (
            <div className="glass-panel rounded-[1.75rem] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_54px_rgba(8,31,92,0.16)]" key={item.label}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-charcoal/10 text-charcoal">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-charcoal">{item.label}</p>
                  <h3 className="text-xl font-semibold text-ink">{item.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-7 text-ink/72">{item.description}</p>
            </div>
          ))}
        </section>

        <section id="vote" className="rounded-[2rem] border border-charcoal/10 bg-white/80 p-8 shadow-[0_24px_70px_rgba(8,31,92,0.12)] md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-charcoal">Voting</p>
              <h2 className="text-4xl font-bold text-ink md:text-5xl">Finish the experience with a clean, secure vote.</h2>
              <p className="max-w-2xl text-base leading-7 text-ink/72">
                The voting flow is intentionally last: after the homepage introduces MDC, its domains, its work, and its purpose, the secure voting process becomes the final call to action.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {votingSteps.map((step) => (
                <div className="rounded-3xl border border-charcoal/10 bg-[#f9fcff] p-5 transition duration-300 hover:-translate-y-1 hover:border-charcoal/30" key={step.title}>
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/68">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-charcoal/10 bg-white/50 px-6 py-8 text-sm text-ink/70 md:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>MDC Voter Portal - MDC at GITAM</p>
          <a className="text-xs font-semibold uppercase tracking-[0.18em] text-charcoal" href="/admin">
            Admin Access
          </a>
        </div>
      </footer>
    </div>
  );
}
