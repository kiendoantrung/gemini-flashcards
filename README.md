# Gemini Flashcards

A modern flashcard application that leverages AI to help you study smarter, not harder.

## Features

- 🤖 AI-Powered Flashcard Generation using Google's Gemini AI
- 📚 Create custom flashcard decks manually or from uploaded documents
- 📝 Support for PDF, TXT, Excel, CSV, and JSON file uploads
- 🎯 Interactive quiz mode with AI-generated multiple-choice questions
- 👤 User authentication and profile management
- 🌐 Real-time data synchronization with Supabase
- 🔒 Secure API key handling via Supabase Edge Functions
- 🎨 Modern UI with Tailwind CSS
- 📱 Responsive design for all devices

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Supabase Auth
- **Database**: Supabase (PostgreSQL with RLS)
- **File Storage**: Supabase Storage
- **AI Integration**: Google Generative AI (Gemini 2.5 Flash)
- **Serverless Functions**: Supabase Edge Functions (Deno)
- **Build Tool**: Vite
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Supabase account
- Supabase CLI (for Edge Functions)
- Google AI API key

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> **Note**: The Google AI API key is now stored securely in Supabase Edge Functions, not in the client-side `.env` file.

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

### Supabase Edge Functions Setup

1. Install Supabase CLI and login:
```bash
npm install -g supabase
supabase login
```

2. Link your project:
```bash
supabase link --project-ref your-project-ref
```

3. Set the Google AI API key as a secret:
```bash
supabase secrets set GOOGLE_AI_KEY=your_google_ai_api_key
```

4. Deploy the Edge Function:
```bash
supabase functions deploy generate-flashcards
```


## Features in Detail

### AI-Powered Deck Creation
- Generate complete flashcard decks by simply entering a topic
- AI creates relevant questions and answers
- Customizable number of cards per deck

### Document Upload
- Upload PDF, TXT, Excel, CSV, or JSON files
- AI automatically extracts content and generates flashcards
- Smart parsing of educational materials

### Study Modes
- Classic flashcard mode with card flipping
- Quiz mode with AI-generated distractors (wrong answers)
- Progress tracking and scoring

### User Management
- Secure authentication with email/password or Google
- Custom user profiles with avatars
- Personal deck management

### Security
- API keys stored securely in Supabase Edge Functions
- No sensitive credentials exposed to the browser

## Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── services/       # API services
│   ├── types/          # TypeScript types
│   └── lib/            # Utilities
├── supabase/
│   ├── functions/      # Edge Functions
│   │   └── generate-flashcards/
│   └── README.md       # Supabase setup guide
└── public/             # Static assets
```

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

---

<p align="center">
  If you find this project useful, please consider giving it a ⭐ on GitHub!
</p>

<p align="center">
  <a href="https://github.com/kiendoantrung/gemini-flashcards/stargazers">
    <img src="https://img.shields.io/github/stars/kiendoantrung/gemini-flashcards.svg?style=for-the-badge&label=Star&logo=github" alt="Star on GitHub"/>
  </a>
</p>
