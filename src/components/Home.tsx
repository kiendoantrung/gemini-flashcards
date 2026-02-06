import React from 'react';
import { GraduationCap, Brain, Zap, Sparkles, Star, Upload, Play, ChevronRight, FileText, Layers } from 'lucide-react';
import { Footer } from './Footer';

export function Home() {
  return (
    <div className="min-h-screen bg-neo-cream flex flex-col font-body">
      {/* Header */}
      <header className="bg-neo-cream border-b-2 border-neo-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neo-green rounded-neo-md border-2 border-neo-border shadow-neo flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-heading font-bold text-neo-charcoal">
                Gemini Flashcards
              </h1>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-neo-charcoal hover:text-neo-green transition-colors font-medium">Features</a>
              <a href="#how-it-works" className="text-neo-charcoal hover:text-neo-green transition-colors font-medium">How It Works</a>
              <a href="#testimonials" className="text-neo-charcoal hover:text-neo-green transition-colors font-medium">Reviews</a>
            </nav>
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="text-neo-charcoal hover:text-neo-green transition-colors font-medium hidden sm:block"
              >
                Log In
              </a>
              <a
                href="/login"
                className="inline-flex items-center px-5 py-2.5 bg-neo-green text-white font-bold rounded-full border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-neo-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-neo-green/10 rounded-full border-2 border-neo-border">
                  <span className="text-neo-green font-bold text-sm">✨ Powered by Google Gemini AI</span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-extrabold text-neo-charcoal leading-tight">
                  Create Flashcards
                  <span className="block text-neo-green">Instantly</span>
                  <span className="block">with AI Magic!</span>
                </h1>

                <p className="text-lg text-neo-gray max-w-lg leading-relaxed">
                  Upload any document, paste text, or describe a topic - our AI will generate perfect flashcards for you in seconds. Study smarter, not harder!
                </p>

                <div className="flex flex-wrap gap-4">
                  <a
                    href="/login"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-neo-green text-white font-bold rounded-full border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all"
                  >
                    Create Flashcards Free
                    <ChevronRight className="w-5 h-5" />
                  </a>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-white text-neo-charcoal font-bold rounded-full border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all"
                  >
                    See How It Works
                  </a>
                </div>

                {/* Stats */}
                <div className="flex gap-8 pt-4">
                  <div>
                    <div className="text-2xl font-heading font-extrabold text-neo-charcoal">10K+</div>
                    <div className="text-neo-gray text-sm">Decks Created</div>
                  </div>
                  <div>
                    <div className="text-2xl font-heading font-extrabold text-neo-charcoal">50K+</div>
                    <div className="text-neo-gray text-sm">Flashcards Generated</div>
                  </div>
                  <div>
                    <div className="text-2xl font-heading font-extrabold text-neo-charcoal">100%</div>
                    <div className="text-neo-gray text-sm">Free to Use</div>
                  </div>
                </div>
              </div>

              {/* Hero Card */}
              <div className="relative hidden md:block">
                <div className="bg-white rounded-neo-xl border-2 border-neo-border shadow-neo-lg p-6 max-w-sm ml-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-neo-accent-blue rounded-neo-md border-2 border-neo-border flex items-center justify-center">
                      <Brain className="w-5 h-5 text-neo-charcoal" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-neo-charcoal">Biology 101</h3>
                      <p className="text-neo-gray text-sm">24 cards • AI Generated</p>
                    </div>
                    <div className="ml-auto w-8 h-8 bg-neo-pink rounded-full border-2 border-neo-border flex items-center justify-center">
                      <span className="text-xs">🧬</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-neo-gray">Study Progress</span>
                      <span className="text-neo-green font-bold">75%</span>
                    </div>
                    <div className="h-3 bg-neo-cream rounded-full border-2 border-neo-border overflow-hidden">
                      <div className="h-full bg-neo-green w-[75%] rounded-full"></div>
                    </div>
                  </div>
                  <button className="w-full py-3 bg-neo-green text-white font-bold rounded-neo-lg border-2 border-neo-border shadow-neo hover:shadow-neo-hover transition-all">
                    Continue Studying
                  </button>
                </div>

                {/* Floating elements */}
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-neo-yellow rounded-full border-2 border-neo-border flex items-center justify-center animate-float">
                  <Sparkles className="w-6 h-6 text-neo-charcoal" />
                </div>
                <div className="absolute bottom-8 -left-8 w-16 h-16 bg-neo-pink rounded-neo-lg border-2 border-neo-border shadow-neo flex items-center justify-center">
                  <Layers className="w-8 h-8 text-neo-charcoal" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section Badge */}
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-neo-green text-white font-bold text-sm rounded-full border-2 border-neo-border shadow-neo mb-4">
                How It Works
              </span>
              <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-neo-charcoal mb-4">
                Create Flashcards in 3 Easy Steps
              </h2>
              <p className="text-neo-gray max-w-2xl mx-auto">
                From document to study-ready flashcards in seconds
              </p>
            </div>

            {/* Step Cards */}
            <div className="grid md:grid-cols-3 gap-6">
              <StepCard
                step={1}
                icon={<Upload className="w-8 h-8 text-neo-charcoal" />}
                iconBg="bg-neo-accent-blue"
                title="Upload or Paste Content"
                description="Upload PDFs, Word docs, images, or simply paste text. You can also describe a topic and let AI do the rest."
              />
              <StepCard
                step={2}
                icon={<Sparkles className="w-8 h-8 text-neo-charcoal" />}
                iconBg="bg-neo-yellow"
                title="AI Generates Flashcards"
                description="Google Gemini AI analyzes your content and creates smart, well-structured question-answer flashcards."
              />
              <StepCard
                step={3}
                icon={<Play className="w-8 h-8 text-neo-charcoal" />}
                iconBg="bg-neo-pink"
                title="Study & Quiz Yourself"
                description="Use Study Mode to review cards or Quiz Mode to test your knowledge. Track your progress over time."
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-neo-blue/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-neo-accent-blue text-neo-charcoal font-bold text-sm rounded-full border-2 border-neo-border shadow-neo mb-4">
                Features
              </span>
              <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-neo-charcoal">
                Everything You Need to Study Smarter
              </h2>
            </div>

            <div className="grid md:grid-cols-4 gap-6">
              <FeatureCard
                icon={<Brain className="w-6 h-6 text-neo-charcoal" />}
                title="AI-Powered Generation"
                description="Google Gemini AI creates high-quality flashcards from any content automatically."
              />
              <FeatureCard
                icon={<FileText className="w-6 h-6 text-neo-charcoal" />}
                title="Multiple Input Formats"
                description="Upload PDFs, Word documents, images, or paste text directly."
              />
              <FeatureCard
                icon={<Zap className="w-6 h-6 text-neo-charcoal" />}
                title="Quiz Mode"
                description="Test yourself with interactive quizzes and track your scores."
              />
              <FeatureCard
                icon={<Layers className="w-6 h-6 text-neo-charcoal" />}
                title="Organize Decks"
                description="Create unlimited decks and organize your flashcards by subject."
              />
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-neo-pink text-neo-charcoal font-bold text-sm rounded-full border-2 border-neo-border shadow-neo mb-4">
                Student Reviews
              </span>
              <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-neo-charcoal">
                Loved by Students Worldwide
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard
                rating={5}
                text="This app saved me hours of making flashcards manually! I just uploaded my lecture notes and got perfect study cards in seconds."
                name="Sarah L."
                role="Medical Student"
                avatarColor="bg-neo-pink"
              />
              <TestimonialCard
                rating={5}
                text="The quiz mode is amazing for testing myself before exams. My grades improved significantly since I started using Gemini Flashcards!"
                name="David K."
                role="Computer Science Major"
                avatarColor="bg-neo-accent-blue"
              />
              <TestimonialCard
                rating={5}
                text="I love how I can upload PDFs from my textbooks and get flashcards instantly. It's like having a study assistant available 24/7."
                name="Emily T."
                role="Law Student"
                avatarColor="bg-neo-yellow"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-neo-blue">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="bg-white rounded-neo-xl border-2 border-neo-border shadow-neo-lg p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-heading font-extrabold text-neo-charcoal mb-4">
                Ready to Study Smarter?
              </h2>
              <p className="text-neo-gray mb-8 max-w-2xl mx-auto">
                Join thousands of students who save time and ace their exams with AI-powered flashcards. Start creating for free today!
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="/login"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-neo-green text-white font-bold rounded-full border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-neo-active active:translate-x-[1px] active:translate-y-[1px] transition-all"
                >
                  Create Your First Deck
                  <ChevronRight className="w-5 h-5" />
                </a>
              </div>
              <div className="flex justify-center gap-6 mt-6 text-sm text-neo-gray">
                <span className="flex items-center gap-2">
                  <span className="text-neo-green">✓</span> 100% Free
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-neo-green">✓</span> No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-neo-green">✓</span> Unlimited flashcards
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

// Step Card Component - Memoized to prevent unnecessary re-renders
const StepCard = React.memo(function StepCard({
  step,
  icon,
  iconBg,
  title,
  description
}: {
  step: number;
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group bg-white rounded-neo-lg border-2 border-neo-border shadow-neo hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all p-6 text-center relative">
      <div className="absolute -top-4 -left-4 w-10 h-10 bg-neo-green rounded-full border-2 border-neo-border flex items-center justify-center font-heading font-bold text-white text-lg">
        {step}
      </div>
      <div className={`w-16 h-16 ${iconBg} rounded-neo-md border-2 border-neo-border flex items-center justify-center mb-4 mx-auto`}>
        {icon}
      </div>
      <h3 className="font-heading font-bold text-neo-charcoal mb-2 text-lg">{title}</h3>
      <p className="text-neo-gray text-sm leading-relaxed">{description}</p>
    </div>
  );
});

// Feature Card Component - Memoized to prevent unnecessary re-renders
const FeatureCard = React.memo(function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-neo-lg border-2 border-neo-border shadow-neo p-6 text-center hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
      <div className="w-14 h-14 bg-neo-cream rounded-neo-md border-2 border-neo-border mx-auto mb-4 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-heading font-bold text-neo-charcoal mb-2">{title}</h3>
      <p className="text-neo-gray text-sm leading-relaxed">{description}</p>
    </div>
  );
});

// Testimonial Card Component - Memoized to prevent unnecessary re-renders
const TestimonialCard = React.memo(function TestimonialCard({
  rating,
  text,
  name,
  role,
  avatarColor
}: {
  rating: number;
  text: string;
  name: string;
  role: string;
  avatarColor: string;
}) {
  return (
    <div className="bg-white rounded-neo-lg border-2 border-neo-border shadow-neo p-6 hover:shadow-neo-hover hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
      <div className="flex gap-1 mb-4">
        {[...Array(rating)].map((_, i) => (
          <Star key={i} className="w-5 h-5 fill-neo-yellow text-neo-yellow" />
        ))}
      </div>
      <p className="text-neo-gray mb-6 leading-relaxed">"{text}"</p>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${avatarColor} rounded-full border-2 border-neo-border flex items-center justify-center font-bold text-neo-charcoal`}>
          {name.charAt(0)}
        </div>
        <div>
          <div className="font-heading font-bold text-neo-charcoal">{name}</div>
          <div className="text-neo-gray text-sm">{role}</div>
        </div>
      </div>
    </div>
  );
});
