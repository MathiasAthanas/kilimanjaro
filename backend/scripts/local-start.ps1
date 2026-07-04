param(
  [switch]$ResetDb,
  [string]$PostgresUser = "postgres",
  [string]$PostgresPassword = "Mtunzi123",
  [string]$PostgresHost = "localhost",
  [int]$PostgresPort = 5432
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

function Invoke-Checked {
  param([scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE"
  }
}

if (!(Get-Command psql -ErrorAction SilentlyContinue)) {
  throw "psql was not found. Add PostgreSQL bin folder to PATH, for example C:\Program Files\PostgreSQL\17\bin."
}

$env:PGPASSWORD = $PostgresPassword

if ($ResetDb) {
  Write-Host "Dropping local database kilimanjaro_db..."
  Invoke-Checked { psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'kilimanjaro_db';" }
  Invoke-Checked { psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -c "DROP DATABASE IF EXISTS kilimanjaro_db;" }
}

Write-Host "Creating local database and schemas..."
Invoke-Checked { psql -h $PostgresHost -p $PostgresPort -U $PostgresUser -d postgres -f (Join-Path $PSScriptRoot "local-db-init.sql") }

& (Join-Path $PSScriptRoot "local-env.ps1")

$serviceOrder = @(
  "analytics-service",
  "api-gateway",
  "auth-service",
  "student-service",
  "academic-service",
  "finance-service",
  "notification-service",
  "elearning-service"
)

foreach ($service in $serviceOrder) {
  Write-Host "Pushing Prisma schema for $service"
  Push-Location (Join-Path $root "services/$service")
  Invoke-Checked { npx prisma db push --accept-data-loss --skip-generate }
  Pop-Location
}

Invoke-Checked { npm run build }
Invoke-Checked { npm run seed:production-demo }

if (!(Get-Command pm2 -ErrorAction SilentlyContinue)) {
  Invoke-Checked { npm install -g pm2 }
}

pm2 delete all
Invoke-Checked { pm2 start ecosystem.local.config.js --update-env }
Invoke-Checked { pm2 save }
Invoke-Checked { pm2 list }

Write-Host ""
Write-Host "Local backend is ready:"
Write-Host "  Gateway: http://localhost:3000"
Write-Host "  Health:  http://localhost:3000/health"
