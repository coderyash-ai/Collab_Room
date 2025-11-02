# Collab Room - Real-time Collaborative Development Platform

Collab Room is an online collaborative development platform that enables developers to code, review, and build projects together in a shared, real-time environment. Work together seamlessly, no matter where you are located.

## 🌟 Features

- **Real-time Collaboration**: Work together simultaneously with live cursor tracking, instant edits, and seamless synchronization
- **IDE Integration**: Connect your favorite IDE and maintain your personal setup while collaborating
- **Integrated Communication**: Built-in chat, voice calls, and code comments keep your team connected
- **Version Control**: Seamless Git integration with conflict resolution and automatic syncing
- **Secure & Private**: End-to-end encryption, role-based permissions, and secure sandboxing
- **AI Assistant**: Personal AI coding assistant for suggestions, debugging, and explanations

## 🏗️ Architecture

This project is structured as a monorepo with the following components:

### Frontend (`apps/frontend`)
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **Real-time**: Socket.IO client
- **Authentication**: JWT-based auth with OAuth providers
- **Editor**: Monaco Editor for collaborative coding

### Backend (`apps/backend`)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.IO server
- **Authentication**: JWT tokens with OAuth support
- **Security**: CORS, input validation, and access control

### Database Schema
- **Users**: OAuth-based user management
- **Rooms**: Collaborative workspaces
- **Projects**: Code projects within rooms
- **Files**: Individual code files with version tracking
- **Messages**: Chat system for team communication
- **Cursors**: Real-time cursor positions

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Git

### 1. Clone and Install

```bash
git clone <repository-url>
cd collab-room
npm install
```

### 2. Database Setup

1. Create a PostgreSQL database named `collab_room`
2. Update `apps/backend/.env` with your database credentials:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/collab_room"
JWT_SECRET="your-super-secret-jwt-key"
```

3. Run database migrations:

```bash
cd apps/backend
npx prisma migrate dev --name init
npx prisma generate
```

### 3. Start Development Servers

```bash
# Start both frontend and backend
npm run dev

# Backend: http://localhost:5000
# Frontend: http://localhost:3000
```

## 📁 Project Structure

```
collab-room/
├── apps/
│   ├── backend/           # Express.js API server
│   │   ├── src/
│   │   │   ├── routes/    # API routes
│   │   │   ├── sockets/   # Socket.IO handlers
│   │   │   ├── middleware/# Auth & validation
│   │   │   └── index.ts   # Server entry point
│   │   ├── prisma/        # Database schema
│   │   └── package.json
│   └── frontend/          # Next.js web application
│       ├── src/
│       │   ├── app/       # Next.js app router pages
│       │   ├── components/# React components
│       │   └── lib/       # Utilities and API client
│       └── package.json
├── packages/
│   └── shared/           # Shared types and utilities
├── package.json          # Root package.json
└── README.md
```

## 🛠️ Development

### Available Scripts

```bash
npm run dev          # Start both frontend and backend
npm run dev:frontend # Start frontend only
npm run dev:backend  # Start backend only
npm run build        # Build all applications
npm run typecheck    # Type check all projects
```

### Database Operations

```bash
cd apps/backend

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## 🔧 Configuration

### Environment Variables

#### Backend (`apps/backend/.env`)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: Server port (default: 5000)
- `FRONTEND_URL`: Frontend URL for CORS

#### Frontend (`apps/frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`: Backend API URL
- `NEXT_PUBLIC_SOCKET_URL`: Socket.IO server URL

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

Built with ❤️ for developers who want to code together, from anywhere.
