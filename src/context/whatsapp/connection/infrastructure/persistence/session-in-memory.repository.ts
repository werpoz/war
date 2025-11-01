import {
  SessionRepository,
  type SessionSnapshot,
  type SessionStatus,
} from '../../domain/repository/session.repository';

export class SessionInMemoryRepository implements SessionRepository {
  private sessions = new Map<string, SessionSnapshot>();

  async save(meta: {
    id: string;
    provider: string;
    storage: string;
    ownerId?: string;
    status: SessionStatus;
  }): Promise<void> {
    const exists = this.sessions.get(meta.id);
    const now = new Date();
    const record: SessionSnapshot = {
      id: meta.id,
      provider: meta.provider,
      storage: meta.storage,
      ownerId: meta.ownerId ?? exists?.ownerId,
      status: meta.status,
      createdAt: exists?.createdAt ?? now,
      updatedAt: now,
    };
    this.sessions.set(meta.id, record);
    return Promise.resolve();
  }

  async findById(id: string): Promise<SessionSnapshot | null> {
    return Promise.resolve(this.sessions.get(id) ?? null);
  }

  async updateStatus(id: string, status: SessionStatus): Promise<void> {
    const exists = this.sessions.get(id);
    if (!exists) return;
    this.sessions.set(id, {
      ...exists,
      status,
      updatedAt: new Date(),
    });
    return Promise.resolve();
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
    return Promise.resolve();
  }

  async listByOwner(ownerId: string): Promise<SessionSnapshot[]> {
    return Promise.resolve(
      Array.from(this.sessions.values()).filter((s) => s.ownerId === ownerId),
    );
  }
}
