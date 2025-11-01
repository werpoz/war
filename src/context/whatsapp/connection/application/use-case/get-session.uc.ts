import {
  SessionRepository,
  type SessionSnapshot,
} from '../../domain/repository/session.repository';

export class GetSessionUseCase {
  constructor(private readonly repo: SessionRepository) {}

  async execute(input: { sessionId: string }): Promise<SessionSnapshot | null> {
    return this.repo.findById(input.sessionId);
  }
}
