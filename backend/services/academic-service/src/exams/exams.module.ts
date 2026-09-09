import { Module } from '@nestjs/common';
import { AssessmentModule } from '../assessments/assessments.module';
import { ReportCardsModule } from '../report-cards/report-cards.module';
import { ExamTypesController } from './exam-types.controller';
import { ExamTypesService } from './exam-types.service';
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
import { GradingResolverService } from './grading-resolver.service';

@Module({
  imports: [AssessmentModule, ReportCardsModule],
  controllers: [
    ExamTypesController,
    ExamWindowsController,
    ExamResultsController,
    ExamMarksController,
    ReportCompositionController,
    MeritExportController,
  ],
  providers: [
    ExamTypesService,
    ExamWindowsService,
    ExamResultsService,
    ExamMarksService,
    ReportCompositionService,
    MeritExportService,
    GradingResolverService,
  ],
  exports: [ExamTypesService, ExamWindowsService, ExamResultsService, ExamMarksService, ReportCompositionService],
})
export class ExamsModule {}
