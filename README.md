# ChatBot - Advanced AI Interface
[Web App](https://chatbot-211599249068.us-west1.run.app)

A modern, responsive, and feature-rich AI chat application built with **React**, **TypeScript**, and the **Google Gemini API**. This project replicates the premium experience of leading LLM interfaces while adding unique features like topic visualization, conversation branching, and local persistence.

## ✨ Key Features

### 🧠 Intelligent Conversation
- **Real-time Streaming:** Smooth, typewriter-style responses using the Gemini API stream capabilities.
- **Markdown Support:** Renders code blocks, tables, lists, and formatted text beautifully.
- **Smart Suggestions:** "Exploring Mode" offers context-aware follow-up questions to keep the conversation flowing.
- **Auto-Summarization:** Generate concise bullet-point summaries of long conversations with one click.

### 🗺️ Topic Visualization & Management
- **Subjects Panel:** Automatically detects topic shifts during a chat and generates an interactive Table of Contents.
- **Global Topic Map:** A force-directed graph that visualizes all your chat history, clustering related conversations together using semantic string matching.
- **Local Graph:** Visualizes the flow of the current conversation nodes.

### 🔀 Advanced Chat Control
- **Chat Forking:** Branch a conversation from a specific topic point to explore a new direction without losing the original context.
- **Pinning & Favorites:** Keep important chats at the top of your sidebar.
- **Search:** Instant filtering of chat history by title.
- **Rich Context:** Edit chat titles or let the AI auto-generate them.

### 🛠️ Architecture & UX
- **Local-First Architecture:** All data (chats, users, history) is stored in `localStorage`. No database setup required.
- **Secure Authentication (Mock):** A fully functional local login/signup system.
- **Responsive Design:** Mobile-optimized sidebar with backdrop overlays and smooth transitions.
- **Dark/Light Mode:** Full theme support with persistent preferences.

## 🚀 Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS
- **AI Integration:** Google GenAI SDK (`@google/genai`)
- **Icons:** Lucide React
- **Rendering:** React Markdown

## 📦 Installation & Setup

1. **Clone the repository**
   ```bash
   git https://github.com/Ahmadmoo/HCI_Project.git
   cd chatbot-project





