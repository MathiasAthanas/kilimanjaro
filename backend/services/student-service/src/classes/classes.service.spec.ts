import { BadRequestException } from '@nestjs/common';
import { ClassesService } from './classes.service';

describe('ClassesService stage validation', () => {
  const service = new ClassesService({} as never, {} as never);

  const nurseryClass = (level: number) => ({
    name: 'Nursery class',
    educationStage: 'NURSERY',
    level,
    terminalYear: false,
  });

  it.each([1, 2, 3])('accepts Nursery level %s', (level) => {
    expect(() => (service as any).validateClassShape(nurseryClass(level))).not.toThrow();
  });

  it.each([0, 4])('rejects an unsupported Nursery level (%s)', (level) => {
    expect(() => (service as any).validateClassShape(nurseryClass(level))).toThrow(BadRequestException);
  });
});
