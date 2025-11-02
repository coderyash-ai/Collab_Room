import { Server, Socket } from 'socket.io'
import { prisma } from '../index'
import jwt from 'jsonwebtoken'

interface AuthenticatedSocket extends Socket {
  userId?: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

export const setupCollaborationHandlers = (io: Server) => {
  // Socket authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, avatar: true }
      })

      if (!user) {
        return next(new Error('User not found'))
      }

      socket.userId = user.id
      socket.user = user
      next()
    } catch (error) {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User ${socket.user?.name} connected`)

    // Join room
    socket.on('join-room', async (roomId: string) => {
      try {
        // Verify user has access to room
        const room = await prisma.room.findFirst({
          where: {
            id: roomId,
            OR: [
              { ownerId: socket.userId! },
              { 
                members: {
                  some: { userId: socket.userId! }
                }
              }
            ]
          },
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, avatar: true }
                }
              }
            }
          }
        })

        if (!room) {
          socket.emit('error', { message: 'Room not found or access denied' })
          return
        }

        socket.join(roomId)
        socket.emit('joined-room', { roomId })
        
        // Notify other users in the room
        socket.to(roomId).emit('user-joined', {
          user: socket.user,
          timestamp: new Date()
        })

        console.log(`User ${socket.user?.name} joined room ${roomId}`)
      } catch (error) {
        console.error('Join room error:', error)
        socket.emit('error', { message: 'Failed to join room' })
      }
    })

    // Leave room
    socket.on('leave-room', (roomId: string) => {
      socket.leave(roomId)
      socket.to(roomId).emit('user-left', {
        user: socket.user,
        timestamp: new Date()
      })
      console.log(`User ${socket.user?.name} left room ${roomId}`)
    })

    // Code changes
    socket.on('code-change', async (data: {
      roomId: string
      fileId: string
      content: string
      changes: any[]
    }) => {
      try {
        const { roomId, fileId, content, changes } = data

        // Verify access to file
        const file = await prisma.projectFile.findFirst({
          where: {
            id: fileId,
            project: {
              room: {
                OR: [
                  { ownerId: socket.userId! },
                  { 
                    members: {
                      some: { userId: socket.userId! }
                    }
                  }
                ]
              }
            }
          }
        })

        if (!file) {
          socket.emit('error', { message: 'File not found or access denied' })
          return
        }

        // Update file content in database
        await prisma.projectFile.update({
          where: { id: fileId },
          data: { content }
        })

        // Broadcast changes to other users in the room (except sender)
        socket.to(roomId).emit('code-change', {
          fileId,
          content,
          changes,
          user: socket.user,
          timestamp: new Date()
        })

      } catch (error) {
        console.error('Code change error:', error)
        socket.emit('error', { message: 'Failed to update code' })
      }
    })

    // Cursor position updates
    socket.on('cursor-update', async (data: {
      roomId: string
      fileId: string
      position: number
      line: number
      column: number
      selection?: string
    }) => {
      try {
        const { roomId, fileId, position, line, column, selection } = data

        // Update cursor position in database
        await prisma.cursor.upsert({
          where: {
            userId_fileId: {
              userId: socket.userId!,
              fileId
            }
          },
          update: {
            position,
            line,
            column,
            selection,
            lastActivity: new Date()
          },
          create: {
            userId: socket.userId!,
            fileId,
            position,
            line,
            column,
            selection
          }
        })

        // Broadcast cursor update to other users in the room
        socket.to(roomId).emit('cursor-update', {
          fileId,
          position,
          line,
          column,
          selection,
          user: socket.user,
          timestamp: new Date()
        })

      } catch (error) {
        console.error('Cursor update error:', error)
      }
    })

    // File operations
    socket.on('file-created', async (data: {
      roomId: string
      projectId: string
      file: {
        name: string
        path: string
        content: string
        language?: string
      }
    }) => {
      try {
        const { roomId, projectId, file } = data

        // Verify access to project
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            room: {
              OR: [
                { ownerId: socket.userId! },
                { 
                  members: {
                    some: { userId: socket.userId! }
                  }
                }
              ]
            }
          }
        })

        if (!project) {
          socket.emit('error', { message: 'Project not found or access denied' })
          return
        }

        const newFile = await prisma.projectFile.create({
          data: {
            name: file.name,
            path: file.path,
            content: file.content,
            language: file.language,
            projectId
          }
        })

        // Broadcast file creation to room
        io.to(roomId).emit('file-created', {
          file: newFile,
          user: socket.user,
          timestamp: new Date()
        })

      } catch (error) {
        console.error('File creation error:', error)
        socket.emit('error', { message: 'Failed to create file' })
      }
    })

    socket.on('file-deleted', async (data: {
      roomId: string
      fileId: string
    }) => {
      try {
        const { roomId, fileId } = data

        // Verify access and delete file
        const file = await prisma.projectFile.findFirst({
          where: {
            id: fileId,
            project: {
              room: {
                OR: [
                  { ownerId: socket.userId! },
                  { 
                    members: {
                      some: { userId: socket.userId! }
                    }
                  }
                ]
              }
            }
          }
        })

        if (!file) {
          socket.emit('error', { message: 'File not found or access denied' })
          return
        }

        await prisma.projectFile.delete({
          where: { id: fileId }
        })

        // Broadcast file deletion to room
        io.to(roomId).emit('file-deleted', {
          fileId,
          user: socket.user,
          timestamp: new Date()
        })

      } catch (error) {
        console.error('File deletion error:', error)
        socket.emit('error', { message: 'Failed to delete file' })
      }
    })

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User ${socket.user?.name} disconnected`)
      // The socket will automatically leave all rooms
    })
  })
}