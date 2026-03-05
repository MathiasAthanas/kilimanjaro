import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateEngineConfigDto {
  @IsOptional() @IsNumber() failureThreshold?: number;
  @IsOptional() @IsNumber() atRiskThreshold?: number;
  @IsOptional() @IsNumber() excellenceThreshold?: number;
  @IsOptional() @IsNumber() suddenDeclineThreshold?: number;
  @IsOptional() @IsNumber() rapidImprovementThreshold?: number;
  @IsOptional() @IsNumber() @Min(1) chronicUnderperformanceTerms?: number;
  @IsOptional() @IsNumber() @Min(1) consecutiveDeclineTerms?: number;
  @IsOptional() @IsNumber() peerSuggestionMinPeerScore?: number;
  @IsOptional() @IsNumber() peerSuggestionMaxScoreGap?: number;
  @IsOptional() @IsBoolean() peerSuggestionSameClass?: boolean;
  @IsOptional() @IsNumber() volatilityStdDevThreshold?: number;
  @IsOptional() @IsBoolean() analysisEnabled?: boolean;
  @IsOptional() @IsBoolean() autoNotifyTeacher?: boolean;
  @IsOptional() @IsBoolean() autoNotifyAcademicDept?: boolean;
  @IsOptional() @IsBoolean() autoNotifyParent?: boolean;
}