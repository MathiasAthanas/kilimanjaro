param(
  [string]$InternalApiKey = "kilimanjaro-internal-auth-key"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$services = Join-Path $root "services"

function Get-EnvValue($path, $name) {
  if (!(Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line.StartsWith("$name=")) {
      return $line.Substring($name.Length + 1)
    }
  }
  return $null
}

function Write-ServiceEnv($service, [string[]]$lines) {
  $path = Join-Path $services "$service\.env"
  Set-Content -LiteralPath $path -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
  Write-Host "Wrote $path"
}

$authEnv = Join-Path $services "auth-service\.env"
$privateKey = Get-EnvValue $authEnv "JWT_PRIVATE_KEY"
$publicKey = Get-EnvValue $authEnv "JWT_PUBLIC_KEY"

if (!$privateKey -or !$publicKey) {
  throw "JWT keys were not found in auth-service/.env. Keep the current auth-service/.env or generate RSA keys first."
}

$commonOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"
$db = "postgresql://postgres:Mtunzi123@localhost:5432/kilimanjaro_db"

Write-ServiceEnv "auth-service" @(
  "NODE_ENV=development",
  "PORT=3001",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=auth",
  "JWT_PRIVATE_KEY=$privateKey",
  "JWT_PUBLIC_KEY=$publicKey",
  "JWT_ACCESS_EXPIRES_IN=15m",
  "JWT_REFRESH_EXPIRES_IN=7d",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "RABBITMQ_URL=amqp://localhost:5672",
  "INTERNAL_API_KEY=$InternalApiKey"
)

Write-ServiceEnv "api-gateway" @(
  "NODE_ENV=development",
  "PORT=3000",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=public",
  "JWT_PUBLIC_KEY=$publicKey",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "INTERNAL_API_KEY=$InternalApiKey",
  "AUTH_SERVICE_URL=http://localhost:3001",
  "STUDENT_SERVICE_URL=http://localhost:3002",
  "ACADEMIC_SERVICE_URL=http://localhost:3003",
  "FINANCE_SERVICE_URL=http://localhost:3004",
  "NOTIFICATION_SERVICE_URL=http://localhost:3005",
  "ANALYTICS_SERVICE_URL=http://localhost:3006",
  "ELEARNING_SERVICE_URL=http://localhost:3007"
)

Write-ServiceEnv "student-service" @(
  "NODE_ENV=development",
  "PORT=3002",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=students",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "RABBITMQ_URL=amqp://localhost:5672",
  "INTERNAL_API_KEY=$InternalApiKey"
)

Write-ServiceEnv "academic-service" @(
  "NODE_ENV=development",
  "PORT=3003",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=academics",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "RABBITMQ_URL=amqp://localhost:5672",
  "STUDENT_SERVICE_URL=http://localhost:3002",
  "STUDENT_SERVICE_TIMEOUT_MS=20000",
  "INTERNAL_API_KEY=$InternalApiKey"
)

Write-ServiceEnv "finance-service" @(
  "NODE_ENV=development",
  "PORT=3004",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=finance",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "RABBITMQ_URL=amqp://localhost:5672",
  "STUDENT_SERVICE_URL=http://localhost:3002",
  "ACADEMIC_SERVICE_URL=http://localhost:3003",
  "INTERNAL_API_KEY=$InternalApiKey",
  "WEBHOOK_SECRET=local-webhook-secret"
)

Write-ServiceEnv "notification-service" @(
  "NODE_ENV=development",
  "PORT=3005",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=notifications",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "RABBITMQ_URL=amqp://localhost:5672",
  "AUTH_SERVICE_URL=http://localhost:3001",
  "STUDENT_SERVICE_URL=http://localhost:3002",
  "INTERNAL_API_KEY=$InternalApiKey",
  "SMTP_HOST=localhost",
  "SMTP_PORT=1025",
  "SMS_PROVIDER=mock"
)

Write-ServiceEnv "analytics-service" @(
  "NODE_ENV=development",
  "PORT=3006",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=analytics",
  "REDIS_HOST=localhost",
  "REDIS_PORT=6379",
  "REDIS_PASSWORD=",
  "RABBITMQ_URL=amqp://localhost:5672",
  "AUTH_SERVICE_URL=http://localhost:3001",
  "STUDENT_SERVICE_URL=http://localhost:3002",
  "ACADEMIC_SERVICE_URL=http://localhost:3003",
  "FINANCE_SERVICE_URL=http://localhost:3004",
  "NOTIFICATION_SERVICE_URL=http://localhost:3005",
  "PDF_STORAGE_PATH=./storage/analytics",
  "INTERNAL_API_KEY=$InternalApiKey"
)

Write-ServiceEnv "elearning-service" @(
  "NODE_ENV=development",
  "PORT=3007",
  "ALLOWED_ORIGINS=$commonOrigins",
  "DATABASE_URL=$db`?schema=elearning",
  "ELEARNING_STORAGE_DIR=./storage/elearning",
  "INTERNAL_API_KEY=$InternalApiKey"
)
