import { GraduationCap, Brain, Zap, Users } from 'lucide-react';
import { Footer } from './Footer';

export function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/80">
      <header className="bg-white/90 backdrop-blur-sm shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
                Gemini Flashcards
              </h1>
            </div>
            <div>
              <a
                href="/login"
                className="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-full text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:shadow-lg"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="py-24 text-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text animate-fade-in">
              Learn Smarter with AI-Powered Flashcards
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              Transform your learning experience with our intelligent flashcard system that adapts to your needs and helps you master any subject effortlessly.
            </p>
            <a
              href="/login"
              className="inline-flex items-center px-8 py-4 text-lg font-medium rounded-full text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all hover:shadow-xl hover:scale-105"
            >
              Start Learning for Free
            </a>
          </div>
        </section>

        <section className="py-20 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-16 bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
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

        <section className="py-20 bg-indigo-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-6">
              Ready to Transform Your Learning?
            </h2>
            <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
              Join thousands of students who are already learning smarter with Gemini Flashcards.
            </p>
            <a
              href="/login"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50"
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
    <div className="p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 hover:bg-gradient-to-br hover:from-indigo-50 hover:to-purple-50">
      <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-indigo-600 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}
