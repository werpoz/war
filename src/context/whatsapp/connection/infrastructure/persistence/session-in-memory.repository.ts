import { SessionRepository } from '../../domain/repository/session.repository';

type SessionRecord = {
  id: string;
  provider: string;
  ownerId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export class SessionInMemoryRepository implements SessionRepository {
  private sessions = new Map<string, SessionRecord>();

  async save(meta: {
    id: string;
    provider: string;
    storage: string;
    ownerId?: string;
  }): Promise<void> {
    const exists = this.sessions.get(meta.id);

    const record: SessionRecord = {
      id: meta.id,
      provider: meta.provider,
      ownerId: meta.ownerId,
      createdAt: exists?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(meta.id, record);
    return Promise.resolve();
  }

  async findById(id: string): Promise<SessionRecord | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
    return Promise.resolve();
  }

  async listByOwner(ownerId: string): Promise<SessionRecord[]> {
    const sr: SessionRecord[] = Array.from(this.sessions.values()).filter(
      (s) => s.ownerId === ownerId,
    );
    return Promise.resolve(sr);
  }
}
