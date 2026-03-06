import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { compileTemplateSafe } from '../common/helpers/handlebars.helper';
import { PrismaService } from '../prisma/prisma.service';
import { PreviewTemplateDto, TemplateQueryDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: TemplateQueryDto) {
    return this.prisma.notificationTemplate.findMany({
      where: {
        eventType: query.eventType,
        channel: query.channel,
        isActive: query.isActive === undefined ? undefined : query.isActive === 'true',
      },
      orderBy: { eventType: 'asc' },
    });
  }

  async byId(id: string) {
    const row = await this.prisma.notificationTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  async update(id: string, dto: UpdateTemplateDto, userId: string) {
    const current = await this.byId(id);
    const body = dto.body ?? current.body;

    try {
      compileTemplateSafe(body, { test: 'value' });
      if (dto.subject) compileTemplateSafe(dto.subject, { test: 'value' });
      if (dto.smsBody) compileTemplateSafe(dto.smsBody, { test: 'value' });
    } catch (error) {
      throw new BadRequestException(`Template compile error: ${(error as Error).message}`);
    }

    return this.prisma.notificationTemplate.update({
      where: { id },
      data: { ...dto, updatedById: userId },
    });
  }

  async preview(dto: PreviewTemplateDto) {
    const tpl = await this.byId(dto.templateId);
    return {
      subject: tpl.subject ? compileTemplateSafe(tpl.subject, dto.sampleVariables) : null,
      body: compileTemplateSafe(tpl.body, dto.sampleVariables),
      smsBody: tpl.smsBody ? compileTemplateSafe(tpl.smsBody, dto.sampleVariables) : null,
      channel: tpl.channel as NotificationChannel,
    };
  }
}
