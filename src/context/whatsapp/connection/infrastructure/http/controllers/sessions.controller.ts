import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { StartSessionUseCase } from '../../../application/use-case/start-session.uc';
import { CloseSessionUseCase } from '../../../application/use-case/close-session.uc';
import { RemoveSessionUseCase } from '../../../application/use-case/remove-session.uc';
import { GetSessionUseCase } from '../../../application/use-case/get-session.uc';
import { UpsertSessionDto } from '../dto/upsert-session.dto';

@Controller('sessions')
export class SessionController {
  constructor(
    private readonly startSessionUC: StartSessionUseCase,
    private readonly closeSessionUC: CloseSessionUseCase,
    private readonly removeSessionUC: RemoveSessionUseCase,
    private readonly getSessionUC: GetSessionUseCase,
  ) {}

  @Get(':sessionId')
  async get(@Param('sessionId') sessionId: string) {
    const snapshot = await this.getSessionUC.execute({ sessionId });
    if (!snapshot)
      throw new NotFoundException(`Session ${sessionId} not found`);
    return snapshot;
  }

  @Put(':sessionId')
  async upsert(
    @Param('sessionId') sessionId: string,
    @Body() dto?: UpsertSessionDto,
  ) {
    const { qr, status } = await this.startSessionUC.execute({
      sessionId,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      provider: dto?.provider,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      storage: dto?.storage,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      phone: dto?.phone,
    });
    return { sessionId, status, qr };
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.OK)
  async close(@Param('sessionId') sessionId: string) {
    const status = await this.closeSessionUC.execute({ sessionId });
    return { sessionId, status };
  }

  @Delete(':sessionId/storage')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('sessionId') sessionId: string) {
    const status = await this.removeSessionUC.execute({ sessionId });
    return { sessionId, status };
  }
}
