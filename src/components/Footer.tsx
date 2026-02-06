import { useMemo } from 'react';
import { GraduationCap, Brain, Sparkles, Layers } from 'lucide-react';

export function Footer() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <footer className="bg-neo-charcoal text-white py-16 border-t-2 border-neo-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-neo-green rounded-neo-md border-2 border-neo-border shadow-neo flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-heading font-bold text-white">
                Gemini Flashcards
              </span>
            </div>
            <p className="text-gray-400 leading-relaxed">
              Create AI-powered flashcards instantly from any content. Study smarter with Google Gemini AI.
            </p>
            {/* Social Icons */}
            <div className="flex gap-3">
              <a href="https://www.linkedin.com/in/kiendoantrung02/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn Profile" className="w-10 h-10 bg-neo-charcoal rounded-full border-2 border-gray-600 hover:border-neo-green hover:bg-neo-green/10 flex items-center justify-center transition-all">
                <svg className="w-5 h-5 text-gray-400 hover:text-neo-green" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="https://github.com/kiendoantrung/gemini-flashcards" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository" className="w-10 h-10 bg-neo-charcoal rounded-full border-2 border-gray-600 hover:border-neo-green hover:bg-neo-green/10 flex items-center justify-center transition-all">
                <svg className="w-5 h-5 text-gray-400 hover:text-neo-green" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-heading font-bold mb-6 text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-neo-yellow" />
              Features
            </h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">AI Flashcard Generation</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">PDF & Document Upload</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Study Mode</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Quiz Mode</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Progress Tracking</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-heading font-bold mb-6 text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-neo-accent-blue" />
              Use Cases
            </h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Exam Preparation</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Language Learning</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Medical Studies</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Professional Certification</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">School & University</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-heading font-bold mb-6 text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-neo-pink" />
              Resources
            </h3>
            <ul className="space-y-4">
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">How It Works</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Study Tips</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">FAQ</a></li>
              <li><a href="#" className="text-gray-400 hover:text-neo-green transition-colors">Contact Support</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400">
              &copy; {currentYear} Gemini Flashcards. Made with ❤️ for students everywhere.
            </p>
            <div className="flex gap-6">
              <a href="/privacy" className="text-sm text-gray-400 hover:text-neo-green transition-colors">Privacy</a>
              <a href="/terms" className="text-sm text-gray-400 hover:text-neo-green transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}