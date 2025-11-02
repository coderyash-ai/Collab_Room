import { Server, Socket } from 'socket.io'
import { prisma } from '../index'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import crypto from 'crypto'

const execAsync = promisify(exec)

interface IDESocket extends Socket {
  userId?: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
  ideInfo?: {
    type: string
    version: string
    workspacePath: string
  }
}

interface IDEConnection {
  id: string
  userId: string
  roomId: string
  ideType: string
  version: string
  workspacePath: string
  status: 'connected' | 'disconnected' | 'syncing'
  lastSync: Date
  socketId: string
}

// In-memory storage for IDE connections (in production, use Redis)
const ideConnections = new Map<string, IDEConnection>()

export class IDEBridgeService {
  private io: Server

  constructor(io: Server) {
    this.io = io
  }

  setupHandlers() {
    // Create dedicated namespace for IDE connections
    const ideNamespace = this.io.of('/ide')

    ideNamespace.on('connection', (socket: IDESocket) => {
      console.log('IDE client connected:', socket.id)

      // IDE Registration
      socket.on('register-ide', async (data: {
        token: string
        ideType: string
        version: string
        workspacePath: string
        roomId: string
      }) => {
        try {
          const { token, ideType, version, workspacePath, roomId } = data

          // Verify user token (reuse auth logic)
          const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET!) as any
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, name: true, avatar: true }
          })

          if (!user) {
            socket.emit('registration-error', { message: 'Invalid token' })
            return
          }

          socket.userId = user.id
          socket.user = user
          socket.ideInfo = { type: ideType, version, workspacePath }

          // Create IDE connection record
          const connectionId = crypto.randomUUID()
          const connection: IDEConnection = {
            id: connectionId,
            userId: user.id,
            roomId,
            ideType,
            version,
            workspacePath,
            status: 'connected',
            lastSync: new Date(),
            socketId: socket.id
          }

          ideConnections.set(connectionId, connection)
          socket.join(roomId)

          // Store in database
          await prisma.iDEConnection.create({
            data: {
              id: connectionId,
              userId: user.id,
              roomId,
              ideType,
              version,
              workspacePath,
              status: 'CONNECTED'
            }
          })

          socket.emit('ide-registered', { connectionId, user })
          
          // Notify room members about IDE connection
          socket.to(roomId).emit('ide-connected', {
            connectionId,
            user,
            ideType,
            timestamp: new Date()
          })

          console.log(`IDE ${ideType} registered for user ${user.name} in room ${roomId}`)

        } catch (error) {
          console.error('IDE registration error:', error)
          socket.emit('registration-error', { message: 'Failed to register IDE' })
        }
      })

      // File synchronization
      socket.on('sync-files', async (data: {
        roomId: string
        projectId: string
        files: Array<{
          relativePath: string
          content: string
          lastModified: number
        }>
      }) => {
        try {
          const { roomId, projectId, files } = data

          if (!socket.userId) {
            socket.emit('sync-error', { message: 'Not authenticated' })
            return
          }

          // Verify access to project
          const project = await prisma.project.findFirst({
            where: {
              id: projectId,
              room: {
                OR: [
                  { ownerId: socket.userId },
                  { members: { some: { userId: socket.userId } } }
                ]
              }
            }
          })

          if (!project) {
            socket.emit('sync-error', { message: 'Project access denied' })
            return
          }

          const syncResults = []

          for (const file of files) {
            try {
              // Check if file exists in database
              const existingFile = await prisma.projectFile.findFirst({
                where: {
                  projectId,
                  path: file.relativePath
                }
              })

              if (existingFile) {
                // Update existing file if IDE version is newer
                if (file.lastModified > existingFile.updatedAt.getTime()) {
                  await prisma.projectFile.update({
                    where: { id: existingFile.id },
                    data: { content: file.content }
                  })
                  syncResults.push({ path: file.relativePath, status: 'updated' })
                } else {
                  syncResults.push({ path: file.relativePath, status: 'skipped' })
                }
              } else {
                // Create new file
                const newFile = await prisma.projectFile.create({
                  data: {
                    name: path.basename(file.relativePath),
                    path: file.relativePath,
                    content: file.content,
                    language: this.getLanguageFromExtension(file.relativePath),
                    projectId
                  }
                })
                syncResults.push({ path: file.relativePath, status: 'created', fileId: newFile.id })
              }
            } catch (fileError) {
              console.error(`Error syncing file ${file.relativePath}:`, fileError)
              syncResults.push({ path: file.relativePath, status: 'error', error: fileError.message })
            }
          }

          // Update connection status
          const connection = Array.from(ideConnections.values()).find(c => c.socketId === socket.id)
          if (connection) {
            connection.lastSync = new Date()
            connection.status = 'connected'
          }

          socket.emit('sync-complete', { results: syncResults })
          
          // Notify room about file sync
          socket.to(roomId).emit('files-synced', {
            user: socket.user,
            ideType: socket.ideInfo?.type,
            fileCount: files.length,
            timestamp: new Date()
          })

        } catch (error) {
          console.error('File sync error:', error)
          socket.emit('sync-error', { message: 'Failed to sync files' })
        }
      })

      // Get files from server to IDE
      socket.on('pull-files', async (data: {
        roomId: string
        projectId: string
        lastSync?: number
      }) => {
        try {
          const { roomId, projectId, lastSync } = data

          if (!socket.userId) {
            socket.emit('pull-error', { message: 'Not authenticated' })
            return
          }

          // Get files modified since last sync
          const whereClause: any = { projectId }
          if (lastSync) {
            whereClause.updatedAt = { gt: new Date(lastSync) }
          }

          const files = await prisma.projectFile.findMany({
            where: whereClause,
            select: {
              id: true,
              name: true,
              path: true,
              content: true,
              language: true,
              updatedAt: true
            }
          })

          socket.emit('files-pulled', {
            files: files.map(f => ({
              id: f.id,
              name: f.name,
              relativePath: f.path,
              content: f.content,
              language: f.language,
              lastModified: f.updatedAt.getTime()
            }))
          })

        } catch (error) {
          console.error('Pull files error:', error)
          socket.emit('pull-error', { message: 'Failed to pull files' })
        }
      })

      // Execute build/test commands
      socket.on('execute-command', async (data: {
        roomId: string
        projectId: string
        command: string
        workingDirectory?: string
      }) => {
        try {
          const { roomId, projectId, command, workingDirectory } = data

          if (!socket.userId) {
            socket.emit('command-error', { message: 'Not authenticated' })
            return
          }

          // Security: Only allow predefined safe commands
          const safeCommands = [
            'npm install', 'npm run build', 'npm run test', 'npm run lint',
            'yarn install', 'yarn build', 'yarn test', 'yarn lint',
            'pnpm install', 'pnpm build', 'pnpm test', 'pnpm lint',
            'python -m pytest', 'python -m pip install -r requirements.txt',
            'go build', 'go test', 'go mod tidy',
            'cargo build', 'cargo test', 'cargo check'
          ]

          if (!safeCommands.some(safe => command.startsWith(safe))) {
            socket.emit('command-error', { message: 'Command not allowed' })
            return
          }

          const cwd = workingDirectory || socket.ideInfo?.workspacePath

          socket.emit('command-started', { command, cwd })

          const { stdout, stderr } = await execAsync(command, { cwd, timeout: 300000 }) // 5 min timeout

          socket.emit('command-completed', {
            command,
            stdout,
            stderr,
            success: true,
            timestamp: new Date()
          })

          // Broadcast to room
          socket.to(roomId).emit('team-command-executed', {
            user: socket.user,
            command,
            success: true,
            timestamp: new Date()
          })

        } catch (error: any) {
          console.error('Command execution error:', error)
          
          socket.emit('command-completed', {
            command: data.command,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            success: false,
            timestamp: new Date()
          })

          socket.to(data.roomId).emit('team-command-executed', {
            user: socket.user,
            command: data.command,
            success: false,
            error: error.message,
            timestamp: new Date()
          })
        }
      })

      // Git operations
      socket.on('git-operation', async (data: {
        roomId: string
        projectId: string
        operation: 'status' | 'add' | 'commit' | 'push' | 'pull' | 'branch'
        params?: any
      }) => {
        try {
          const { roomId, projectId, operation, params } = data

          if (!socket.userId || !socket.ideInfo?.workspacePath) {
            socket.emit('git-error', { message: 'IDE not properly connected' })
            return
          }

          const workspacePath = socket.ideInfo.workspacePath
          let command = ''

          switch (operation) {
            case 'status':
              command = 'git status --porcelain'
              break
            case 'add':
              command = `git add ${params?.files?.join(' ') || '.'}`
              break
            case 'commit':
              command = `git commit -m "${params?.message || 'Collaborative commit'}"`
              break
            case 'push':
              command = `git push ${params?.remote || 'origin'} ${params?.branch || 'main'}`
              break
            case 'pull':
              command = `git pull ${params?.remote || 'origin'} ${params?.branch || 'main'}`
              break
            case 'branch':
              command = 'git branch -a'
              break
            default:
              throw new Error('Invalid git operation')
          }

          const { stdout, stderr } = await execAsync(command, { cwd: workspacePath })

          socket.emit('git-result', {
            operation,
            stdout,
            stderr,
            success: true
          })

          // Log git operation
          await prisma.gitOperation.create({
            data: {
              userId: socket.userId,
              projectId,
              operation,
              command,
              result: stdout,
              success: true
            }
          })

          // Broadcast to room for collaborative awareness
          socket.to(roomId).emit('team-git-operation', {
            user: socket.user,
            operation,
            success: true,
            timestamp: new Date()
          })

        } catch (error: any) {
          console.error('Git operation error:', error)
          
          socket.emit('git-result', {
            operation: data.operation,
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            success: false
          })
        }
      })

      // Handle disconnect
      socket.on('disconnect', async () => {
        console.log('IDE client disconnected:', socket.id)
        
        // Update connection status
        const connection = Array.from(ideConnections.values()).find(c => c.socketId === socket.id)
        if (connection) {
          connection.status = 'disconnected'
          ideConnections.delete(connection.id)

          // Update in database
          await prisma.iDEConnection.update({
            where: { id: connection.id },
            data: { status: 'DISCONNECTED' }
          })

          // Notify room
          socket.to(connection.roomId).emit('ide-disconnected', {
            connectionId: connection.id,
            user: socket.user,
            ideType: connection.ideType,
            timestamp: new Date()
          })
        }
      })
    })
  }

  private getLanguageFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const languageMap: { [key: string]: string } = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.dart': 'dart',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'bash',
      '.bash': 'bash'
    }
    return languageMap[ext] || 'text'
  }

  // Get active IDE connections for a room
  async getActiveConnections(roomId: string): Promise<IDEConnection[]> {
    return Array.from(ideConnections.values()).filter(
      conn => conn.roomId === roomId && conn.status === 'connected'
    )
  }

  // Force sync all IDEs in a room
  async syncAllIDEs(roomId: string) {
    const connections = await this.getActiveConnections(roomId)
    
    for (const connection of connections) {
      this.io.of('/ide').to(connection.socketId).emit('force-sync', {
        timestamp: new Date()
      })
    }
  }
}