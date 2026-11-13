import { BadRequestException } from '@nestjs/common';
import { StoreService } from './store.service';

function service() {
  return new StoreService({} as any, {} as any, {} as any) as any;
}

describe('StoreService number handling', () => {
  it('treats a blank box on the form as zero instead of failing with a server error', () => {
    const s = service();
    expect(s.dec('').toString()).toBe('0');
    expect(s.dec('   ').toString()).toBe('0');
    expect(s.dec(undefined).toString()).toBe('0');
    expect(s.dec(null).toString()).toBe('0');
  });

  it('still reads real numbers, including surrounding spaces', () => {
    const s = service();
    expect(s.dec(' 1200 ').toString()).toBe('1200');
    expect(s.dec('2.5').toString()).toBe('2.5');
    expect(s.dec(40).toString()).toBe('40');
  });

  it('turns a non-number into a clear 400 message', () => {
    const s = service();
    expect(() => s.dec('abc')).toThrow(BadRequestException);
    expect(() => s.dec('abc')).toThrow(/not a valid number/);
  });

  it('tells a blank apart from a real value so updates keep the old figure', () => {
    const s = service();
    expect(s.isBlank('')).toBe(true);
    expect(s.isBlank('  ')).toBe(true);
    expect(s.isBlank(undefined)).toBe(true);
    expect(s.isBlank('0')).toBe(false);
  });
});
