// infrastructure/factories/wa-strategy.factory.ts
import { Injectable, Inject } from '@nestjs/common';
import { WhatsappGateway } from '../../domain/services/whatsapp.gateway';

@Injectable()
export class WhatsappStrategyFactory {
  constructor(
    @Inject('WA_GATEWAY_BAILEYS') private readonly baileys: WhatsappGateway,
  ) {}

  get(provider: string): WhatsappGateway {
    switch (provider) {
      case 'baileys':
        return this.baileys;
      // case 'playwright': return this.pw;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}
