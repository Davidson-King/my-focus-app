export interface ChatbotData {
  greeting: string;
  initialQuestions: string[];
  responses: Record<string, string | { text: string; keywords: string[] }>;
}

export const chatbotData: ChatbotData = {
  greeting: "Hello! I'm the FocusFlow support bot. How can I help you today?",
  initialQuestions: [
    "What is FocusFlow?",
    "How does pricing work?",
    "Where is my data stored?",
    "Is there a mobile app?",
  ],
  responses: {
    "What is FocusFlow?": {
      text: "FocusFlow is a minimalist productivity dashboard designed to help you manage tasks, notes, and goals in one uncluttered space. It's built to work offline and be your private, personal productivity hub.",
      keywords: ["what", "focusflow", "about", "is this", "purpose", "explain"],
    },
    "How does pricing work?": {
      text: "FocusFlow is completely free! All features are available to you without any cost or subscriptions. There are no paid plans or hidden fees.",
      keywords: ["pricing", "cost", "free", "pro", "unlock", "payment", "buy", "subscribe", "money", "fee"],
    },
    "Where is my data stored?": {
        text: "Your data is stored locally on your device in your browser's database (IndexedDB). This makes it fast, private, and available offline. We, the developers, do not see or store your data at all.",
        keywords: ["data", "stored", "storage", "privacy", "secure", "security", "where", "cloud", "server", "account"],
    },
    "Is there a mobile app?": {
        text: "FocusFlow is a Progressive Web App (PWA). You can install it on your phone's home screen from your browser, and it will work just like a native app, including offline access. Look for the 'Add to Home Screen' or 'Install App' option in your browser.",
        keywords: ["mobile", "app", "ios", "android", "phone", "install", "pwa", "download"],
    },
    "default": {
        text: "I'm not sure I understand. I can help with questions about pricing, data storage, and what FocusFlow is. Could you try rephrasing?",
        keywords: [],
    }
  },
};