-- Add IDE Connection tracking
CREATE TABLE "IDEConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "ideType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "workspacePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IDEConnection_pkey" PRIMARY KEY ("id")
);

-- Add Deployment tracking
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "url" TEXT,
    "config" TEXT NOT NULL,
    "logs" TEXT[],
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- Add Git Operation tracking
CREATE TABLE "GitOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "result" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitOperation_pkey" PRIMARY KEY ("id")
);

-- Add Build/Command execution tracking
CREATE TABLE "BuildExecution" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "output" TEXT,
    "error" TEXT,
    "duration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BuildExecution_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "IDEConnection" ADD CONSTRAINT "IDEConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IDEConnection" ADD CONSTRAINT "IDEConnection_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GitOperation" ADD CONSTRAINT "GitOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitOperation" ADD CONSTRAINT "GitOperation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BuildExecution" ADD CONSTRAINT "BuildExecution_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuildExecution" ADD CONSTRAINT "BuildExecution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better query performance
CREATE INDEX "IDEConnection_userId_idx" ON "IDEConnection"("userId");
CREATE INDEX "IDEConnection_roomId_idx" ON "IDEConnection"("roomId");
CREATE INDEX "IDEConnection_status_idx" ON "IDEConnection"("status");

CREATE INDEX "Deployment_projectId_idx" ON "Deployment"("projectId");
CREATE INDEX "Deployment_userId_idx" ON "Deployment"("userId");
CREATE INDEX "Deployment_status_idx" ON "Deployment"("status");
CREATE INDEX "Deployment_createdAt_idx" ON "Deployment"("createdAt");

CREATE INDEX "GitOperation_projectId_idx" ON "GitOperation"("projectId");
CREATE INDEX "GitOperation_userId_idx" ON "GitOperation"("userId");
CREATE INDEX "GitOperation_createdAt_idx" ON "GitOperation"("createdAt");

CREATE INDEX "BuildExecution_projectId_idx" ON "BuildExecution"("projectId");
CREATE INDEX "BuildExecution_userId_idx" ON "BuildExecution"("userId");
CREATE INDEX "BuildExecution_status_idx" ON "BuildExecution"("status");
CREATE INDEX "BuildExecution_createdAt_idx" ON "BuildExecution"("createdAt");