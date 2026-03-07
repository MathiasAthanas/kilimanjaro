import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { DownstreamService } from './downstream.service';

@Global()
@Module({ imports: [HttpModule], providers: [DownstreamService], exports: [DownstreamService] })
export class DownstreamModule {}
