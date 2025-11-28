import { GraduationCap, Brain, Zap, Users } from 'lucide-react';
import { Footer } from './Footer';

export function Home() {
  return (
    <div className="min-h-screen bg-warm-cream flex flex-col">
      <header className="bg-warm-cream/90 backdrop-blur-sm shadow-sm sticky top-0 z-50 border-b border-warm-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-warm-brown" />
              <h1 className="text-2xl font-bold text-warm-brown">
                Gemini Flashcards
              </h1>
            </div>
            <div>
              <a
                href="/login"
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-full text-white bg-warm-orange hover:bg-warm-brown transition-all hover:shadow-lg"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="py-24 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-warm-cream to-white pointer-events-none" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-8 text-warm-brown animate-fade-in tracking-tight">
              Master Any Subject with
              <span className="block text-warm-orange mt-2">Intelligent Flashcards</span>
            </h1>
            <p className="text-xl md:text-2xl text-warm-brown/70 mb-10 max-w-3xl mx-auto leading-relaxed font-light">
              Transform your learning experience with our AI-powered system.
              Create, study, and master your subjects with a design that feels like home.
            </p>
            <a
              href="/login"
              className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-full text-white bg-warm-orange hover:bg-warm-brown transition-all hover:shadow-xl hover:scale-105 shadow-lg shadow-orange-200/50"
            >
              Start Learning for Free
            </a>
          </div>
        </section>

        <section className="py-20 bg-white/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-center text-warm-brown mb-16">
              Why Choose Gemini Flashcards?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
              <FeatureCard
                icon={<Brain className="w-8 h-8" />}
                title="AI-Powered Learning"
                description="Our AI generates personalized flashcards from your content, making study material creation effortless."
              />
              <FeatureCard
                icon={<Zap className="w-8 h-8" />}
                title="Smart Study Sessions"
                description="Adaptive learning algorithms help you focus on what you need to review most."
              />
              <FeatureCard
                icon={<Users className="w-8 h-8" />}
                title="Collaborative Learning"
                description="Share decks and study together with friends to enhance your learning experience."
              />
            </div>
          </div>
        </section>

        <section className="py-20 bg-warm-orange relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto font-light">
              Join thousands of students who are already learning smarter with Gemini Flashcards.
            </p>
            <a
              href="/login"
              className="inline-flex items-center px-8 py-3.5 border-2 border-white text-lg font-medium rounded-full text-warm-orange bg-white hover:bg-transparent hover:text-white transition-all duration-300"
            >
              Get Started Now
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="group p-8 bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-warm-gray hover:border-warm-orange/30">
      <div className="w-14 h-14 bg-warm-cream rounded-xl flex items-center justify-center text-warm-orange mb-6 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-warm-brown mb-4 group-hover:text-warm-orange transition-colors">{title}</h3>
      <p className="text-warm-brown/70 leading-relaxed">{description}</p>
    </div>
  );
}
