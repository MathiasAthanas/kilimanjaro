import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessments/assessments.module';
import { ReportCardsModule } from '../report-cards/report-cards.module';
import { ExamTypesController } from './exam-types.controller';
import { ExamTypesService } from './exam-types.service';
import { ExamWindowSubjectsController } from './exam-window-subjects.controller';
import { ExamWindowSubjectsService } from './exam-window-subjects.service';
import { ExamWindowsController } from './exam-windows.controller';
import { ExamWindowsService } from './exam-windows.service';
import { ExamResultsController } from './exam-results.controller';
import { ExamResultsService } from './exam-results.service';
import { ExamMarksController } from './exam-marks.controller';
import { ExamMarksService } from './exam-marks.service';
import { ReportCompositionController } from './report-composition.controller';
import { ReportCompositionService } from './report-composition.service';
import { MeritExportController } from './merit-export.controller';
import { MeritExportService } from './merit-export.service';
import { GradingResolverModule } from './grading-resolver.module';
import { ResultCalculatorService } from './result-calculator.service';
import { ExemptionsController } from './exemptions.controller';
import { ExemptionsService } from './exemptions.service';
import { PerformanceExportController } from './performance-export.controller';
import { PerformanceExportService } from './performance-export.service';

@Module({
  imports: [AssessmentModule, ReportCardsModule, GradingResolverModule],
  controllers: [
    ExamTypesController,
    ExamWindowSubjectsController,
    ExamWindowsController,
    ExamResultsController,
    ExamMarksController,
    ReportCompositionController,
    MeritExportController,
    ExemptionsController,
    PerformanceExportController,
  ],
  providers: [
    ExamTypesService,
    ExamWindowsService,
    ExamWindowSubjectsService,
    ExamResultsService,
    ExamMarksService,
    ReportCompositionService,
    MeritExportService,
    ResultCalculatorService,
    ExemptionsService,
    PerformanceExportService,
  ],
  exports: [ExamTypesService, ExamWindowsService, ExamResultsService, ExamMarksService, ReportCompositionService],
})
export class ExamsModule {}
