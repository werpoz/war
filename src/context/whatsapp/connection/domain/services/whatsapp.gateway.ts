export interface WhatsappGateway {
  startSession(
    sessionId: string,
    opts?: { phone?: string; storage?: string },
  ): Promise<string | undefined>;
  closeSession(sessionId: string): Promise<void>;
  logoutSession(sessionId: string): Promise<void>;
  sendMessage(sessionId: string, to: string, message: string): Promise<void>;
}
