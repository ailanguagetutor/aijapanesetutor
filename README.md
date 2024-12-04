# AI Japanese Tutor 🎌

A Japanese voice chat application for conversation practice powered by AI.

This is an entry for the [Google Chrome Built-in AI Challenge hackathon](https://googlechromeai.devpost.com/). It leverages Chrome’s built-in AI APIs if available, and falls back to Google's Gemini API if not.

Try it now @ [www.aijapanesetutor.org](https://www.aijapanesetutor.org)

## Features

- 🤖 AI-powered conversation practice
- 🎤 Voice input: Speak Japanese and get real-time responses
- 🔊 Text-to-speech: Hear the AI's responses in Japanese
- 🌐 Instant Japanese-English translation for better understanding

## Getting Started

### Prerequisites

- Node.js
- Yarn package manager

### Installation

1. Clone the repository

2. Install dependencies:
```bash
yarn install
```

3. Start the development server:
```bash
export GEMINI_API_KEY=your_api_key_here
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## License

Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
