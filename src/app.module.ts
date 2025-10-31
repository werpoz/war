import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WAConnectionModule } from './context/whatsapp/connection/conn.module';

@Module({
  imports: [WAConnectionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
