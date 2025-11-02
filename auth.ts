import { Router } from 'express'
import { prisma } from '../index'
import { generateToken, authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// OAuth callback handler (simplified - in production use proper OAuth flow)
router.post('/oauth/callback', async (req, res) => {
  try {
    const { email, name, avatar, provider, providerId } = req.body

    if (!email || !name || !provider || !providerId) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          avatar,
          provider,
          providerId
        }
      })
    } else {
      // Update user info if it changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name,
          avatar,
          provider,
          providerId
        }
      })
    }

    const token = generateToken(user.id)

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
router.get('/me', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        createdAt: true
      }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({ user })
  } catch (error) {
    console.error('Get user error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Logout (client-side token removal)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' })
})

export default router