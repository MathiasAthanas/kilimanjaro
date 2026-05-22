type EnvConfig = Record<string, unknown>;

const requiredInProduction = ['DATABASE_URL', 'INTERNAL_API_KEY'];

function asString(config: EnvConfig, key: string): string {
  return String(config[key] ?? '').trim();
}

function validatePort(config: EnvConfig): void {
  const port = Number(config.PORT ?? 3007);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }
}

export function validateEnv(config: EnvConfig): EnvConfig {
  validatePort(config);
  if (asString(config, 'NODE_ENV') === 'production') {
    const missing = requiredInProduction.filter((key) => !asString(config, key));
    if (missing.length) throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }
  return config;
}
