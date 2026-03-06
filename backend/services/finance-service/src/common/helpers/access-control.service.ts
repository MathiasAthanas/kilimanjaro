import { ForbiddenException, Injectable } from '@nestjs/common';
import { StudentClientService } from '../../student-client/student-client.service';

@Injectable()
export class AccessControlService {
  constructor(private readonly studentClient: StudentClientService) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  async resolveStudentIdForAuthUser(authUserId: string): Promise<string | null> {
    const payload = await this.studentClient.get<any>(`/students/internal/by-auth/${authUserId}`);
    const data = this.unwrap<any>(payload);
    return data?.studentId || null;
  }

  async resolveGuardianStudentIds(authUserId: string): Promise<string[]> {
    const payload = await this.studentClient.get<any>(`/students/internal/guardian-by-auth/${authUserId}`);
    const data = this.unwrap<any>(payload);
    return data?.studentIds || [];
  }

  async assertParentOwnsStudent(authUserId: string, studentId: string): Promise<void> {
    const ids = await this.resolveGuardianStudentIds(authUserId);
    if (!ids.includes(studentId)) {
      throw new ForbiddenException('Parent can only access own child records');
    }
  }

  async assertStudentOwnsRecord(authUserId: string, studentId: string): Promise<void> {
    const resolved = await this.resolveStudentIdForAuthUser(authUserId);
    if (!resolved || resolved !== studentId) {
      throw new ForbiddenException('Student can only access own records');
    }
  }
}
