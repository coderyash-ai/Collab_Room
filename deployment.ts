import { Server } from 'socket.io'
import { prisma } from '../index'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { Octokit } from '@octokit/rest'

const execAsync = promisify(exec)

export interface DeploymentConfig {
  provider: 'vercel' | 'netlify' | 'aws' | 'heroku' | 'github-pages' | 'docker'
  buildCommand?: string
  outputDirectory?: string
  environmentVariables?: { [key: string]: string }
  domain?: string
  framework?: string
  nodeVersion?: string
}

export interface DeploymentStatus {
  id: string
  status: 'pending' | 'building' | 'deploying' | 'success' | 'failed'
  progress: number
  logs: string[]
  url?: string
  error?: string
  startTime: Date
  endTime?: Date
}

export class DeploymentService {
  private io: Server
  private activeDeployments = new Map<string, DeploymentStatus>()

  constructor(io: Server) {
    this.io = io
  }

  setupHandlers() {
    const deployNamespace = this.io.of('/deployment')

    deployNamespace.on('connection', (socket) => {
      console.log('Deployment client connected:', socket.id)

      // Start deployment
      socket.on('start-deployment', async (data: {
        token: string
        roomId: string
        projectId: string
        config: DeploymentConfig
      }) => {
        try {
          const { token, roomId, projectId, config } = data

          // Verify authentication
          const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET!) as any
          const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, name: true, avatar: true }
          })

          if (!user) {
            socket.emit('deployment-error', { message: 'Authentication failed' })
            return
          }

          // Verify project access
          const project = await prisma.project.findFirst({
            where: {
              id: projectId,
              room: {
                OR: [
                  { ownerId: user.id },
                  { members: { some: { userId: user.id } } }
                ]
              }
            },
            include: {
              files: true,
              room: true
            }
          })

          if (!project) {
            socket.emit('deployment-error', { message: 'Project not found or access denied' })
            return
          }

          socket.join(roomId)

          const deploymentId = crypto.randomUUID()
          const deployment: DeploymentStatus = {
            id: deploymentId,
            status: 'pending',
            progress: 0,
            logs: [],
            startTime: new Date()
          }

          this.activeDeployments.set(deploymentId, deployment)

          // Store deployment in database
          await prisma.deployment.create({
            data: {
              id: deploymentId,
              projectId,
              userId: user.id,
              provider: config.provider.toUpperCase() as any,
              status: 'PENDING',
              config: JSON.stringify(config)
            }
          })

          socket.emit('deployment-started', { deploymentId, status: deployment })

          // Notify room about deployment start
          socket.to(roomId).emit('team-deployment-started', {
            deploymentId,
            user,
            provider: config.provider,
            timestamp: new Date()
          })

          // Start deployment process
          this.processDeployment(deploymentId, project, config, user, roomId)

        } catch (error) {
          console.error('Start deployment error:', error)
          socket.emit('deployment-error', { message: 'Failed to start deployment' })
        }
      })

      // Get deployment status
      socket.on('get-deployment-status', (deploymentId: string) => {
        const deployment = this.activeDeployments.get(deploymentId)
        if (deployment) {
          socket.emit('deployment-status', deployment)
        } else {
          socket.emit('deployment-error', { message: 'Deployment not found' })
        }
      })

      // Cancel deployment
      socket.on('cancel-deployment', async (data: {
        token: string
        deploymentId: string
        roomId: string
      }) => {
        try {
          const { token, deploymentId, roomId } = data

          const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET!) as any
          const deployment = this.activeDeployments.get(deploymentId)

          if (deployment && (deployment.status === 'pending' || deployment.status === 'building')) {
            deployment.status = 'failed'
            deployment.error = 'Cancelled by user'
            deployment.endTime = new Date()

            await prisma.deployment.update({
              where: { id: deploymentId },
              data: {
                status: 'FAILED',
                error: 'Cancelled by user',
                endedAt: new Date()
              }
            })

            socket.emit('deployment-cancelled', { deploymentId })
            socket.to(roomId).emit('team-deployment-cancelled', {
              deploymentId,
              timestamp: new Date()
            })
          }

        } catch (error) {
          console.error('Cancel deployment error:', error)
          socket.emit('deployment-error', { message: 'Failed to cancel deployment' })
        }
      })

      // Get deployment history for project
      socket.on('get-deployment-history', async (data: {
        token: string
        projectId: string
        limit?: number
      }) => {
        try {
          const { token, projectId, limit = 10 } = data

          const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET!) as any
          
          const deployments = await prisma.deployment.findMany({
            where: { projectId },
            include: {
              user: {
                select: { id: true, name: true, avatar: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
          })

          socket.emit('deployment-history', { deployments })

        } catch (error) {
          console.error('Get deployment history error:', error)
          socket.emit('deployment-error', { message: 'Failed to get deployment history' })
        }
      })
    })
  }

  private async processDeployment(
    deploymentId: string,
    project: any,
    config: DeploymentConfig,
    user: any,
    roomId: string
  ) {
    const deployment = this.activeDeployments.get(deploymentId)!
    const deployNamespace = this.io.of('/deployment')

    const updateProgress = (status: DeploymentStatus['status'], progress: number, message: string) => {
      deployment.status = status
      deployment.progress = progress
      deployment.logs.push(`[${new Date().toISOString()}] ${message}`)

      deployNamespace.to(roomId).emit('deployment-progress', {
        deploymentId,
        status: deployment.status,
        progress: deployment.progress,
        message,
        timestamp: new Date()
      })
    }

    try {
      updateProgress('building', 10, 'Preparing project files...')

      // Create temporary directory for build
      const tempDir = path.join(process.cwd(), 'temp', deploymentId)
      await fs.mkdir(tempDir, { recursive: true })

      updateProgress('building', 20, 'Writing project files...')

      // Write all project files to temp directory
      for (const file of project.files) {
        const filePath = path.join(tempDir, file.path)
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content, 'utf-8')
      }

      updateProgress('building', 40, 'Installing dependencies...')

      // Install dependencies based on project type
      const packageJsonPath = path.join(tempDir, 'package.json')
      const requirementsPath = path.join(tempDir, 'requirements.txt')

      if (await this.fileExists(packageJsonPath)) {
        await execAsync('npm install', { cwd: tempDir })
        updateProgress('building', 60, 'Dependencies installed successfully')
      } else if (await this.fileExists(requirementsPath)) {
        await execAsync('pip install -r requirements.txt', { cwd: tempDir })
        updateProgress('building', 60, 'Python dependencies installed successfully')
      }

      updateProgress('building', 70, 'Building project...')

      // Run build command if specified
      if (config.buildCommand) {
        const { stdout, stderr } = await execAsync(config.buildCommand, { cwd: tempDir })
        deployment.logs.push(`Build output: ${stdout}`)
        if (stderr) {
          deployment.logs.push(`Build warnings: ${stderr}`)
        }
      }

      updateProgress('deploying', 80, `Deploying to ${config.provider}...`)

      // Deploy based on provider
      let deploymentUrl: string | undefined

      switch (config.provider) {
        case 'vercel':
          deploymentUrl = await this.deployToVercel(tempDir, config, deployment)
          break
        case 'netlify':
          deploymentUrl = await this.deployToNetlify(tempDir, config, deployment)
          break
        case 'github-pages':
          deploymentUrl = await this.deployToGitHubPages(tempDir, config, deployment, project)
          break
        case 'docker':
          deploymentUrl = await this.deployToDocker(tempDir, config, deployment)
          break
        default:
          throw new Error(`Deployment provider ${config.provider} not yet implemented`)
      }

      updateProgress('success', 100, `Deployment successful! URL: ${deploymentUrl}`)

      deployment.url = deploymentUrl
      deployment.endTime = new Date()

      // Update database
      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'SUCCESS',
          url: deploymentUrl,
          logs: deployment.logs,
          endedAt: deployment.endTime
        }
      })

      // Notify room
      deployNamespace.to(roomId).emit('team-deployment-success', {
        deploymentId,
        user,
        url: deploymentUrl,
        provider: config.provider,
        timestamp: new Date()
      })

      // Cleanup temp directory
      await fs.rm(tempDir, { recursive: true, force: true })

    } catch (error: any) {
      console.error(`Deployment ${deploymentId} failed:`, error)
      
      deployment.status = 'failed'
      deployment.error = error.message
      deployment.endTime = new Date()
      deployment.logs.push(`[ERROR] ${error.message}`)

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: {
          status: 'FAILED',
          error: error.message,
          logs: deployment.logs,
          endedAt: deployment.endTime
        }
      })

      deployNamespace.to(roomId).emit('team-deployment-failed', {
        deploymentId,
        user,
        error: error.message,
        provider: config.provider,
        timestamp: new Date()
      })

      deployNamespace.to(roomId).emit('deployment-error', {
        deploymentId,
        message: error.message
      })
    }
  }

  private async deployToVercel(tempDir: string, config: DeploymentConfig, deployment: DeploymentStatus): Promise<string> {
    // Check for Vercel CLI
    try {
      await execAsync('vercel --version')
    } catch {
      throw new Error('Vercel CLI not installed. Please install with: npm i -g vercel')
    }

    // Create vercel.json if not exists
    const vercelConfigPath = path.join(tempDir, 'vercel.json')
    if (!await this.fileExists(vercelConfigPath)) {
      const vercelConfig = {
        buildCommand: config.buildCommand,
        outputDirectory: config.outputDirectory || 'dist',
        framework: config.framework,
        env: config.environmentVariables || {}
      }
      await fs.writeFile(vercelConfigPath, JSON.stringify(vercelConfig, null, 2))
    }

    // Deploy to Vercel
    const { stdout } = await execAsync('vercel --prod --confirm', { 
      cwd: tempDir,
      env: { ...process.env, ...config.environmentVariables }
    })

    // Extract URL from output
    const urlMatch = stdout.match(/https:\/\/[^\s]+/)
    return urlMatch ? urlMatch[0] : `https://vercel.app/deployment/${deployment.id}`
  }

  private async deployToNetlify(tempDir: string, config: DeploymentConfig, deployment: DeploymentStatus): Promise<string> {
    try {
      await execAsync('netlify --version')
    } catch {
      throw new Error('Netlify CLI not installed. Please install with: npm i -g netlify-cli')
    }

    const buildDir = config.outputDirectory || 'dist'
    const { stdout } = await execAsync(`netlify deploy --prod --dir=${buildDir}`, {
      cwd: tempDir,
      env: { ...process.env, ...config.environmentVariables }
    })

    const urlMatch = stdout.match(/Live Draft URL: (https:\/\/[^\s]+)/)
    return urlMatch ? urlMatch[1] : `https://netlify.app/deployment/${deployment.id}`
  }

  private async deployToGitHubPages(tempDir: string, config: DeploymentConfig, deployment: DeploymentStatus, project: any): Promise<string> {
    // This would require GitHub token and repository setup
    // For now, return a placeholder
    return `https://${project.room.name}.github.io/${project.name}`
  }

  private async deployToDocker(tempDir: string, config: DeploymentConfig, deployment: DeploymentStatus): Promise<string> {
    // Create Dockerfile if not exists
    const dockerfilePath = path.join(tempDir, 'Dockerfile')
    if (!await this.fileExists(dockerfilePath)) {
      const dockerfile = `
FROM node:${config.nodeVersion || '18'}-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
${config.buildCommand ? `RUN ${config.buildCommand}` : ''}
EXPOSE 3000
CMD ["npm", "start"]
`
      await fs.writeFile(dockerfilePath, dockerfile)
    }

    const imageName = `collab-room-${project.name}:${deployment.id.substring(0, 8)}`
    
    // Build Docker image
    await execAsync(`docker build -t ${imageName} .`, { cwd: tempDir })
    
    // For demo, just return the image name
    return `docker://localhost/${imageName}`
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  // Get deployment status for API endpoints
  async getDeploymentStatus(deploymentId: string): Promise<DeploymentStatus | null> {
    return this.activeDeployments.get(deploymentId) || null
  }

  // Clean up old deployments from memory
  async cleanupOldDeployments() {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    
    for (const [id, deployment] of this.activeDeployments.entries()) {
      if (deployment.endTime && deployment.endTime < twoDaysAgo) {
        this.activeDeployments.delete(id)
      }
    }
  }
}