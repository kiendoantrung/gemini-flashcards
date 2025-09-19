# Gemini Flashcards <p align="center">
A modern flashcard application that leverages AI to help you study smarter, not harder.

## Features

- 🤖 AI-Powered Flashcard Generation using Google's Gemini AI
- 📚 Create custom flashcard decks manually or from uploaded documents
- 📝 Support for PDF and TXT file uploads
- 🎯 Interactive quiz mode with multiple-choice questions
- 👤 User authentication and profile management
- 🌐 Real-time data synchronization with Supabase
- 🎨 Modern UI with Tailwind CSS
- 📱 Responsive design for all devices

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase
- **File Storage**: Supabase Storage
- **AI Integration**: Google Generative AI (Gemini)
- **Build Tool**: Vite
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Supabase account
- Google AI API key

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_AI_KEY=your_google_ai_api_key
```

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kiendoantrung/gemini-flashcards.git
cd gemini-flashcards
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## Features in Detail

### AI-Powered Deck Creation
- Generate complete flashcard decks by simply entering a topic
- AI creates relevant questions and answers
- Customizable number of cards per deck

### Document Upload
- Upload PDF or TXT files
- AI automatically extracts content and generates flashcards
- Smart parsing of educational materials

### Study Modes
- Classic flashcard mode with card flipping
- Quiz mode with multiple-choice questions
- Progress tracking and scoring

### User Management
- Secure authentication with email/password or Google
- Custom user profiles with avatars
- Personal deck management

## Deployment

The project is configured for deployment on Vercel with GitHub Actions. The deployment workflow is triggered automatically when pushing to the main branch.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google Generative AI for powering the AI features
- Supabase for backend infrastructure
- Tailwind CSS for styling
- Lucide React for icons

<h1 align="center">🌟 Support Gemini Flashcards</h1> <p align="center"> If you find this project useful or interesting, please consider giving it a ⭐ on GitHub!<br/> Your support helps the project grow and reach more learners. Let's build smarter study tools together! </p> <p align="center"> <a href="https://github.com/kiendoantrung/gemini-flashcards/stargazers"> <img src="https://img.shields.io/github/stars/kiendoantrung/gemini-flashcards.svg?style=for-the-badge&label=Star%20on%20GitHub&logo=github" alt="Star on GitHub"/> </a> </p>
