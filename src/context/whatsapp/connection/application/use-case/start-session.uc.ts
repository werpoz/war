import { SessionRepository } from '../../domain/repository/session.repository';
import { WhatsappStrategyFactory } from '../../infrastructure/factory/wa-strategy.factory';

export class StartSessionUseCase {
  constructor(
    private readonly repo: SessionRepository,
    private readonly waFactory: WhatsappStrategyFactory,
  ) {}

  async execute(input: {
    sessionId: string;
    provider: string;
    storage: string;
    phone?: string;
  }): Promise<{ qr?: string }> {
    const gateway = this.waFactory.get(input.provider); // ← elige Strategy
    const qr = await gateway.startSession(input.sessionId, {
      phone: input.phone,
      storage: input.storage,
    });

    await this.repo.save({
      id: input.sessionId,
      provider: input.provider,
    });
    return { qr };
  }
}
