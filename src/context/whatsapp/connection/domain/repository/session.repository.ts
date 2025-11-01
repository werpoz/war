export type SessionStatus = 'starting' | 'ready' | 'closed' | 'removed';

export type SessionSnapshot = {
  id: string;
  provider: string;
  storage: string;
  ownerId?: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
};

export interface SessionRepository {
  save(meta: {
    id: string;
    provider: string;
    storage: string;
    ownerId?: string;
    status: SessionStatus;
  }): Promise<void>;
  findById(id: string): Promise<SessionSnapshot | null>;
  updateStatus(id: string, status: SessionStatus): Promise<void>;
  delete(id: string): Promise<void>;
}
