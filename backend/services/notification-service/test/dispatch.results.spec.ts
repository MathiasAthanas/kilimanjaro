import { DispatchService } from '../src/dispatch/dispatch.service';

describe('DispatchService result publication recipients', () => {
  function setup() {
    const resolver = {
      resolveResultRecipients: jest.fn().mockResolvedValue([
        {
          studentId: 'student-1',
          studentAuthUserId: 'student-user-1',
          guardianAuthUserId: 'parent-user-1',
          guardianEmail: 'parent@example.test',
          guardianPhone: '+255700000001',
        },
        {
          studentId: 'student-2',
          studentAuthUserId: 'student-user-2',
          guardianAuthUserId: null,
        },
      ]),
    };
    const service = new DispatchService({} as any, {} as any, {} as any, {} as any, resolver as any);
    return { service, resolver };
  }

  it('resolves every student id in a published class and includes available guardians', async () => {
    const { service, resolver } = setup();

    const recipients = await (service as any).eventRecipients('results.published', {
      classId: 'class-1',
      studentIds: ['student-1', 'student-2'],
    });

    expect(resolver.resolveResultRecipients).toHaveBeenCalledWith(['student-1', 'student-2']);
    expect(recipients).toEqual([
      { userId: 'student-user-1', role: 'STUDENT' },
      { userId: 'parent-user-1', role: 'PARENT', email: 'parent@example.test', phone: '+255700000001' },
      { userId: 'student-user-2', role: 'STUDENT' },
    ]);
  });

  it('does not notify families while a report card is generated but still unpublished', async () => {
    const { service, resolver } = setup();

    const recipients = await (service as any).eventRecipients('report_card.generated', {
      studentId: 'student-1',
      pdfUrl: 'report_student-1_term-1.pdf',
    });

    expect(recipients).toEqual([]);
    expect(resolver.resolveResultRecipients).not.toHaveBeenCalled();
  });
});
