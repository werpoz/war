import {
  SessionRepository,
  type SessionStatus,
} from '../../domain/repository/session.repository';
import { WhatsappStrategyFactory } from '../../infrastructure/factory/wa-strategy.factory';

export class CloseSessionUseCase {
  constructor(
    private readonly repo: SessionRepository,
    private readonly waFactory: WhatsappStrategyFactory,
  ) {}

  async execute(input: { sessionId: string }): Promise<SessionStatus> {
    const record = await this.repo.findById(input.sessionId);
    if (!record) return 'closed';
    if (record.status === 'removed') return 'removed';

    if (record.status !== 'closed') {
      const gateway = this.waFactory.get(record.provider);
      await gateway.closeSession(input.sessionId);
      await this.repo.updateStatus(input.sessionId, 'closed');
    }

    return 'closed';
  }
}
