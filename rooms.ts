import { Router } from 'express'
import { prisma } from '../index'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Get all rooms for current user
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        OR: [
          { ownerId: req.user!.id },
          { 
            members: {
              some: { userId: req.user!.id }
            }
          }
        ]
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        _count: {
          select: { members: true, projects: true }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    res.json({ rooms })
  } catch (error) {
    console.error('Get rooms error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create new room
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, isPublic } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Room name is required' })
    }

    const room = await prisma.room.create({
      data: {
        name,
        description: description || null,
        isPublic: isPublic || false,
        ownerId: req.user!.id
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    })

    // Add owner as a member with OWNER role
    await prisma.roomMember.create({
      data: {
        userId: req.user!.id,
        roomId: room.id,
        role: 'OWNER'
      }
    })

    res.status(201).json({ room })
  } catch (error) {
    console.error('Create room error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get room by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const room = await prisma.room.findFirst({
      where: {
        id,
        OR: [
          { ownerId: req.user!.id },
          { 
            members: {
              some: { userId: req.user!.id }
            }
          },
          { isPublic: true }
        ]
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        },
        projects: {
          include: {
            files: {
              select: { id: true, name: true, path: true, language: true }
            }
          }
        }
      }
    })

    if (!room) {
      return res.status(404).json({ error: 'Room not found or access denied' })
    }

    res.json({ room })
  } catch (error) {
    console.error('Get room error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Join room by invite code
router.post('/join/:inviteCode', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { inviteCode } = req.params

    const room = await prisma.room.findUnique({
      where: { inviteCode },
      include: {
        members: true
      }
    })

    if (!room) {
      return res.status(404).json({ error: 'Invalid invite code' })
    }

    // Check if user is already a member
    const existingMember = room.members.find(member => member.userId === req.user!.id)
    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this room' })
    }

    // Add user as member
    await prisma.roomMember.create({
      data: {
        userId: req.user!.id,
        roomId: room.id,
        role: 'MEMBER'
      }
    })

    const updatedRoom = await prisma.room.findUnique({
      where: { id: room.id },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    })

    res.json({ room: updatedRoom })
  } catch (error) {
    console.error('Join room error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Leave room
router.post('/:id/leave', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const room = await prisma.room.findUnique({
      where: { id }
    })

    if (!room) {
      return res.status(404).json({ error: 'Room not found' })
    }

    if (room.ownerId === req.user!.id) {
      return res.status(400).json({ error: 'Room owner cannot leave the room' })
    }

    await prisma.roomMember.deleteMany({
      where: {
        userId: req.user!.id,
        roomId: id
      }
    })

    res.json({ message: 'Left room successfully' })
  } catch (error) {
    console.error('Leave room error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update room
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { name, description, isPublic } = req.body

    const room = await prisma.room.findUnique({
      where: { id }
    })

    if (!room) {
      return res.status(404).json({ error: 'Room not found' })
    }

    if (room.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only room owner can update the room' })
    }

    const updatedRoom = await prisma.room.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(isPublic !== undefined && { isPublic })
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true }
            }
          }
        }
      }
    })

    res.json({ room: updatedRoom })
  } catch (error) {
    console.error('Update room error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete room
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const room = await prisma.room.findUnique({
      where: { id }
    })

    if (!room) {
      return res.status(404).json({ error: 'Room not found' })
    }

    if (room.ownerId !== req.user!.id) {
      return res.status(403).json({ error: 'Only room owner can delete the room' })
    }

    await prisma.room.delete({
      where: { id }
    })

    res.json({ message: 'Room deleted successfully' })
  } catch (error) {
    console.error('Delete room error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router