import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WAConnectionModule } from './context/whatsapp/connection/conn.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), WAConnectionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
