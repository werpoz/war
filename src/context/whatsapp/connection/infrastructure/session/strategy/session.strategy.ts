import makeWASocket from 'baileys';

export type SocketWA = ReturnType<typeof makeWASocket>;
export type SessionBaileys = {
  socket: SocketWA;
  saveCreds: () => Promise<void>;
};

export interface SessionStrategy {
  execute(sessionId: string): Promise<SessionBaileys>;
}
