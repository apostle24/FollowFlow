import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  MessageSquare,
  Mail,
  ShieldCheck,
  Zap,
  TrendingUp,
  HelpCircle,
  Users,
  ChevronRight,
} from 'lucide-react';

interface LandingPageProps {
  onSeeDemo?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = () => {
  const { openAuthModal, signInDemo } = useAuth();

  const handleScrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500 selection:text-white">
      {/* 1. Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-200">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">FollowFlow</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <button onClick={() => handleScrollToSection('problem')} className="hover:text-slate-900 transition-colors">
              The Problem
            </button>
            <button onClick={() => handleScrollToSection('how-it-works')} className="hover:text-slate-900 transition-colors">
              How It Works
            </button>
            <button onClick={() => handleScrollToSection('features')} className="hover:text-slate-900 transition-colors">
              Features
            </button>
            <button onClick={() => handleScrollToSection('pricing')} className="hover:text-slate-900 transition-colors">
              Pricing
            </button>
            <button onClick={() => handleScrollToSection('faq')} className="hover:text-slate-900 transition-colors">
              FAQ
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuthModal('login')}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => openAuthModal('register')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm shadow-blue-200 transition-all flex items-center gap-1.5"
            >
              Start Free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold mb-6 animate-in fade-in slide-in-from-top-3 duration-300">
            <Sparkles className="w-3.5 h-3.5" />
            AI-Powered Revenue Follow-Up Assistant
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12] mb-6">
            Never Lose Money Because <br className="hidden sm:inline" />
            <span className="text-blue-600">You Forgot to Follow Up.</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 leading-relaxed mb-10">
            FollowFlow helps freelancers, agencies, and service providers know exactly who needs attention, what to say, and when to follow up — before deals go cold.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
            <button
              onClick={() => openAuthModal('register')}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-sm shadow-blue-200 hover:shadow-md transition-all flex items-center justify-center gap-2"
            >
              Start Free Today
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => signInDemo()}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 text-base font-bold transition-all shadow-2xs flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-600 fill-amber-500" />
              1-Click Instant Demo
            </button>
            <button
              onClick={() => handleScrollToSection('how-it-works')}
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-50 text-base font-semibold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              See How It Works
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Social Proof Pills */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Free 20 contacts & 10 follow-ups
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No credit card required
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 1-Click WhatsApp & Email
            </div>
          </div>
        </div>

        {/* Hero Interactive Visual Queue Preview */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-12">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Priority Follow-Up Engine</span>
                <h3 className="text-xl font-bold text-slate-900 mt-0.5">Real-time daily focus feed</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Context-Aware AI
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  Zero Hallucinations
                </span>
              </div>
            </div>

            {/* Workflow Capability Highlights */}
            <div className="space-y-3 mt-6">
              {/* Feature 1 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">Overdue & Pipeline Detection</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold uppercase text-[10px]">
                        Smart Sorting
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Surfaces outstanding proposals, invoices, and leads that need attention right now.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Try With Your Data
                  </button>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900">1-Click Direct Outreach</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold uppercase text-[10px]">
                        WhatsApp & Email
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Pre-fills your messaging app with concise, tone-tailored messages ready for your review and send.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    Get Started Free
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Problem Section */}
      <section id="problem" className="py-20 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">The Silent Revenue Leak</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2 tracking-tight">
              Every missed follow-up is a missed opportunity.
            </h2>
            <p className="text-slate-400 mt-4 text-base sm:text-lg">
              Freelancers and small agencies are busy delivering client work. Follow-ups slip through the cracks, leading to unpaid invoices and forgotten leads.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold mb-4">
                1
              </div>
              <h3 className="text-lg font-bold text-white">The Proposal Black Hole</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                You send a proposal or quote. You get busy. A week passes. You feel awkward reaching out, and the client hires someone who followed up first.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold mb-4">
                2
              </div>
              <h3 className="text-lg font-bold text-white">Unpaid Overdue Invoices</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Clients aren't necessarily ignoring you — they’re busy too. Without timely gentle reminders, invoices sit unpaid for weeks, suffocating your cash flow.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold mb-4">
                3
              </div>
              <h3 className="text-lg font-bold text-white">CRM Fatigue & Overkill</h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Enterprise CRMs are bloated and complicated. You don't need a 50-field database; you just need to know <em>who to message right now</em>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How FollowFlow Works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Zero Friction</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">
              How FollowFlow works in 3 steps
            </h2>
            <p className="text-slate-600 mt-3 text-base">
              Designed to take less than 60 seconds of your day so you can get back to billable work.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg mb-5 shadow-sm shadow-blue-200">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">Check Today's Queue</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Open your dashboard. FollowFlow automatically calculates which proposals, invoices, or leads need a check-in today based on priority and days overdue.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg mb-5 shadow-sm shadow-blue-200">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">Generate AI Message</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Pick your tone (Friendly, Firm, Professional). AI generates a natural, contextual message with zero hallucinations, perfectly formatted for your channel.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg mb-5 shadow-sm shadow-blue-200">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">1-Click WhatsApp or Email</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Click “Open WhatsApp” or “Open Email”. Your client conversation opens with the message pre-filled. Hit send, mark complete, and get paid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Features Section */}
      <section id="features" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Engineered for Results</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">
              Features built for revenue protection
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900">Context-Aware AI</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Never sends robotic templates. Uses your specific project details, overdue days, and amounts to write thoughtful messages.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-4">
                <DollarSign className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900">Money Waiting Tracker</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Calculates the exact monetary value tied up in active proposals and pending invoices, keeping you focused on high-yield actions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900">Smart Priority Engine</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Automatically flags items as Urgent, High, or Medium based on overdue days, potential deal value, and lead stage.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900">1-Click WhatsApp & Email</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Direct integration with your native WhatsApp app and default email client with zero complicated webhook setups.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900">Total Data Privacy</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Strict multi-tenant security rules with isolated Firestore partitions. Your client data is completely private to you.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900">Mobile-First Workflow</h4>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Follow up between meetings directly from your phone. Fast, fluid, and responsive on all mobile devices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Fair & Predictable</span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-2">
              Start free, upgrade when you grow
            </h2>
            <p className="text-slate-600 mt-3 text-base">
              A single converted proposal or recovered invoice pays for years of FollowFlow Pro.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Free Tier</h3>
                <p className="text-xs text-slate-500 mt-1">Perfect for solo freelancers getting started</p>
                <p className="text-4xl font-extrabold text-slate-900 my-6">$0 <span className="text-sm font-medium text-slate-500">/ forever</span></p>

                <ul className="space-y-3 text-sm text-slate-600">
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Up to 20 saved contacts</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Up to 10 active follow-ups</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 25 AI follow-up message generations</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> 1-Click WhatsApp & Email</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> Money Waiting tracker</li>
                </ul>
              </div>

              <button
                onClick={() => openAuthModal('register')}
                className="w-full mt-8 py-3.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-bold text-sm transition-colors shadow-sm"
              >
                Start Free
              </button>
            </div>

            {/* Pro */}
            <div className="p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-2xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                Recommended
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <h3 className="text-xl font-bold text-white">Pro Plan</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">For active agencies, consultants, and growth</p>
                <p className="text-4xl font-extrabold text-white my-6">$9 <span className="text-sm font-medium text-slate-400">/ month</span></p>

                <ul className="space-y-3 text-sm text-slate-300">
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> <strong>Unlimited</strong> contacts</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> <strong>Unlimited</strong> active follow-ups</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> <strong>Unlimited</strong> AI message generations</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Multi-step follow-up sequences</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> CSV Contact import & export</li>
                  <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> Priority support</li>
                </ul>
              </div>

              <button
                onClick={() => openAuthModal('register')}
                className="w-full mt-8 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2"
              >
                Get Started with Pro
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ Section */}
      <section id="faq" className="py-20 bg-slate-50 border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Got Questions?</span>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-2">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h4 className="font-bold text-slate-900 text-base">Is FollowFlow a generic CRM?</h4>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                No. Most CRMs are complex databases designed for enterprise sales teams. FollowFlow is laser-focused on answering: <em>"Who do I need to follow up with today?"</em> and giving you the exact message to send.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h4 className="font-bold text-slate-900 text-base">Does FollowFlow send messages automatically without my permission?</h4>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Never. FollowFlow pre-fills your WhatsApp or Email client with the generated message. You always have 100% control to review, tweak, and press send yourself.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h4 className="font-bold text-slate-900 text-base">Does the AI invent or hallucinate information?</h4>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                No. Our AI prompts are strictly engineered to only reference the names, dates, amounts, and context you provided in your follow-up notes.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200">
              <h4 className="font-bold text-slate-900 text-base">Is FollowFlow an accounting or bookkeeping tool?</h4>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                No. "Money Waiting" tracks active opportunity and invoice follow-ups so you know your potential revenue pipeline. FollowFlow does not prepare taxes or replace accounting software.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="py-20 bg-slate-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-6">
            Ready to stop losing revenue to forgotten follow-ups?
          </h2>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-8">
            Built for freelancers, agencies, consultants, and service businesses that don't want opportunities slipping through the cracks.
          </p>
          <button
            onClick={() => openAuthModal('register')}
            className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-base font-bold shadow-xl shadow-blue-900/50 transition-all inline-flex items-center gap-2"
          >
            Create Your Free Account
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="py-12 bg-slate-950 text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-white text-sm">FollowFlow</span>
            <span className="ml-2 text-slate-500">© {new Date().getFullYear()} FollowFlow. All rights reserved.</span>
          </div>
          <p className="text-slate-500">
            FollowFlow is a revenue follow-up assistant and is not accounting or legal advice software.
          </p>
        </div>
      </footer>
    </div>
  );
};
