import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

const READ_ACTIONS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    // Every analytics read of TermResult excludes EXEMPT subjects, so exemptions can never
    // distort averages, pass rates, rankings or distributions (one rule, applied centrally).
    this.$use(async (params, next) => {
      if (params.model === 'TermResult' && READ_ACTIONS.has(params.action)) {
        const args = (params.args ?? {}) as { where?: Record<string, unknown> };
        args.where = { AND: [args.where ?? {}, { resultStatus: { not: 'EXEMPT' } }] };
        params.args = args;
      }
      return next(params);
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
