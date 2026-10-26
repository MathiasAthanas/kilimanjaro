import { ImportService } from './import.service';

describe('ImportService stage derivation', () => {
  const service = new ImportService({} as never, {} as never);

  it.each(['Baby Class A', 'KG 1 B', 'KG 2 C', 'Pre-Unit A'])('maps %s to the unified Nursery stage', (className) => {
    expect((service as any).deriveStage(className)).toBe('NURSERY');
  });
});
