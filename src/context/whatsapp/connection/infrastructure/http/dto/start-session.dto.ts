// infrastructure/http/dto/start-session.dto.ts
export interface StartSessionDto {
  sessionId: string;
  provider: string;
  storage: string;
  phone?: string;
}
