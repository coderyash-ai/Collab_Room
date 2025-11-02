import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'

// Load environment variables
dotenv.config()

// Initialize Google AI
let genAI: GoogleGenerativeAI | null = null
try {
  const apiKey = process.env.GOOGLE_AI_API_KEY
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey)
    console.log('✅ Google AI initialized successfully')
  } else {
    console.log('⚠️  Google AI API key not found')
  }
} catch (error) {
  console.error('❌ Failed to initialize Google AI:', error)
}

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

// In-memory storage for demo
const users = new Map()
const rooms = new Map()
const projects = new Map()
const messages = new Map()

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}))
app.use(express.json())

// JWT helper
const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'demo-secret', { expiresIn: '7d' })
}

// Auth routes
app.post('/api/auth/oauth/callback', (req, res) => {
  try {
    const { email, name, avatar, provider, providerId } = req.body

    if (!email || !name || !provider || !providerId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Create or find user
    const userId = `user_${Date.now()}_${Math.random()}`
    const user = {
      id: userId,
      email,
      name,
      avatar,
      provider,
      providerId,
      createdAt: new Date().toISOString()
    }

    users.set(userId, user)
    const token = generateToken(userId)

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      }
    })
  } catch (error) {
    console.error('OAuth callback error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get current user
app.get('/api/auth/me', (req, res) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ error: 'Access token required' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret') as any
    const user = users.get(decoded.userId)

    if (!user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    })
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
})

// Room routes
app.get('/api/rooms', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret') as any
    const userId = decoded.userId
    
    // Return demo rooms
    const demoRooms = [
      {
        id: 'room_1',
        name: 'My Demo Room',
        description: 'A sample collaborative workspace',
        isPublic: false,
        inviteCode: 'DEMO123',
        createdAt: new Date().toISOString(),
        owner: {
          id: userId,
          name: 'Demo User',
          avatar: users.get(userId)?.avatar
        },
        members: [{
          id: 'member_1',
          role: 'OWNER',
          user: {
            id: userId,
            name: 'Demo User',
            avatar: users.get(userId)?.avatar
          }
        }],
        _count: {
          members: 1,
          projects: 1
        }
      }
    ]

    res.json({ rooms: demoRooms })
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
})

// Create room
app.post('/api/rooms', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret') as any
    const userId = decoded.userId
    const user = users.get(userId)
    
    const { name, description, isPublic } = req.body
    
    if (!name) {
      return res.status(400).json({ error: 'Room name is required' })
    }

    const roomId = `room_${Date.now()}`
    const room = {
      id: roomId,
      name,
      description,
      isPublic: isPublic || false,
      inviteCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
      owner: {
        id: userId,
        name: user?.name || 'Demo User',
        avatar: user?.avatar
      },
      members: [{
        id: 'member_1',
        role: 'OWNER',
        user: {
          id: userId,
          name: user?.name || 'Demo User',
          avatar: user?.avatar
        }
      }],
      projects: []
    }

    rooms.set(roomId, room)
    res.status(201).json({ room })
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
})

// Get room by ID
app.get('/api/rooms/:id', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret') as any
    const userId = decoded.userId
    const user = users.get(userId)
    
    // Return a demo room with projects
    const demoRoom = {
      id: req.params.id,
      name: 'Demo Collaboration Room',
      description: 'A sample room for testing collaborative features',
      inviteCode: 'DEMO123',
      owner: {
        id: userId,
        name: user?.name || 'Demo User',
        avatar: user?.avatar
      },
      members: [{
        id: 'member_1',
        role: 'OWNER',
        user: {
          id: userId,
          name: user?.name || 'Demo User',
          avatar: user?.avatar
        }
      }],
      projects: [{
        id: 'project_1',
        name: 'Sample Project',
        files: [{
          id: 'file_1',
          name: 'index.js',
          path: '/index.js',
          language: 'javascript',
          projectId: 'project_1'
        }, {
          id: 'file_2',
          name: 'README.md',
          path: '/README.md',
          language: 'markdown',
          projectId: 'project_1'
        }]
      }]
    }

    res.json({ room: demoRoom })
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
})

// Create project
app.post('/api/projects', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'demo-secret') as any
    const { name, roomId } = req.body
    
    const project = {
      id: `project_${Date.now()}`,
      name,
      roomId,
      files: [{
        id: `file_${Date.now()}`,
        name: 'README.md',
        path: '/README.md',
        content: `# ${name}\n\nThis is a demo project for collaborative coding.`,
        language: 'markdown'
      }],
      room: {
        id: roomId,
        name: 'Demo Room'
      }
    }

    res.status(201).json({ project })
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
})

