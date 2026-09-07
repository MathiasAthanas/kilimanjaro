#!/usr/bin/env python3
"""Bootstrap an EMPTY disposable PostgreSQL database, then test the upgrade path.
Requires git, psql, installed backend dependencies, and SCHOOL_TEST_DATABASE_URL.
Never creates/drops databases or loads application .env files.
"""
import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlparse

backend = Path(__file__).resolve().parents[1]
root = backend.parent
url = os.environ.get('SCHOOL_TEST_DATABASE_URL', '')
if not url or 'test' not in urlparse(url).path.lower():
    raise SystemExit('Set SCHOOL_TEST_DATABASE_URL to an EMPTY disposable test database')
env = {**os.environ, 'DATABASE_URL': url}
base = 'a87c805928dc962230111f4288da7bc62997a75e'
services = ['auth-service', 'student-service', 'academic-service', 'finance-service',
            'notification-service', 'elearning-service', 'api-gateway', 'analytics-service']

def sql(text):
    return subprocess.check_output(['psql', url, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], input=text, text=True)

if sql("SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');").strip() != '0':
    raise SystemExit('Refusing to modify a non-empty database')
with tempfile.TemporaryDirectory(prefix='kili-baseline-') as tmp:
    for service in services:
        schema = Path(tmp) / (service + '.prisma')
        schema.write_bytes(subprocess.check_output(['git', 'show', f'{base}:backend/services/{service}/prisma/schema.prisma'], cwd=root))
        ddl = subprocess.check_output([str(backend / 'node_modules/.bin/prisma'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', str(schema), '--script'], env=env, cwd=backend, text=True)
        if service == 'analytics-service':
            ddl = ';'.join(part for part in ddl.split(';') if '"analytics"' in part) + ';'
        sql(ddl)
        print('Baseline:', service, flush=True)
# Exercise real legacy rows and refresh-token invalidation before new tests add schools.
sql('''INSERT INTO auth.users(id,email,"passwordHash",role,"firstName","lastName","updatedAt")
VALUES ('legacy-test-user',' LEGACY@TEST.LOCAL ','not-a-login-hash','TEACHER','Legacy','Teacher',NOW());
INSERT INTO auth.refresh_tokens(id,"userId","tokenHash","expiresAt")
VALUES ('legacy-test-session','legacy-test-user','legacy-test-token',NOW()+INTERVAL '1 day');''')
for service in services:
    for migration in sorted((backend / 'services' / service / 'prisma/migrations').glob('20260906*/migration.sql')):
        sql(migration.read_text())
    print('Migrated:', service, flush=True)
backfill = backend / 'services/auth-service/prisma/migrations/20260906000200_school_roles_backfill/migration.sql'
sql(backfill.read_text())  # Backfill is repeatable before global accounts are provisioned.
sql('''DO $$ BEGIN
IF NOT EXISTS (SELECT 1 FROM auth.users u JOIN auth.user_role_assignments r ON r."userId"=u.id
WHERE u.id='legacy-test-user' AND u.email='legacy@test.local' AND u."schoolId"='00000000-0000-4000-8000-000000000001' AND r.role=u.role)
THEN RAISE EXCEPTION 'Legacy identity backfill failed'; END IF;
IF EXISTS (SELECT 1 FROM auth.refresh_tokens WHERE id='legacy-test-session' AND NOT "isRevoked")
THEN RAISE EXCEPTION 'Legacy session revocation failed'; END IF;
END $$;''')
sql((backend / 'scripts/school-integrity.sql').read_text())
print('Legacy backfill, session revocation, and all schema upgrades verified.')
