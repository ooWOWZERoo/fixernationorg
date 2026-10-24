import Head from "next/head";
import { useState } from "react";
import type { NextPageWithLayout } from "@/types/next";

// Served at trial.fixernation.org via the hostname rewrite in
// src/middleware.ts. Content, structure, and CSS ported verbatim from the
// supplied FNPHWN_Project_B_Landing_Page static page -- see that README
// for the original design notes.
//
// The membership CTA sends the user to /join -- the exact same page and
// checkout flow (sign-in gate, plan picker, create-session API call,
// Stripe redirect) the main site's own free-trial button uses. It does
// NOT create a Stripe Checkout Session directly from this page: a session
// URL (like checkout.stripe.com/g/pay/cs_live_...) is single-use and tied
// to one specific transaction, so there's nothing reusable to hardcode --
// reusing /join's existing, already-correct flow is the actual
// equivalent of "the same checkout process."
//
// The Morning Boost form posts to the existing /api/public/subscribe
// endpoint (same CRM-contact-creation + consent + list-membership logic
// every other public signup form on this site already uses), tagged with
// a source string that ONLY this landing page uses. That source is what
// scopes the 30-day auto-expiry cron job (runMorningBoostTrialExpiry in
// src/pages/api/cron.ts) to these sign-ups specifically -- never change
// this string without updating that job to match, or trial sign-ups will
// never expire (or worse, a real member's source could start matching).
const MEMBERSHIP_TRIAL_URL = "/join";
const MORNING_BOOST_SIGNUP_ENDPOINT = "/api/public/subscribe";
const MORNING_BOOST_TRIAL_SOURCE = "trial_landing_30day";

