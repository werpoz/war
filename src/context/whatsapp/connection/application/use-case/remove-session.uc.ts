import {
  SessionRepository,
  type SessionStatus,
} from '../../domain/repository/session.repository';
import { WhatsappStrategyFactory } from '../../infrastructure/factory/wa-strategy.factory';

export class RemoveSessionUseCase {
  constructor(
    private readonly repo: SessionRepository,
    private readonly waFactory: WhatsappStrategyFactory,
  ) {}

  async execute(input: { sessionId: string }): Promise<SessionStatus> {
    const record = await this.repo.findById(input.sessionId);
    if (!record) return 'removed';

    if (record.status === 'removed') return 'removed';

    const gateway = this.waFactory.get(record.provider);
    await gateway.logoutSession(input.sessionId);
    await this.repo.updateStatus(input.sessionId, 'removed');
    return 'removed';
  }
}
