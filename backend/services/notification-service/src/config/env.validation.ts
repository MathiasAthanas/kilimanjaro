type EnvConfig = Record<string, unknown>;

const requiredInProduction = [
  'DATABASE_URL',
  'INTERNAL_API_KEY',
  'REDIS_HOST',
  'REDIS_PORT',
  'RABBITMQ_URL',
  'AUTH_SERVICE_URL',
  'STUDENT_SERVICE_URL',
];

function asString(config: EnvConfig, key: string): string {
  return String(config[key] ?? '').trim();
}

function requireKeys(config: EnvConfig, keys: string[]): void {
  const missing = keys.filter((key) => !asString(config, key));
  if (missing.length) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }
}

function validatePort(config: EnvConfig): void {
  const port = Number(config.PORT ?? 3005);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
}

export function validateEnv(config: EnvConfig): EnvConfig {
  validatePort(config);

  if (asString(config, 'NODE_ENV') === 'production') {
    requireKeys(config, requiredInProduction);
  }

  return config;
}
