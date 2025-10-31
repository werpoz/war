export interface SessionProvider {
  initialize(sessionId: string): Promise<void>;

  connect(sessionId: string): Promise<void>;

  disconnect(sessionId: string): Promise<void>;

  delete(sessionId: string): Promise<void>;

  getQRCode(sessionId: string): Promise<string>;

  getStatus(sessionId: string): Promise<string>;
}