// Get file content
app.get('/api/projects/:projectId/files/:fileId', (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    // Return demo file content
    const demoContent = req.params.fileId === 'file_1' 
      ? `// Demo JavaScript File
console.log('Hello from Collab Room!');

function demo() {
  return 'This is a collaborative coding demo';
}

demo();`
      : `# Demo Project

Welcome to Collab Room - a real-time collaborative development platform!

## Features
- Real-time collaborative editing
- Integrated chat system
- Project management
- File sharing

Start coding together!`;

    const file = {
      id: req.params.fileId,
      name: req.params.fileId === 'file_1' ? 'index.js' : 'README.md',
      path: req.params.fileId === 'file_1' ? '/index.js' : '/README.md',
      content: demoContent,
      language: req.params.fileId === 'file_1' ? 'javascript' : 'markdown'
    }

    res.json({ file })
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' })
  }
})

// AI Assistant endpoints
app.post('/api/ai/suggest', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'demo-secret')
    
    const { code, language, prompt } = req.body
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' })
    }

    if (!genAI) {
      return res.status(503).json({ error: 'AI service is not available. Please check the API key configuration.' })
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })
    
    const fullPrompt = `You are a helpful coding assistant. Context: ${language ? `Language: ${language}` : 'General coding'}
    ${code ? `Current code:\n${code}\n\n` : ''}
    User request: ${prompt}
    
    Please provide a helpful response. If suggesting code, make it concise and well-commented.`

    console.log('🤖 Making AI request...')
    const result = await model.generateContent(fullPrompt)
    const response = result.response
    const suggestion = response.text()

    console.log('✅ AI response received')
    res.json({ suggestion })
  } catch (error: any) {
    console.error('❌ AI suggestion error:', error)
    
    // Provide more specific error messages
    if (error.message?.includes('API_KEY') || error.message?.includes('API key')) {
      res.status(401).json({ error: 'Invalid API key. Please check your Google AI API key configuration.' })
    } else if (error.message?.includes('quota') || error.message?.includes('QUOTA')) {
      res.status(429).json({ error: 'API quota exceeded. Please try again later.' })
    } else if (error.message?.includes('SAFETY') || error.message?.includes('blocked')) {
      res.status(400).json({ error: 'Content was blocked by safety filters. Please try a different request.' })
    } else if (error.status === 400) {
      res.status(400).json({ error: 'Invalid request. Please check your input and try again.' })
    } else {
      res.status(500).json({ error: `AI service error: ${error.message || 'Unknown error occurred'}` })
    }
  }
})

app.post('/api/ai/explain', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'demo-secret')
    
    const { code, language } = req.body
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' })
    }

    if (!genAI) {
      return res.status(503).json({ error: 'AI service is not available. Please check the API key configuration.' })
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })
    
    const prompt = `Please explain this ${language || 'code'} in a clear and concise way:

${code}

Provide:
1. What this code does
2. Key concepts used
3. Any potential improvements`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const explanation = response.text()

    res.json({ explanation })
  } catch (error) {
    console.error('AI explanation error:', error)
    if (error.message?.includes('API key')) {
      res.status(401).json({ error: 'Invalid API key. Please check your Google AI API key configuration.' })
    } else {
      res.status(500).json({ error: `Failed to generate explanation: ${error.message}` })
    }
  }
})

app.post('/api/ai/debug', async (req, res) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET || 'demo-secret')
    
    const { code, language, error: userError } = req.body
    
    if (!code) {
      return res.status(400).json({ error: 'Code is required' })
    }

    if (!genAI) {
      return res.status(503).json({ error: 'AI service is not available. Please check the API key configuration.' })
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    })
    
    const prompt = `Please help debug this ${language || 'code'}:

${code}

${userError ? `Error message: ${userError}\n\n` : ''}Please identify potential issues and suggest fixes.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const debugInfo = response.text()

    res.json({ debugInfo })
  } catch (error) {
    console.error('AI debug error:', error)
    if (error.message?.includes('API key')) {
      res.status(401).json({ error: 'Invalid API key. Please check your Google AI API key configuration.' })
    } else {
      res.status(500).json({ error: `Failed to generate debug information: ${error.message}` })
    }
  }
})

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Socket.IO for demo (simplified)
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  
  socket.on('join-room', (roomId) => {
    socket.join(roomId)
    socket.emit('joined-room', { roomId })
  })
  
  socket.on('send-message', (data) => {
    const message = {
      id: `msg_${Date.now()}`,
      content: data.content,
      type: data.type || 'TEXT',
      createdAt: new Date().toISOString(),
      user: {
        id: 'demo_user',
        name: 'Demo User',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=demo'
      }
    }
    
    io.to(data.roomId).emit('message', message)
  })
  
  socket.on('code-change', (data) => {
    socket.to(data.roomId).emit('code-change', data)
  })
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

const port = process.env.PORT ? Number(process.env.PORT) : 5000

server.listen(port, () => {
  console.log(`🚀 Demo server running on http://localhost:${port}`)
  console.log(`📡 Socket.IO server ready for connections`)
  console.log(`💡 This is a demo version - no database required!`)
})