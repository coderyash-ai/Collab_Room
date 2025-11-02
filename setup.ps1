# Collab Room Setup Script
# This script helps set up the development environment

Write-Host "🚀 Setting up Collab Room development environment..." -ForegroundColor Blue

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

# Check if PostgreSQL is available
try {
    $pgVersion = psql --version
    Write-Host "✓ PostgreSQL found: $pgVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  PostgreSQL not found in PATH. Please ensure PostgreSQL is installed and accessible." -ForegroundColor Yellow
}

# Install dependencies
Write-Host "`n📦 Installing dependencies..." -ForegroundColor Blue
npm install

# Set up backend
Write-Host "`n🔧 Setting up backend..." -ForegroundColor Blue
Set-Location apps/backend

# Check if .env exists
if (!(Test-Path ".env")) {
    Write-Host "📝 Creating backend .env file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "⚠️  Please update the DATABASE_URL in apps/backend/.env with your PostgreSQL credentials" -ForegroundColor Yellow
}

# Generate Prisma client
Write-Host "🔨 Generating Prisma client..." -ForegroundColor Blue
npx prisma generate

Write-Host "`n✅ Backend setup complete!" -ForegroundColor Green

# Set up frontend
Write-Host "`n🎨 Setting up frontend..." -ForegroundColor Blue
Set-Location ../frontend

# Check if .env.local exists
if (!(Test-Path ".env.local")) {
    Write-Host "📝 Creating frontend .env.local file..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
}

Write-Host "`n✅ Frontend setup complete!" -ForegroundColor Green

# Go back to root
Set-Location ../..

Write-Host "`n🎉 Setup complete! Next steps:" -ForegroundColor Green
Write-Host "1. Update apps/backend/.env with your PostgreSQL credentials" -ForegroundColor White
Write-Host "2. Create the PostgreSQL database: CREATE DATABASE collab_room;" -ForegroundColor White
Write-Host "3. Run database migrations: cd apps/backend && npx prisma migrate dev --name init" -ForegroundColor White
Write-Host "4. Start the development servers: npm run dev" -ForegroundColor White
Write-Host "`n🌐 URLs:" -ForegroundColor Blue
Write-Host "- Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "- Backend: http://localhost:5000" -ForegroundColor White