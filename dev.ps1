# Development Script for Collab Room
# Starts both frontend and backend in development mode

Write-Host "🚀 Starting Collab Room in development mode..." -ForegroundColor Blue

# Check if dependencies are installed
if (!(Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Check if Prisma client is generated
if (!(Test-Path "apps/backend/node_modules/@prisma/client")) {
    Write-Host "🔨 Generating Prisma client..." -ForegroundColor Yellow
    Set-Location apps/backend
    npx prisma generate
    Set-Location ../..
}

# Start development servers
Write-Host "🏃‍♂️ Starting development servers..." -ForegroundColor Green
Write-Host "Frontend will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Backend will be available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop all servers" -ForegroundColor Yellow

# Start with concurrently (if available) or fallback to npm run dev
try {
    npm run dev
} catch {
    Write-Host "❌ Failed to start development servers. Make sure all dependencies are installed." -ForegroundColor Red
    Write-Host "Try running: npm install" -ForegroundColor Yellow
}