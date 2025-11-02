import { Server, Socket } from 'socket.io'
import { prisma } from '../index'

interface AuthenticatedSocket extends Socket {
  userId?: string
  user?: {
    id: string
    name: string
    avatar?: string
  }
}

export const setupChatHandlers = (io: Server) => {
  io.on('connection', (socket: AuthenticatedSocket) => {
    
    // Send message to room
    socket.on('send-message', async (data: {
      roomId: string
      content: string
      type?: 'TEXT' | 'CODE' | 'SYSTEM'
    }) => {
      try {
        const { roomId, content, type = 'TEXT' } = data

        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }

        // Verify user has access to room
        const room = await prisma.room.findFirst({
          where: {
            id: roomId,
            OR: [
              { ownerId: socket.userId },
              { 
                members: {
                  some: { userId: socket.userId }
                }
              }
            ]
          }
        })

        if (!room) {
          socket.emit('error', { message: 'Room not found or access denied' })
          return
        }

        // Save message to database
        const message = await prisma.message.create({
          data: {
            content,
            type,
            userId: socket.userId,
            roomId
          },
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        })

        // Broadcast message to all users in the room
        io.to(roomId).emit('message', {
          id: message.id,
          content: message.content,
          type: message.type,
          createdAt: message.createdAt,
          user: message.user
        })

        console.log(`Message sent in room ${roomId} by ${socket.user?.name}`)

      } catch (error) {
        console.error('Send message error:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // Get message history for room
    socket.on('get-messages', async (data: { roomId: string, limit?: number, offset?: number }) => {
      try {
        const { roomId, limit = 50, offset = 0 } = data

        if (!socket.userId) {
          socket.emit('error', { message: 'Not authenticated' })
          return
        }

        // Verify user has access to room
        const room = await prisma.room.findFirst({
          where: {
            id: roomId,
            OR: [
              { ownerId: socket.userId },
              { 
                members: {
                  some: { userId: socket.userId }
                }
              }
            ]
          }
        })

        if (!room) {
          socket.emit('error', { message: 'Room not found or access denied' })
          return
        }

        // Get messages from database
        const messages = await prisma.message.findMany({
          where: { roomId },
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        })

        socket.emit('messages', {
          roomId,
          messages: messages.reverse() // Reverse to show oldest first
        })

      } catch (error) {
        console.error('Get messages error:', error)
        socket.emit('error', { message: 'Failed to get messages' })
      }
    })

    // User typing indicator
    socket.on('typing', (data: { roomId: string, isTyping: boolean }) => {
      const { roomId, isTyping } = data
      
      socket.to(roomId).emit('user-typing', {
        user: socket.user,
        isTyping,
        timestamp: new Date()
      })
    })

    // Voice call signaling (basic WebRTC signaling)
    socket.on('call-offer', (data: {
      roomId: string
      targetUserId: string
      offer: any
    }) => {
      const { roomId, targetUserId, offer } = data
      
      socket.to(roomId).emit('call-offer', {
        fromUserId: socket.userId,
        fromUser: socket.user,
        offer,
        timestamp: new Date()
      })
    })

    socket.on('call-answer', (data: {
      roomId: string
      targetUserId: string
      answer: any
    }) => {
      const { roomId, targetUserId, answer } = data
      
      socket.to(roomId).emit('call-answer', {
        fromUserId: socket.userId,
        fromUser: socket.user,
        answer,
        timestamp: new Date()
      })
    })

    socket.on('ice-candidate', (data: {
      roomId: string
      targetUserId?: string
      candidate: any
    }) => {
      const { roomId, targetUserId, candidate } = data
      
      socket.to(roomId).emit('ice-candidate', {
        fromUserId: socket.userId,
        fromUser: socket.user,
        candidate,
        timestamp: new Date()
      })
    })

    socket.on('call-end', (data: { roomId: string }) => {
      const { roomId } = data
      
      socket.to(roomId).emit('call-end', {
        fromUserId: socket.userId,
        fromUser: socket.user,
        timestamp: new Date()
      })
    })
  })
}