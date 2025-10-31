export interface SessionRepository {
  save(meta: { id: string; provider: string; ownerId?: string }): Promise<void>;
  findById(id: string): Promise<{ id: string; provider: string } | null>;
  delete(id: string): Promise<void>;
}