const TrialLandingPage: NextPageWithLayout = () => {
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [formStatus, setFormStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const year = new Date().getFullYear();

  function handleMembershipCta() {
    if (!MEMBERSHIP_TRIAL_URL) {
      setAlertMessage(
        "The membership registration destination has not been configured. Ask your developer to set the 30-day trial URL and verify the offer and billing disclosures."
      );
      return;
    }
    try {
      const u = new URL(MEMBERSHIP_TRIAL_URL, window.location.href);
      if (u.protocol !== "https:") throw new Error();
      window.location.assign(u.href);
    } catch {
      setAlertMessage("The registration URL is invalid. Please provide a verified HTTPS destination.");
    }
  }

  async function handleBoostSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setFormStatus("");
    if (!form.reportValidity()) return;
    if (!MORNING_BOOST_SIGNUP_ENDPOINT) {
      setAlertMessage(
        "Morning Boost signup needs to be connected to your email service by a secure server endpoint. No personal information has been submitted or stored."
      );
      return;
    }
    const url = new URL(MORNING_BOOST_SIGNUP_ENDPOINT, window.location.href);
    if (url.protocol !== "https:") {
      setAlertMessage("A secure HTTPS signup endpoint is required.");
      return;
    }
    const firstName = (form.elements.namedItem("firstName") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    setSubmitting(true);
    try {
      const response = await fetch(url.href, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, topic: "MORNING_BOOST", source: MORNING_BOOST_TRIAL_SOURCE }),
      });
      if (!response.ok) throw new Error("Failed");
      setFormStatus("Thanks! Please check your inbox for the confirmation email.");
      form.reset();
    } catch {
      setFormStatus("We could not complete registration right now. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fn-trial-landing">
      <Head>
        <title>30 Days to a More Positive You | Fixer Nation</title>
        <meta
          name="description"
          content="Start your 30-day Fixer Nation journey with a daily Morning Boost, personal goals, growth pathways, challenges, and a supportive community."
        />
        <meta name="theme-color" content="#0d347a" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </Head>

      <a className="skip" href="#main">Skip to content</a>

      <header className="site-header">
        <div className="wrap header-flex">
          <a className="brand" href="#top" aria-label="Fixer Nation home">
            <img src="/images/trial-landing/fixer-nation-logo.png" alt="Fixer Nation Positivity, Health & Wellness Network logo" />
          </a>
          <nav aria-label="Page sections">
            <a href="#morning-boost">Morning Boost</a>
            <a href="#benefits">Benefits</a>
            <a href="#community">Community</a>
          </nav>
          <a className="btn btn-sm" href="#join">Start your 30 days <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      <main id="main">
        <section className="hero" id="top">
          <div className="sun-glow" />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <span className="eyebrow light">THE HEALTH CLUB FOR YOUR MIND, BODY & SOUL™</span>
              <h1>Don&apos;t just give us your email.<br /><em>Give yourself 30 days.</em></h1>
              <p className="lead">Start every morning with something positive. Build better habits, find your focus, and connect with people who want to grow—just like you.</p>
              <div className="hero-ctas">
                <a href="#join" className="btn btn-gold">Start my free 30-day trial <span>→</span></a>
                <a href="#boost-signup" className="text-link light-link">Just want the Morning Boost? <span>↗</span></a>
              </div>
              <p className="hero-fine">One better morning. One better choice. One day at a time.</p>
            </div>
            <div className="hero-art" aria-label="Graphic preview of the Fixer Nation experience">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="floating-card morning-card">
                <span className="micro">YOUR DAILY RESET</span>
                <span className="sun-icon">☀</span>
                <strong>Good Morning,<br />Fixer Nation.</strong>
                <span className="mini">A little positivity can change the way your day begins.</span>
                <span className="play-shape" aria-hidden="true">▶ &nbsp; MORNING BOOST</span>
              </div>
              <div className="floating-card goals-card">
                <span className="micro">YOUR JOURNEY</span>
                <strong>Build your best self.</strong>
                <span className="mini">Goals • Habits • Progress</span>
                <div className="progress-line"><i /></div>
              </div>
              <div className="floating-pill">✦ Mind &nbsp; ✦ Body &nbsp; ✦ Soul</div>
            </div>
          </div>
        </section>

        <section className="trust-strip">
          <div className="wrap trust-inner">
            <span>START WITH POSITIVITY</span><span className="star">✦</span>
            <span>GROW WITH PURPOSE</span><span className="star">✦</span>
            <span>KEEP MOVING FORWARD</span>
          </div>
        </section>

        <section className="section morning" id="morning-boost">
          <div className="wrap split">
            <div>
              <span className="eyebrow">THE HEART OF FIXER NATION</span>
              <h2>Make positivity your <em>morning ritual.</em></h2>
              <p className="section-lead">Before the emails, the news, and everything competing for your attention—take a few meaningful minutes for yourself.</p>
              <p>The <strong>Fixer Nation Morning Boost</strong> is a short, professionally narrated video experience designed to help you reset your focus, strengthen your outlook, and start with purpose.</p>
              <div className="benefit-lines">
                <div><span>🎙️</span><p><strong>Professionally narrated</strong><br />Encouragement you can carry into the day.</p></div>
                <div><span>🌅</span><p><strong>Motivating visual experience</strong><br />A daily moment to pause and reflect.</p></div>
                <div><span>💙</span><p><strong>Positivity, health and wellness</strong><br />Practical perspective for everyday life.</p></div>
              </div>
              <a className="btn" href="#boost-signup">Get 30 days of Morning Boosts <span>→</span></a>
            </div>
            <div className="boost-visual">
              <div className="boost-sun" />
              <a className="boost-card" href="https://fixernation.org/morning-boost">
                <img
                  src="https://res.cloudinary.com/x9ll3a3t/image/upload/c_fill,w_800,h_400,g_center,f_auto,q_auto/v1790595099/morning-boost/vchq4m4k1glumxuiplnl.png"
                  alt="Fixer Nation Positivity, Health and Wellness Network"
                  width={800}
                  height={400}
                  loading="lazy"
                />
                <div className="boost-card-body">
                  <span className="micro">DAILY INSPIRATION</span>
                  <h3>Morning Boost</h3>
                  <p>A short read every morning to help you reset, refocus, and move forward.</p>
                  <span className="boost-card-link">Read today&apos;s boost →</span>
                </div>
              </a>
            </div>
          </div>
        </section>

        <section className="section section-soft" id="benefits">
          <div className="wrap">
            <div className="section-heading">
              <span className="eyebrow">SO MUCH MORE THAN A VIDEO</span>
              <h2>Your journey. <em>All in one place.</em></h2>
              <p>Start with one positive message—then discover tools to help you turn good intentions into everyday action.</p>
            </div>
            <div className="features-grid">
              <article className="feature"><span className="feature-icon">🎯</span><h3>Focus & Goals</h3><p>Choose what matters most, from confidence and relationships to purpose, finances, and wellness.</p></article>
              <article className="feature"><span className="feature-icon">✅</span><h3>My Fixer Plan</h3><p>Turn intentions into steps you can take—and see the satisfaction of checking them off.</p></article>
              <article className="feature"><span className="feature-icon">🛤️</span><h3>Growth Pathways</h3><p>Explore guided programs for career, financial foundations, healthy habits, and more.</p></article>
              <article className="feature"><span className="feature-icon">🔥</span><h3>Fixer Challenges</h3><p>Build momentum through focused 7-, 21-, and 30-day experiences.</p></article>
              <article className="feature"><span className="feature-icon">💬</span><h3>Daily Check-In</h3><p>Take a brief moment to notice your mood, energy, and what&apos;s on your mind.</p></article>
              <article className="feature"><span className="feature-icon">✍️</span><h3>Private Reflections</h3><p>Capture gratitude, progress, lessons, and thoughts in your personal reflection space.</p></article>
              <article className="feature"><span className="feature-icon">📈</span><h3>Progress & Recognition</h3><p>See your badges, streaks, milestones, and accomplishments add up.</p></article>
              <article className="feature"><span className="feature-icon">🧠</span><h3>Brain Builder</h3><p>Practice positive reframing, gratitude, kindness, calm, focus, and healthy choices.</p></article>
            </div>
          </div>
        </section>

        <section className="section inside">
          <div className="wrap">
            <div className="section-heading">
              <span className="eyebrow">A REAL LOOK INSIDE</span>
              <h2>Tools that turn <em>inspiration into action.</em></h2>
              <p>These previews are from the Fixer Nation member experience.</p>
            </div>
            <div className="screens-gallery">
              <figure className="screen-tile wide">
                <img src="/images/trial-landing/focus-and-goals.webp" alt="Fixer Nation Focus and Goals interface" loading="lazy" />
                <figcaption><strong>Pick your focus</strong><span>Choose the areas you want to strengthen.</span></figcaption>
              </figure>
              <figure className="screen-tile">
                <img src="/images/trial-landing/my-fixer-plan.webp" alt="Fixer Nation My Plan with completed tasks" loading="lazy" />
                <figcaption><strong>Build your plan</strong><span>Make each next step practical.</span></figcaption>
              </figure>
              <figure className="screen-tile">
                <img src="/images/trial-landing/brain-builder.webp" alt="Brain Builder activity selections" loading="lazy" />
                <figcaption><strong>Train your thinking</strong><span>Explore meaningful daily activities.</span></figcaption>
              </figure>
              <figure className="screen-tile">
                <img src="/images/trial-landing/growth-pathways.webp" alt="Growth Pathways with guided program cards" loading="lazy" />
                <figcaption><strong>Follow a pathway</strong><span>Progress one stage at a time.</span></figcaption>
              </figure>
              <figure className="screen-tile">
                <img src="/images/trial-landing/progress.webp" alt="Fixer Nation personal progress dashboard" loading="lazy" />
                <figcaption><strong>See your progress</strong><span>Celebrate steps along the way.</span></figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="section community" id="community">
          <div className="wrap community-grid">
            <div className="community-art">
              <span className="community-spark">✳</span>
              <div className="community-bubble one">You&apos;re making progress. Keep going! 💙</div>
              <div className="community-bubble two">Small steps matter. ✨</div>
              <div className="community-bubble three">We&apos;re growing together. 🙌</div>
            </div>
            <div>
              <span className="eyebrow light">SOCIAL MEDIA WITH A PURPOSE</span>
              <h2>Find people who want to <em>grow with you.</em></h2>
              <p>Social connection should leave you feeling supported, not drained. Fixer Nation brings together people working to become healthier, more positive, and more purposeful versions of themselves.</p>
              <p>Encourage others. Share progress. Celebrate positive choices. Create meaningful connections along the way.</p>
              <a className="btn btn-gold" href="#join">Find my Fixer Nation <span>→</span></a>
            </div>
          </div>
        </section>

        <section className="section daily">
          <div className="wrap daily-grid">
            <div>
              <span className="eyebrow">ONE SMALL STEP AT A TIME</span>
              <h2>What could your next <em>30 days look like?</em></h2>
              <p>Not a promise of instant transformation. An invitation to give yourself time, intention, and positive support.</p>
            </div>
            <div className="timeline">
              <div><span>01</span><p><strong>Start your morning differently.</strong><br />Make room for an uplifting daily ritual.</p></div>
              <div><span>02</span><p><strong>Choose one area to grow.</strong><br />Set a focus and take the next practical step.</p></div>
              <div><span>03</span><p><strong>Show up consistently.</strong><br />Try a challenge, reflect, and notice your progress.</p></div>
              <div><span>04</span><p><strong>Keep your momentum.</strong><br />Connect with others and choose what comes next.</p></div>
            </div>
          </div>
        </section>

        <section className="section signup-section" id="join">
          <div className="wrap">
            <div className="section-heading">
              <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
              <h2>Give yourself <em>30 days.</em></h2>
              <p>Two simple ways to begin your Fixer Nation journey.</p>
            </div>
            <div className="signup-grid">
              <div className="signup-card primary">
                <span className="card-tag">FULL EXPERIENCE</span>
                <h3>30-Day Fixer Nation Trial</h3>
                <p>Explore the Morning Boost and the member tools designed to help you set goals, build habits, track progress, and connect.</p>
                <ul>
                  <li>Morning Boost and member experiences</li>
                  <li>Goals, plans, pathways and challenges</li>
                  <li>Reflections, progress and Brain Builder</li>
                  <li>Positive community connection</li>
                </ul>
                <button type="button" className="btn btn-gold full" id="membership-cta" onClick={handleMembershipCta}>
                  Start my free 30-day trial →
                </button>
                <p className="disclosure">Trial billing and renewal details will be shown in the connected membership checkout. Confirm terms before publishing.</p>
              </div>

              <div className="signup-card secondary" id="boost-signup">
                <span className="card-tag">START SIMPLE</span>
                <h3>30 Days of Morning Boosts</h3>
                <p>Want to begin with just a few positive minutes every morning? Sign up to receive the Morning Boost for 30 days.</p>
                <form id="boost-form" noValidate onSubmit={handleBoostSubmit}>
                  <label htmlFor="firstName">First name</label>
                  <input type="text" id="firstName" name="firstName" autoComplete="given-name" maxLength={80} required placeholder="Your first name" />
                  <label htmlFor="email">Email address</label>
                  <input type="email" id="email" name="email" autoComplete="email" maxLength={254} required placeholder="you@example.com" />
                  <label className="check">
                    <input type="checkbox" id="consent" name="consent" required />
                    <span>I agree to receive the 30-day Morning Boost email series and related Fixer Nation follow-up emails. I understand I can unsubscribe at any time.</span>
                  </label>
                  <button className="btn full" type="submit" disabled={submitting}>
                    {submitting ? "Submitting…" : "Send me 30 days of Morning Boosts →"}
                  </button>
                  <p className="form-status" role="status" aria-live="polite">{formStatus}</p>
                </form>
                <p className="disclosure">Please connect this form to your email provider and configure consent and privacy links before publishing.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="last-word">
          <div className="wrap">
            <span className="tiny-star">✦</span>
            <h2>There are no problems in life—<br /><em>only issues and answers.</em></h2>
            <p>Welcome to Fixer Nation.</p>
            <a href="#join" className="btn btn-gold">Start your 30 days →</a>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap footer-grid">
          <img src="/images/trial-landing/fixer-nation-logo.png" alt="Fixer Nation logo" />
          <div>
            <strong>Fixer Nation Positivity, Health & Wellness Network</strong>
            <p>The Health Club for Your Mind, Body & Soul™</p>
            <p>© <span>{year}</span> Fixer Nation. All rights reserved.</p>
          </div>
          <div className="footer-links">
            <a href="https://fixernation.org/">Main website ↗</a>
            <span>Privacy and terms links: configure before launch.</span>
          </div>
        </div>
      </footer>

      {alertMessage && (
        <div className="setup-alert" role="alert" aria-live="assertive">
          <button type="button" aria-label="Close alert" onClick={() => setAlertMessage(null)}>×</button>
          <strong>Connection needed</strong>
          <p>{alertMessage}</p>
        </div>
      )}

      <style jsx global>{`
        .fn-trial-landing{--blue:#0b347b;--navy:#102b4d;--gold:#f6ac31;--cream:#f9f7f3;--muted:#637084;--line:#e4e7eb;margin:0;font:16px/1.65 'DM Sans',Arial,sans-serif;color:var(--navy);background:#fff}
        .fn-trial-landing *{box-sizing:border-box}
        .fn-trial-landing h1,.fn-trial-landing h2,.fn-trial-landing h3,.fn-trial-landing .btn{font-family:Manrope,Arial,sans-serif}
        .fn-trial-landing h1,.fn-trial-landing h2,.fn-trial-landing h3{line-height:1.18;letter-spacing:-.035em}
        .fn-trial-landing h1{font-size:clamp(2.7rem,5vw,5rem);font-weight:800;margin:26px 0}
        .fn-trial-landing h2{font-size:clamp(2.2rem,3.65vw,3.65rem);margin:14px 0 23px}
        .fn-trial-landing h3{font-size:1.22rem}
        .fn-trial-landing .hero h1,.fn-trial-landing .community h2,.fn-trial-landing .last-word h2{color:#fff}
        .fn-trial-landing p{margin:0 0 17px}
        .fn-trial-landing .wrap{width:min(1160px,calc(100% - 48px));margin:auto}
        .fn-trial-landing .skip{position:absolute;left:-9999px}
        .fn-trial-landing .skip:focus{left:12px;top:10px;background:white;z-index:1000}
        .fn-trial-landing .site-header{background:#fff;position:relative;z-index:5;border-bottom:1px solid #edf0f4}
        .fn-trial-landing .header-flex{min-height:96px;display:flex;align-items:center;gap:35px;justify-content:space-between}
        .fn-trial-landing .brand img{width:280px;max-width:100%;height:auto;display:block}
        .fn-trial-landing .site-header nav{display:flex;gap:28px}
        .fn-trial-landing .site-header nav a{color:var(--navy);text-decoration:none;font-weight:700;font-size:14px}
        .fn-trial-landing .btn{border:0;display:inline-flex;align-items:center;justify-content:center;gap:15px;background:var(--blue);color:#fff;text-decoration:none;border-radius:12px;padding:16px 25px;font-size:14px;font-weight:800;cursor:pointer;transition:transform .2s,filter .2s}
        .fn-trial-landing .btn:hover{transform:translateY(-2px);filter:brightness(1.07)}
        .fn-trial-landing .btn:focus-visible,.fn-trial-landing a:focus-visible,.fn-trial-landing input:focus-visible{outline:3px solid #e49b11;outline-offset:3px}
        .fn-trial-landing .btn-sm{padding:13px 18px;white-space:nowrap}
        .fn-trial-landing .btn-gold{background:var(--gold);color:#122944}
        .fn-trial-landing .full{width:100%}
        .fn-trial-landing .hero{position:relative;overflow:hidden;background:linear-gradient(117deg,#0a2a66 0%,#11438e 54%,#1c6ea2 100%);color:#fff}
        .fn-trial-landing .hero:after{content:'';position:absolute;width:660px;height:660px;border:1px solid #ffffff18;border-radius:50%;right:-170px;top:-210px}
        .fn-trial-landing .sun-glow{position:absolute;width:500px;height:500px;right:16%;bottom:-380px;background:#f2c46c33;filter:blur(80px);border-radius:50%}
        .fn-trial-landing .hero-grid{position:relative;z-index:1;display:grid;grid-template-columns:1.1fr .9fr;align-items:center;min-height:670px;gap:60px;padding:80px 0}
        .fn-trial-landing .eyebrow{font-size:12px;font-weight:800;letter-spacing:.19em;color:#9a5f0f;background:none;padding:0;display:inline}
        .fn-trial-landing .eyebrow.light{color:#fac877}
        .fn-trial-landing .hero h1 em,.fn-trial-landing .community h2 em,.fn-trial-landing .last-word em{color:#ffcc73}
        .fn-trial-landing .hero h1 em,.fn-trial-landing h2 em{font-style:normal}
        .fn-trial-landing .lead{font-size:20px;color:#e2edfb;max-width:600px}
        .fn-trial-landing .hero-ctas{display:flex;flex-wrap:wrap;align-items:center;gap:24px;margin:30px 0}
        .fn-trial-landing .text-link{font-weight:700;font-size:14px;text-underline-offset:4px}
        .fn-trial-landing .light-link{color:#fff}
        .fn-trial-landing .hero-fine{color:#cddcf0;font-size:13px}
        .fn-trial-landing .hero-art{height:495px;position:relative}
        .fn-trial-landing .orbit{position:absolute;border-radius:50%;border:1px solid #d7eaff42}
        .fn-trial-landing .orbit-one{width:470px;height:470px;top:8px;left:3px}
        .fn-trial-landing .orbit-two{width:340px;height:340px;top:73px;left:68px}
        .fn-trial-landing .floating-card{position:absolute;background:#fff;color:var(--navy);border-radius:23px;box-shadow:0 24px 65px #071d4e7d}
        .fn-trial-landing .morning-card{top:42px;left:37px;width:330px;height:335px;padding:28px;display:flex;flex-direction:column;align-items:flex-start}
        .fn-trial-landing .micro{font-size:10px;letter-spacing:.16em;font-weight:800;color:#a06924}
        .fn-trial-landing .sun-icon{font-size:65px;line-height:1.4}
        .fn-trial-landing .morning-card strong{font-family:Manrope;font-size:30px;line-height:1.2}
        .fn-trial-landing .mini{color:#647082;font-size:13px;margin-top:12px}
        .fn-trial-landing .play-shape{margin-top:20px;padding:11px 16px;border-radius:9px;background:#f7b03f;color:#112c56;font-size:11px;font-weight:800}
        .fn-trial-landing .goals-card{right:-8px;bottom:38px;width:264px;padding:23px;transform:rotate(4deg)}
        .fn-trial-landing .goals-card strong{display:block;margin-top:12px;font-size:18px}
        .fn-trial-landing .progress-line{height:9px;background:#e8ecf3;border-radius:5px;margin-top:18px;overflow:hidden}
        .fn-trial-landing .progress-line i{display:block;background:#f5b038;width:68%;height:100%;border-radius:5px}
        .fn-trial-landing .floating-pill{position:absolute;bottom:10px;left:18px;background:#fff1cf;color:#17386a;border-radius:30px;padding:11px 17px;font-weight:800;font-size:12px;box-shadow:0 9px 25px #071d4e44}
        .fn-trial-landing .trust-strip{background:#fff7e8;color:#29446d}
        .fn-trial-landing .trust-inner{display:flex;justify-content:space-around;gap:20px;align-items:center;padding:22px 0;font-size:11px;font-weight:800;letter-spacing:.14em}
        .fn-trial-landing .star{color:#e9a22a}
        .fn-trial-landing .section{padding:105px 0}
        .fn-trial-landing .split{display:grid;grid-template-columns:1fr 1fr;gap:90px;align-items:center}
        .fn-trial-landing .section h2 em{color:#b06a12}
        .fn-trial-landing .section-lead{font-size:19px;color:#546579}
        .fn-trial-landing .benefit-lines{margin:30px 0}
        .fn-trial-landing .benefit-lines>div{display:flex;align-items:flex-start;gap:16px;margin:15px 0}
        .fn-trial-landing .benefit-lines span{font-size:28px}
        .fn-trial-landing .benefit-lines p{margin:0;color:#5e6f84}
        .fn-trial-landing .benefit-lines strong{color:var(--navy)}
        .fn-trial-landing .boost-visual{min-height:470px;border-radius:30px;background:linear-gradient(150deg,#e3f2fa,#f9dfaa);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:40px}
        .fn-trial-landing .boost-sun{position:absolute;width:270px;height:270px;border-radius:50%;background:radial-gradient(#ffdb8a,#f2b34e88,#f2b34e00);top:13px;right:3px}
        .fn-trial-landing .boost-card{position:relative;display:block;width:100%;background:#fff;border-radius:22px;overflow:hidden;text-decoration:none;color:var(--navy);box-shadow:0 30px 55px #0d24504a}
        .fn-trial-landing .boost-card img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover}
        .fn-trial-landing .boost-card-body{padding:26px 28px 28px}
        .fn-trial-landing .boost-card-body h3{font-size:28px;margin:8px 0 10px;color:var(--navy)}
        .fn-trial-landing .boost-card-body p{color:#5a687a;margin:0 0 16px}
        .fn-trial-landing .boost-card-link{font-weight:800;font-size:14px;color:var(--blue)}
        .fn-trial-landing .section-soft{background:var(--cream)}
        .fn-trial-landing .section-heading{text-align:center;max-width:750px;margin:0 auto 50px}
        .fn-trial-landing .section-heading p{font-size:18px;color:#627083}
        .fn-trial-landing .features-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:17px}
        .fn-trial-landing .feature{padding:28px 24px;border:1px solid #e6e8ec;background:#fff;border-radius:19px;box-shadow:0 7px 22px #0d376006}
        .fn-trial-landing .feature-icon{font-size:30px}
        .fn-trial-landing .feature h3{margin:17px 0 10px}
        .fn-trial-landing .feature p{font-size:14px;color:#667184;margin:0}
        .fn-trial-landing .screens-gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:26px}
        .fn-trial-landing .screen-tile{margin:0;border:1px solid #e3e7ee;border-radius:20px;overflow:hidden;box-shadow:0 14px 35px #102d4a0e;background:#fff}
        .fn-trial-landing .screen-tile img{display:block;width:100%;height:250px;object-fit:contain;background:#f7f6f3;padding:12px}
        .fn-trial-landing .screen-tile.wide{grid-column:span 2}
        .fn-trial-landing .screen-tile.wide img{height:320px}
        .fn-trial-landing .screen-tile figcaption{padding:18px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
        .fn-trial-landing .screen-tile figcaption span{color:#617188;font-size:13px}
        .fn-trial-landing .community{background:linear-gradient(125deg,#102a59,#0e4786);color:#fff}
        .fn-trial-landing .community-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
        .fn-trial-landing .community h2 em{color:#ffc86c}
        .fn-trial-landing .community p{color:#d6e3f1}
        .fn-trial-landing .community-art{min-height:370px;position:relative;display:flex;justify-content:center;align-items:center;background:radial-gradient(circle,#67afda50,transparent 65%)}
        .fn-trial-landing .community-spark{font-size:160px;color:#eab54f;opacity:.25}
        .fn-trial-landing .community-bubble{position:absolute;max-width:255px;border-radius:19px;padding:19px 22px;background:#fff;color:#16395e;font-size:15px;font-weight:700;box-shadow:0 12px 25px #06244e77}
        .fn-trial-landing .community-bubble.one{top:30px;left:0}
        .fn-trial-landing .community-bubble.two{right:7px;top:140px}
        .fn-trial-landing .community-bubble.three{bottom:17px;left:52px}
        .fn-trial-landing .daily{background:#fffaf3}
        .fn-trial-landing .daily-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:90px}
        .fn-trial-landing .daily-grid>div>p{font-size:18px;color:#657286}
        .fn-trial-landing .timeline{border-left:2px solid #e7c27c;padding-left:35px}
        .fn-trial-landing .timeline>div{display:flex;gap:23px;margin-bottom:22px;align-items:start}
        .fn-trial-landing .timeline span{background:#f8b745;flex:0 0 44px;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-weight:800}
        .fn-trial-landing .timeline p{color:#637187}
        .fn-trial-landing .timeline strong{color:#173c6a}
        .fn-trial-landing .signup-section{background:#edf4f8}
        .fn-trial-landing .signup-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:25px}
        .fn-trial-landing .signup-card{background:#fff;border-radius:24px;border:1px solid #dfe6ed;padding:40px;display:flex;flex-direction:column;box-shadow:0 15px 35px #173e5b13}
        .fn-trial-landing .signup-card.primary{border:2px solid #efae43}
        .fn-trial-landing .card-tag{font-weight:800;color:#9a5f0f;font-size:11px;letter-spacing:.12em}
        .fn-trial-landing .signup-card h3{font-size:26px;margin:16px 0}
        .fn-trial-landing .signup-card p{color:#5a687a}
        .fn-trial-landing .signup-card ul{list-style:disc;padding-left:23px;margin:10px 0 34px;line-height:2;color:#243c5c}
        .fn-trial-landing .signup-card.primary .btn{margin-top:auto}
        .fn-trial-landing .disclosure{font-size:12px!important;color:#5f6b7a!important;margin-top:16px}
        .fn-trial-landing .signup-card form{display:flex;flex-direction:column;gap:10px;margin-top:8px}
        .fn-trial-landing .signup-card label{font-weight:700;font-size:13px}
        .fn-trial-landing .signup-card input:not([type=checkbox]){font:inherit;padding:15px 16px;width:100%;border:1px solid #cbd5df;border-radius:9px;background:white}
        .fn-trial-landing .check{display:flex;gap:10px;align-items:flex-start;font-weight:400!important;line-height:1.55;margin:12px 0}
        .fn-trial-landing .check input{margin-top:5px}
        .fn-trial-landing .check span{font-size:12px;color:#546579}
        .fn-trial-landing .form-status{font-size:13px;margin:0}
        .fn-trial-landing .last-word{background:#0d2b60;color:#fff;text-align:center;padding:82px 20px}
        .fn-trial-landing .last-word h2{font-size:clamp(1.9rem,3vw,3rem)}
        .fn-trial-landing .last-word p{color:#e6edf5}
        .fn-trial-landing .tiny-star{font-size:35px;color:#edb03c}
        .fn-trial-landing footer{padding:45px 0;background:#fff}
        .fn-trial-landing .footer-grid{display:flex;gap:45px;align-items:center;font-size:12px;color:#677487}
        .fn-trial-landing .footer-grid img{width:200px}
        .fn-trial-landing .footer-grid p{margin:3px 0}
        .fn-trial-landing .footer-grid strong{color:#193c6d}
        .fn-trial-landing .footer-links{margin-left:auto;display:flex;flex-direction:column;gap:7px}
        .fn-trial-landing .footer-links a{color:#17437b}
        .fn-trial-landing .setup-alert{position:fixed;z-index:10;bottom:20px;right:20px;background:#102d53;color:#fff;max-width:390px;padding:22px 40px 20px 20px;border:2px solid #ffcf76;border-radius:14px;box-shadow:0 14px 45px #0006}
        .fn-trial-landing .setup-alert p{font-size:13px;margin:8px 0 0}
        .fn-trial-landing .setup-alert button{position:absolute;right:10px;top:5px;border:0;background:transparent;color:white;font-size:25px;cursor:pointer}
        @media(max-width:1000px){
          .fn-trial-landing .site-header nav{display:none}
          .fn-trial-landing .hero-grid{gap:15px}
          .fn-trial-landing .hero-art{transform:scale(.82);transform-origin:center}
          .fn-trial-landing .features-grid{grid-template-columns:repeat(2,1fr)}
          .fn-trial-landing .split,.fn-trial-landing .community-grid{gap:40px}
        }
        @media(max-width:720px){
          .fn-trial-landing .wrap{width:min(100% - 36px,540px)}
          .fn-trial-landing .header-flex{min-height:80px;gap:14px}
          .fn-trial-landing .brand img{width:185px}
          .fn-trial-landing .btn-sm{padding:10px 11px;font-size:10px}
          .fn-trial-landing .hero-grid,.fn-trial-landing .split,.fn-trial-landing .community-grid,.fn-trial-landing .daily-grid,.fn-trial-landing .signup-grid{grid-template-columns:1fr}
          .fn-trial-landing .hero-grid{padding:70px 0 35px;min-height:auto}
          .fn-trial-landing .hero h1{font-size:clamp(2.55rem,10vw,3.7rem)}
          .fn-trial-landing .lead{font-size:17px}
          .fn-trial-landing .hero-art{height:375px;transform:scale(.78);transform-origin:top center;width:440px;max-width:100%;margin:auto}
          .fn-trial-landing .goals-card{right:0}
          .fn-trial-landing .trust-inner{flex-wrap:wrap;gap:9px;font-size:9px}
          .fn-trial-landing .trust-inner .star{display:none}
          .fn-trial-landing .section{padding:72px 0}
          .fn-trial-landing .section h2{font-size:2.3rem}
          .fn-trial-landing .features-grid{grid-template-columns:1fr}
          .fn-trial-landing .screen-tile.wide{grid-column:span 1}
          .fn-trial-landing .screens-gallery{grid-template-columns:1fr}
          .fn-trial-landing .screen-tile img,.fn-trial-landing .screen-tile.wide img{height:210px}
          .fn-trial-landing .screen-tile figcaption{display:block}
          .fn-trial-landing .screen-tile figcaption span{display:block}
          .fn-trial-landing .boost-visual{min-height:375px;padding:24px}
            .fn-trial-landing .community-art{min-height:300px}
          .fn-trial-landing .community-bubble{font-size:12px}
          .fn-trial-landing .daily-grid{gap:30px}
          .fn-trial-landing .signup-card{padding:26px}
          .fn-trial-landing .footer-grid{flex-direction:column;align-items:flex-start;gap:12px}
          .fn-trial-landing .footer-links{margin:0}
          .fn-trial-landing .hero-ctas{align-items:flex-start;flex-direction:column}
        }
        @media(prefers-reduced-motion:reduce){
          .fn-trial-landing *,.fn-trial-landing *:before,.fn-trial-landing *:after{scroll-behavior:auto!important;transition:none!important}
        }
      `}</style>
    </div>
  );
};

export default TrialLandingPage;
