import { Body, Controller, Post } from '@nestjs/common';
import { StartSessionUseCase } from '../../../application/use-case/start-session.uc';
import { StartSessionDto } from '../dto/start-session.dto';

@Controller('sessions')
export class SessionController {
  constructor(private readonly startSessionUC: StartSessionUseCase) {}

  @Post('start')
  async start(@Body() dto: StartSessionDto) {
    const { qr } = await this.startSessionUC.execute(dto);
    return { status: 'starting', sessionId: dto.sessionId, qr };
  }
}
