import { Module } from '@nestjs/common';
import { AcademicModule } from '../academic/academic.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ExecutiveModule } from '../executive/executive.module';
import { FinanceAnalyticsModule } from '../finance/finance.module';
import { OverviewModule } from '../overview/overview.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StudentsModule } from '../students/students.module';
import { AttendanceSummaryGenerator } from './generators/attendance-summary.generator';
import { BoardExecutiveGenerator } from './generators/board-executive.generator';
import { ClassAcademicGenerator } from './generators/class-academic.generator';
import { FinanceCollectionGenerator } from './generators/finance-collection.generator';
import { OutstandingBalancesGenerator } from './generators/outstanding-balances.generator';
import { PerformanceEngineGenerator } from './generators/performance-engine.generator';
import { SchoolOverviewGenerator } from './generators/school-overview.generator';
import { StudentProfileGenerator } from './generators/student-profile.generator';
import { TeacherPerformanceGenerator } from './generators/teacher-performance.generator';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, OverviewModule, AcademicModule, FinanceAnalyticsModule, AttendanceModule, StudentsModule, ExecutiveModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    SchoolOverviewGenerator,
    ClassAcademicGenerator,
    StudentProfileGenerator,
    FinanceCollectionGenerator,
    OutstandingBalancesGenerator,
    PerformanceEngineGenerator,
    AttendanceSummaryGenerator,
    TeacherPerformanceGenerator,
    BoardExecutiveGenerator,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
