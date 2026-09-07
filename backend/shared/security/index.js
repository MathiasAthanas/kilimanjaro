const { AsyncLocalStorage } = require('node:async_hooks');
const { ForbiddenException, BadRequestException } = require('@nestjs/common');
const storage = new AsyncLocalStorage();
const rolesOf = user => Array.isArray(user?.roles) && user.roles.length ? user.roles.map(r => typeof r === 'string' ? r : r.role) : user?.role ? [user.role] : [];
const hasRole = (user, role) => rolesOf(user).includes(role);
const hasAnyRole = (user, allowed) => allowed.some(role => hasRole(user, role));
const context = () => storage.getStore();
const runWithIdentity = (identity, fn) => storage.run(identity, () => {
  const result = fn();
  // Prisma promises are lazy: assimilate them while still in the school context.
  return result && typeof result.then === 'function' ? Promise.resolve(result) : result;
});
const requireSchool = (user = context()) => {
  if (!user?.schoolId) throw new ForbiddenException('School context is required');
  return user.schoolId;
};
const scopeToSchool = (user, where = {}) => ({ ...where, schoolId: requireSchool(user) });
const identityHeaders = (user = context()) => user ? {
  'X-User-Id': user.id || user.sub || '',
  'X-User-Role': user.primaryRole || user.role || '',
  'X-User-Primary-Role': user.primaryRole || user.role || '',
  'X-User-Roles': rolesOf(user).join(','),
  'X-User-Email': user.email || '',
  'X-School-Id': user.schoolId || '',
} : {};
const cacheKey = key => `${requireSchool()}:${key}`;
const schoolEvent = payload => {
  const schoolId = Object.prototype.hasOwnProperty.call(payload || {}, 'schoolId') ? payload.schoolId : requireSchool();
  if (context()?.schoolId && schoolId !== context().schoolId) throw new ForbiddenException('Event school override is forbidden');
  return { ...payload, schoolId };
};

// Every Prisma operation on a school-owned model is scoped, including aggregate,
// updateMany and compound unique lookups. Database constraints also enforce
// same-school relationships, including relations written by nested operations.
function installSchoolScope(prisma) {
  const models = prisma._runtimeDataModel.models;
  const owned = name => models[name]?.fields.some(f => f.name === 'schoolId');
  function dataFor(model, data, schoolId, creating) {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(d => dataFor(model, d, schoolId, creating));
    const out = { ...data };
    if (owned(model)) {
      if (out.schoolId !== undefined && out.schoolId !== schoolId) throw new ForbiddenException('School override is forbidden');
      if (creating) out.schoolId = schoolId;
      else delete out.schoolId;
    }
    for (const field of models[model].fields.filter(f => f.kind === 'object')) {
      if (!out[field.name]) continue;
      const nested = { ...out[field.name] };
      for (const op of ['create', 'createMany']) {
        if (nested[op]) nested[op] = op === 'createMany' ? { ...nested[op], data: dataFor(field.type, nested[op].data, schoolId, true) } : dataFor(field.type, nested[op], schoolId, true);
      }
      const map = (value, fn) => Array.isArray(value) ? value.map(fn) : fn(value);
      if (nested.update) nested.update = map(nested.update, entry => entry.data ? { ...entry, data: dataFor(field.type, entry.data, schoolId, false) } : dataFor(field.type, entry, schoolId, false));
      if (nested.updateMany) nested.updateMany = map(nested.updateMany, entry => ({ ...entry, where: { ...entry.where, schoolId }, data: dataFor(field.type, entry.data, schoolId, false) }));
      if (nested.deleteMany) nested.deleteMany = map(nested.deleteMany, where => ({ ...where, schoolId }));
      if (nested.upsert) nested.upsert = map(nested.upsert, entry => ({ ...entry, create: dataFor(field.type, entry.create, schoolId, true), update: dataFor(field.type, entry.update, schoolId, false) }));
      if (nested.connectOrCreate) nested.connectOrCreate = map(nested.connectOrCreate, entry => ({ ...entry, where: { ...entry.where, schoolId }, create: dataFor(field.type, entry.create, schoolId, true) }));
      out[field.name] = nested;
    }
    return out;
  }
  prisma.$use(async (params, next) => {
    if (!params.model || !owned(params.model)) return next(params);
    const schoolId = requireSchool();
    const args = { ...(params.args || {}) };
    if (['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(params.action)) {
      args.where = { ...args.where, schoolId };
    }
    if (['create', 'createMany'].includes(params.action)) args.data = dataFor(params.model, args.data, schoolId, true);
    if (['update', 'updateMany'].includes(params.action)) args.data = dataFor(params.model, args.data, schoolId, false);
    if (params.action === 'upsert') {
      args.create = dataFor(params.model, args.create, schoolId, true);
      args.update = dataFor(params.model, args.update, schoolId, false);
    }
    return next({ ...params, args });
  });
}
module.exports = { rolesOf, hasRole, hasAnyRole, context, runWithIdentity, requireSchool, scopeToSchool, identityHeaders, cacheKey, schoolEvent, installSchoolScope };

function SchoolJob() {
  return (_target, _key, descriptor) => {
    const original = descriptor.value;
    descriptor.value = async function (...args) {
      if (context()?.schoolId) return original.apply(this, args);
      const visited = new Set();
      const findPrisma = (obj, depth = 0) => {
        if (!obj || typeof obj !== 'object' || visited.has(obj) || depth > 3) return;
        visited.add(obj);
        if (typeof obj.$queryRawUnsafe === 'function') return obj;
        for (const value of Object.values(obj)) { const found = findPrisma(value, depth + 1); if (found) return found; }
      };
      const prisma = findPrisma(this);
      if (!prisma) throw new Error('Scheduled school job requires a Prisma service');
      const schools = await prisma.$queryRawUnsafe('SELECT id FROM auth.schools WHERE "isActive" = true');
      for (const school of schools) await runWithIdentity({ id: 'scheduled-job', role: 'SYSTEM_ADMIN', roles: ['SYSTEM_ADMIN'], schoolId: school.id }, () => original.apply(this, args));
    };
    return descriptor;
  };
}
module.exports.SchoolJob = SchoolJob;
// Self-service restrictions apply only when no staff role grants broader access.
const staffRoles = ['SYSTEM_ADMIN','BOARD_DIRECTOR','MANAGING_DIRECTOR','PRINCIPAL','ACADEMIC_QA','FINANCE','HEAD_OF_DEPARTMENT','TEACHER'];
const leadershipRoles = staffRoles.filter(r => !['TEACHER','FINANCE'].includes(r));
const isSelfService = user => !hasAnyRole(user, staffRoles);
const isTeacherOnly = user => hasRole(user, 'TEACHER') && !hasAnyRole(user, leadershipRoles);
module.exports.isSelfService = isSelfService;
module.exports.isTeacherOnly = isTeacherOnly;
