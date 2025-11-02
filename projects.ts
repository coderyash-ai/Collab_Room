import { Router } from 'express'
import { prisma } from '../index'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Create new project in a room
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, description, roomId, gitUrl } = req.body

    if (!name || !roomId) {
      return res.status(400).json({ error: 'Project name and room ID are required' })
    }

    // Check if user has access to the room
    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        OR: [
          { ownerId: req.user!.id },
          { 
            members: {
              some: { userId: req.user!.id }
            }
          }
        ]
      }
    })

    if (!room) {
      return res.status(404).json({ error: 'Room not found or access denied' })
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        roomId,
        gitUrl
      },
      include: {
        files: true,
        room: {
          select: { id: true, name: true }
        }
      }
    })

    // Create a default file
    await prisma.projectFile.create({
      data: {
        name: 'README.md',
        path: '/README.md',
        content: `# ${name}\n\n${description || 'Project description goes here...'}`,
        language: 'markdown',
        projectId: project.id
      }
    })

    res.status(201).json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get project by ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: {
        id,
        room: {
          OR: [
            { ownerId: req.user!.id },
            { 
              members: {
                some: { userId: req.user!.id }
              }
            }
          ]
        }
      },
      include: {
        files: {
          orderBy: [
            { path: 'asc' }
          ]
        },
        room: {
          select: { id: true, name: true }
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' })
    }

    res.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Create or update file
router.post('/:id/files', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { name, path, content, language } = req.body

    if (!name || !path || content === undefined) {
      return res.status(400).json({ error: 'File name, path, and content are required' })
    }

    // Check project access
    const project = await prisma.project.findFirst({
      where: {
        id,
        room: {
          OR: [
            { ownerId: req.user!.id },
            { 
              members: {
                some: { userId: req.user!.id }
              }
            }
          ]
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' })
    }

    // Check if file already exists
    const existingFile = await prisma.projectFile.findFirst({
      where: {
        projectId: id,
        path
      }
    })

    let file
    if (existingFile) {
      // Update existing file
      file = await prisma.projectFile.update({
        where: { id: existingFile.id },
        data: {
          name,
          content,
          language
        }
      })
    } else {
      // Create new file
      file = await prisma.projectFile.create({
        data: {
          name,
          path,
          content,
          language,
          projectId: id
        }
      })
    }

    res.json({ file })
  } catch (error) {
    console.error('Create/update file error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Get file content
router.get('/:id/files/:fileId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id, fileId } = req.params

    const file = await prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId: id,
        project: {
          room: {
            OR: [
              { ownerId: req.user!.id },
              { 
                members: {
                  some: { userId: req.user!.id }
                }
              }
            ]
          }
        }
      }
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied' })
    }

    res.json({ file })
  } catch (error) {
    console.error('Get file error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete file
router.delete('/:id/files/:fileId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id, fileId } = req.params

    const file = await prisma.projectFile.findFirst({
      where: {
        id: fileId,
        projectId: id,
        project: {
          room: {
            OR: [
              { ownerId: req.user!.id },
              { 
                members: {
                  some: { userId: req.user!.id }
                }
              }
            ]
          }
        }
      }
    })

    if (!file) {
      return res.status(404).json({ error: 'File not found or access denied' })
    }

    await prisma.projectFile.delete({
      where: { id: fileId }
    })

    res.json({ message: 'File deleted successfully' })
  } catch (error) {
    console.error('Delete file error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Update project
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { name, description, gitUrl } = req.body

    const project = await prisma.project.findFirst({
      where: {
        id,
        room: {
          ownerId: req.user!.id // Only room owner can update project
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' })
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(gitUrl !== undefined && { gitUrl })
      },
      include: {
        files: true,
        room: {
          select: { id: true, name: true }
        }
      }
    })

    res.json({ project: updatedProject })
  } catch (error) {
    console.error('Update project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Delete project
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const project = await prisma.project.findFirst({
      where: {
        id,
        room: {
          ownerId: req.user!.id // Only room owner can delete project
        }
      }
    })

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' })
    }

    await prisma.project.delete({
      where: { id }
    })

    res.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Delete project error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router