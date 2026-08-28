import React, { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap, Brain, Zap, Sparkles, Star, Upload, Play, ChevronRight, FileText, Layers, CheckCircle, ArrowRight } from 'lucide-react';
import { Footer } from './Footer';

/* ------------------------------------------------------------------ */
/*  Motion helpers                                                     */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/* ------------------------------------------------------------------ */
/*  Animated wrapper - honors reduced motion                           */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  variants = fadeUp,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  variants?: typeof fadeUp;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={variants}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Home Component                                                */
/* ------------------------------------------------------------------ */

export function Home() {
  const testimonialsRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-white flex flex-col font-body selection:bg-duo-green-subtle selection:text-duo-charcoal">
      {/* ============================================================ */}
      {/*  NAVIGATION - sticky, single line, max 72px                  */}
      {/* ============================================================ */}
      <header className="bg-white border-b-2 border-duo-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/icon.png"
                alt="Gemini Flashcards Icon"
                className="w-10 h-10 rounded-duo-md object-contain"
              />
              <span className="text-2xl font-heading font-extrabold text-duo-charcoal tracking-tight">
                Gemini Flashcards
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="duo-label text-duo-pencil hover:text-duo-charcoal transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="duo-label text-duo-pencil hover:text-duo-charcoal transition-colors">
                How It Works
              </a>
              <a href="#testimonials" className="duo-label text-duo-pencil hover:text-duo-charcoal transition-colors">
                Reviews
              </a>
            </nav>

            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="duo-label text-duo-blue hover:text-duo-blue-dark px-3 py-2 transition-colors hidden sm:inline-block"
              >
                Log In
              </a>
              <a
                href="/login"
                className="btn-duo-green duo-label px-6 py-2.5 text-sm"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* ============================================================ */}
        {/*  HERO - Asymmetric Split (left copy, right image)            */}
        {/*  Layout family: split-hero                                   */}
        {/*  Eyebrow: YES (1 of 2)                                       */}
        {/* ============================================================ */}
        <section className="pt-16 pb-20 md:pt-20 md:pb-28 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
              {/* Left: Copy */}
              <Reveal>
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-duo-green-subtle rounded-duo-pill border-2 border-duo-green">
                    <Sparkles className="w-4 h-4 text-duo-green fill-duo-green" />
                    <span className="text-duo-charcoal font-bold text-xs uppercase tracking-wider">
                      Powered by Google Gemini AI
                    </span>
                  </div>

                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-black text-duo-charcoal leading-[1.12] tracking-tight">
                    Free. Fun. <br />
                    <span className="text-duo-green">Effective flashcards.</span>
                  </h1>

                  <p className="text-lg md:text-xl text-duo-pencil max-w-lg leading-relaxed font-medium">
                    Create study flashcards instantly from PDFs, documents, or any topic with AI.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-4 pt-2">
                    <a
                      href="/login"
                      className="btn-duo-green duo-label px-8 py-4 text-base tracking-wider flex items-center justify-center gap-2 shadow-duo-green"
                    >
                      <span>Get Started</span>
                      <ChevronRight className="w-5 h-5 stroke-[3]" />
                    </a>
                    <a
                      href="#how-it-works"
                      className="btn-duo-white duo-label px-8 py-4 text-base tracking-wider flex items-center justify-center gap-2"
                    >
                      See How It Works
                    </a>
                  </div>
                </div>
              </Reveal>

              {/* Right: Generated Hero Illustration */}
              <Reveal delay={0.15} variants={scaleIn}>
                <div className="relative">
                  <img
                    src="/hero-illustration.png"
                    alt="Playful owl mascot with floating flashcards showing questions and answers"
                    className="w-full max-w-lg mx-auto rounded-duo-xl"
                    width={640}
                    height={480}
                    loading="eager"
                  />
                  {/* Floating badge - gold star */}
                  <div className="absolute -top-3 -right-2 md:-top-5 md:-right-4 w-12 h-12 md:w-14 md:h-14 bg-duo-gold rounded-2xl border-2 border-duo-gold-dark shadow-duo-gold flex items-center justify-center animate-bounce-subtle z-20">
                    <Star className="w-6 h-6 md:w-7 md:h-7 text-white fill-white" />
                  </div>
                  {/* Floating badge - AI */}
                  <div className="absolute -bottom-3 -left-2 md:-bottom-4 md:-left-4 px-4 py-2 bg-duo-blue rounded-duo-md border-2 border-duo-blue-dark shadow-duo-blue text-white font-extrabold text-xs tracking-wider uppercase flex items-center gap-1.5 z-20">
                    <Zap className="w-4 h-4 fill-white" /> Instant AI
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  HOW IT WORKS - Horizontal timeline with numbered steps      */}
        {/*  Layout family: horizontal-timeline                          */}
        {/*  Eyebrow: NO                                                 */}
        {/* ============================================================ */}
        <section id="how-it-works" className="py-20 md:py-28 bg-duo-blue-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-5xl font-heading font-black text-duo-charcoal tracking-tight">
                  Create Flashcards in Seconds
                </h2>
                <p className="text-duo-pencil text-lg font-medium max-w-xl mx-auto mt-3">
                  No tedious typing. Turn notes and documents into study sets instantly.
                </p>
              </div>
            </Reveal>

            {/* Horizontal timeline on desktop, vertical on mobile */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 gap-0 relative"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              variants={staggerContainer}
            >
              {/* Connecting line - desktop only */}
              <div className="hidden md:block absolute top-12 left-[16.7%] right-[16.7%] h-1 bg-duo-border rounded-full z-0" />

              <TimelineStep
                step={1}
                color="duo-blue"
                icon={<Upload className="w-7 h-7 text-duo-blue" />}
                title="Upload or Paste"
                description="Drop PDFs, lecture slides, Word docs, or simply type any topic you want to master."
              />
              <TimelineStep
                step={2}
                color="duo-gold"
                icon={<Sparkles className="w-7 h-7 text-duo-gold" />}
                title="AI Generates Cards"
                description="Google Gemini AI reads your content and creates clear, memorable question-answer pairs."
              />
              <TimelineStep
                step={3}
                color="duo-green"
                icon={<Play className="w-7 h-7 text-duo-green" />}
                title="Study and Quiz"
                description="Flip through cards in Study Mode or test your recall with interactive Quiz Mode."
              />
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  FEATURES - Asymmetric bento grid (image + text tiles)       */}
        {/*  Layout family: bento-grid                                   */}
        {/*  Eyebrow: YES (2 of 2)                                       */}
        {/* ============================================================ */}
        <section id="features" className="py-20 md:py-28 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="text-center mb-14">
                <span className="inline-block px-4 py-1.5 bg-duo-blue-subtle text-duo-blue font-bold text-xs uppercase tracking-widest rounded-full border-2 border-duo-blue mb-3">
                  Built For Learners
                </span>
                <h2 className="text-3xl md:text-5xl font-heading font-black text-duo-charcoal tracking-tight">
                  Everything You Need to Learn
                </h2>
              </div>
            </Reveal>

            {/* Bento: 4 cells - large image cell + 3 text cells */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              variants={staggerContainer}
            >
              {/* Large vertical feature card spanning 2 rows on lg */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="card-duo overflow-hidden md:col-span-2 lg:col-span-1 lg:row-span-2 group bg-white flex flex-col justify-between hover:border-duo-green transition-all"
              >
                <div className="p-7">
                  <div className="w-14 h-14 bg-duo-green-subtle rounded-2xl border-2 border-duo-green flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-7 h-7 text-duo-green" />
                  </div>
                  <h3 className="font-heading font-extrabold text-duo-charcoal mb-2 text-xl">
                    Smart Document Parsing
                  </h3>
                  <p className="text-duo-pencil text-sm leading-relaxed font-medium">
                    Upload long PDFs or lecture notes and watch AI automatically organize key concepts into study-ready cards.
                  </p>
                </div>
                <div className="px-6 pb-6 pt-0 flex items-center justify-center">
                  <img
                    src="/ai-generation.jpg"
                    alt="PDF documents being transformed into organized flashcards through AI processing"
                    className="w-full max-w-[280px] h-auto object-contain group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              </motion.div>

              {/* Feature tile 1 */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="card-duo p-7 hover:border-duo-green transition-all group"
              >
                <div className="w-14 h-14 bg-duo-green-subtle rounded-2xl border-2 border-duo-green flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <Brain className="w-7 h-7 text-duo-green" />
                </div>
                <h3 className="font-heading font-extrabold text-duo-charcoal mb-2 text-lg">AI Flashcard Engine</h3>
                <p className="text-duo-pencil text-sm leading-relaxed font-medium">
                  Google Gemini AI distills complex concepts into clean, bite-sized study cards automatically.
                </p>
              </motion.div>

              {/* Feature tile 2 */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="card-duo p-7 hover:border-duo-blue transition-all group"
              >
                <div className="w-14 h-14 bg-duo-blue-subtle rounded-2xl border-2 border-duo-blue flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                  <FileText className="w-7 h-7 text-duo-blue" />
                </div>
                <h3 className="font-heading font-extrabold text-duo-charcoal mb-2 text-lg">PDF and File Import</h3>
                <p className="text-duo-pencil text-sm leading-relaxed font-medium">
                  Drag and drop textbooks, lecture handouts, or spreadsheets to generate cards instantly.
                </p>
              </motion.div>

              {/* Feature tile 3 - with study modes image background */}
              <motion.div
                variants={fadeUp}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="card-duo overflow-hidden md:col-span-2 group"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
                  <div className="p-7 flex flex-col justify-center">
                    <div className="w-14 h-14 bg-duo-gold-subtle rounded-2xl border-2 border-duo-gold flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                      <Zap className="w-7 h-7 text-duo-gold" />
                    </div>
                    <h3 className="font-heading font-extrabold text-duo-charcoal mb-2 text-lg">Interactive Quizzes</h3>
                    <p className="text-duo-pencil text-sm leading-relaxed font-medium">
                      Test your memory with multiple-choice questions, instant feedback, and score tracking.
                    </p>
                  </div>
                  <img
                    src="/feature-study-modes.jpg"
                    alt="Study Mode and Quiz Mode interfaces side by side"
                    className="w-full h-48 sm:h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  TESTIMONIALS - Horizontal scroll-snap carousel               */}
        {/*  Layout family: scroll-carousel                              */}
        {/*  Eyebrow: NO                                                 */}
        {/* ============================================================ */}
        <section id="testimonials" className="py-20 md:py-28 bg-duo-blue-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 gap-4">
                <div>
                  <h2 className="text-3xl md:text-5xl font-heading font-black text-duo-charcoal tracking-tight">
                    Loved by Students
                  </h2>
                  <p className="text-duo-pencil text-lg font-medium mt-2 max-w-md">
                    Thousands of learners create flashcards every day.
                  </p>
                </div>
                {/* Scroll arrows - desktop */}
                <div className="hidden md:flex items-center gap-2">
                  <button
                    onClick={() => testimonialsRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                    className="btn-duo-white w-11 h-11 !p-0 !rounded-full"
                    aria-label="Scroll reviews left"
                  >
                    <ArrowRight className="w-5 h-5 rotate-180 text-duo-charcoal" />
                  </button>
                  <button
                    onClick={() => testimonialsRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                    className="btn-duo-white w-11 h-11 !p-0 !rounded-full"
                    aria-label="Scroll reviews right"
                  >
                    <ArrowRight className="w-5 h-5 text-duo-charcoal" />
                  </button>
                </div>
              </div>
            </Reveal>

            {/* Horizontal scroll-snap carousel */}
            <div
              ref={testimonialsRef}
              className="flex gap-6 overflow-x-auto snap-x scrollbar-hide pb-4 -mx-4 px-4"
            >
              <TestimonialCard
                text="Creating flashcards used to take hours. Now I just drop my lecture slides in and get a full study deck in seconds!"
                name="Sarah Lindstrom"
                role="Medical Student"
                avatarColor="bg-duo-green-subtle text-duo-green"
              />
              <TestimonialCard
                text="The quiz mode makes studying algorithms and definitions actually enjoyable. I use it before every exam."
                name="David Kim"
                role="Computer Science Major"
                avatarColor="bg-duo-blue-subtle text-duo-blue"
              />
              <TestimonialCard
                text="I uploaded my 40-page law outline and received clean, accurate flashcards. Saved my exam prep completely."
                name="Emily Torres"
                role="Law Student"
                avatarColor="bg-duo-gold-subtle text-duo-gold-dark"
              />
              <TestimonialCard
                text="Best free tool for language vocab. I paste definitions and get quiz-ready cards in seconds. Nothing else compares."
                name="Marco Rossi"
                role="Language Learner"
                avatarColor="bg-duo-red-subtle text-duo-red"
              />
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  BOTTOM CTA - Full-width centered banner                     */}
        {/*  Layout family: cta-banner                                   */}
        {/*  Eyebrow: NO                                                 */}
        {/* ============================================================ */}
        <section className="py-20 md:py-28 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <Reveal>
              <div className="card-duo p-8 md:p-14 bg-white relative overflow-hidden">
                <h2 className="text-3xl md:text-4xl font-heading font-black text-duo-charcoal mb-3 tracking-tight">
                  Ready to make studying fun?
                </h2>
                <p className="text-duo-pencil text-base md:text-lg mb-8 max-w-xl mx-auto font-medium">
                  Create your first AI-powered deck today. Completely free, no credit card required.
                </p>
                <div className="flex justify-center">
                  <a
                    href="/login"
                    className="btn-duo-green duo-label px-10 py-4 text-base tracking-wider flex items-center gap-2 shadow-duo-green"
                  >
                    <span>Get Started</span>
                    <ChevronRight className="w-5 h-5 stroke-[3]" />
                  </a>
                </div>

                <div className="flex flex-wrap justify-center gap-6 mt-8 text-xs font-bold text-duo-pencil uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-duo-charcoal">
                    <CheckCircle className="w-4 h-4 text-duo-green" /> 100% Free
                  </span>
                  <span className="flex items-center gap-1.5 text-duo-charcoal">
                    <Zap className="w-4 h-4 text-duo-blue" /> Instant Setup
                  </span>
                  <span className="flex items-center gap-1.5 text-duo-charcoal">
                    <Layers className="w-4 h-4 text-duo-gold" /> Unlimited Cards
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline Step Component                                            */
/* ------------------------------------------------------------------ */

const TimelineStep = React.memo(function TimelineStep({
  step,
  color,
  icon,
  title,
  description,
}: {
  step: number;
  color: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const bgSubtle = color === 'duo-blue' ? 'bg-duo-blue-subtle' : color === 'duo-gold' ? 'bg-duo-gold-subtle' : 'bg-duo-green-subtle';
  const borderColor = color === 'duo-blue' ? 'border-duo-blue' : color === 'duo-gold' ? 'border-duo-gold' : 'border-duo-green';
  const bgSolid = color === 'duo-blue' ? 'bg-duo-blue' : color === 'duo-gold' ? 'bg-duo-gold' : 'bg-duo-green';
  const textColor = color === 'duo-gold' ? 'text-duo-charcoal' : 'text-white';

  return (
    <motion.div
      variants={fadeUp}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center px-4 py-6 relative z-10"
    >
      {/* Step number circle */}
      <div className={`w-24 h-24 ${bgSubtle} rounded-full ${borderColor} border-2 flex items-center justify-center mb-5 relative`}>
        {icon}
        <span className={`absolute -top-1 -right-1 w-8 h-8 ${bgSolid} ${textColor} rounded-full text-sm font-extrabold flex items-center justify-center border-2 border-white shadow-sm`}>
          {step}
        </span>
      </div>
      <h3 className="font-heading font-extrabold text-duo-charcoal mb-2 text-xl">{title}</h3>
      <p className="text-duo-pencil text-sm leading-relaxed font-medium max-w-xs">{description}</p>
    </motion.div>
  );
});

/* ------------------------------------------------------------------ */
/*  Testimonial Card Component                                         */
/* ------------------------------------------------------------------ */

const TestimonialCard = React.memo(function TestimonialCard({
  text,
  name,
  role,
  avatarColor,
}: {
  text: string;
  name: string;
  role: string;
  avatarColor: string;
}) {
  return (
    <div className="card-duo p-6 flex flex-col justify-between min-w-[300px] max-w-[340px] flex-shrink-0 snap-start hover:border-duo-green transition-all bg-white">
      <div>
        <div className="flex gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="w-5 h-5 fill-duo-gold text-duo-gold" />
          ))}
        </div>
        <p className="text-duo-charcoal mb-6 leading-relaxed font-medium text-sm">
          {'\u201C'}{text}{'\u201D'}
        </p>
      </div>
      <div className="flex items-center gap-3 pt-4 border-t-2 border-duo-border/60">
        <div className={`w-10 h-10 ${avatarColor} rounded-full border-2 border-current flex items-center justify-center font-extrabold text-base`}>
          {name.charAt(0)}
        </div>
        <div>
          <div className="font-heading font-bold text-duo-charcoal text-sm">{name}</div>
          <div className="text-duo-pencil text-xs font-semibold">{role}</div>
        </div>
      </div>
    </div>
  );
});
