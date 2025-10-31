import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SessionController } from './infrastructure/http/controllers/sessions.controller';
import { FileAuthAdapter } from './infrastructure/providers/baileys/adapters/file-auth.adapter';
import { AuthStorageFactory } from './infrastructure/factory/auth-storage.factory';
import { BaileysSessionProvider } from './infrastructure/providers/baileys/baileys-session.provider';
import { SessionSocketListener } from './infrastructure/providers/baileys/session.socket.listener';
import { BaileysGateway } from './infrastructure/strategy/baileys.gateway';
import { WhatsappStrategyFactory } from './infrastructure/factory/wa-strategy.factory';
import { StartSessionUseCase } from './application/use-case/start-session.uc';
import { SessionInMemoryRepository } from './infrastructure/persistence/session-in-memory.repository';
import { SessionRepository } from './domain/repository/session.repository';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [SessionController],
  providers: [
    // Repository bindings
    { provide: 'SESSION_REPOSITORY', useClass: SessionInMemoryRepository },

    // Auth storage adapters + factory
    {
      provide: FileAuthAdapter,
      useFactory: () => new FileAuthAdapter('./storage'),
    },
    AuthStorageFactory,

    // Runtime state + listener
    BaileysSessionProvider,
    SessionSocketListener,

    // Strategy Providers
    {
      provide: 'WA_GATEWAY_BAILEYS',
      useFactory: (
        authFac: AuthStorageFactory,
        prov: BaileysSessionProvider,
        listener: SessionSocketListener,
      ) => new BaileysGateway(authFac, prov, listener),
      inject: [
        AuthStorageFactory,
        BaileysSessionProvider,
        SessionSocketListener,
      ],
    },

    // Strategy Factory
    WhatsappStrategyFactory,

    // Use Cases
    {
      provide: StartSessionUseCase,
      useFactory: (
        repo: SessionRepository,
        waFactory: WhatsappStrategyFactory,
      ) => new StartSessionUseCase(repo, waFactory),
      inject: ['SESSION_REPOSITORY', WhatsappStrategyFactory],
    },
  ],
  exports: [StartSessionUseCase],
})
export class WAConnectionModule {}
