export class StartSessionDto {
  sessionId!: string;
  provider!: 'baileys' | 'wppconnect' | 'playwright';
  storage!: 'file' | 'redis' | 'postgres';
  phone?: string;
}
