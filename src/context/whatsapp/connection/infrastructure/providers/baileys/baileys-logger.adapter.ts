import { Logger } from '@nestjs/common';
import { inspect } from 'util';
import type { ILogger } from '@whiskeysockets/baileys/lib/Utils/logger.js';

type NestLogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

type LoggerAdapterOptions = {
  metadata?: Record<string, unknown>;
  debug?: boolean;
  structured?: boolean;
};

export class BaileysLoggerAdapter implements ILogger {
  level: string;
  private readonly nest: Logger;
  private readonly metadata: Record<string, unknown>;
  private readonly debugEnabled: boolean;
  private readonly structured: boolean;

  constructor(
    private readonly context: string,
    options: LoggerAdapterOptions = {},
  ) {
    this.nest = new Logger(context);
    this.metadata = options.metadata ?? {};
    this.debugEnabled =
      options.debug ??
      (process.env.BAILEYS_DEBUG === 'true' ||
        process.env.BAILEYS_DEBUG === '1');
    this.structured = options.structured ?? process.env.LOG_FORMAT === 'json';
    this.level = this.debugEnabled ? 'trace' : 'info';
  }

  setLevel(level: string): void {
    this.level = level;
  }

  child(obj: Record<string, unknown>): ILogger {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions
    const ctx = obj?.class ? `${this.context}:${obj.class}` : this.context;
    return new BaileysLoggerAdapter(ctx, {
      metadata: { ...this.metadata, ...obj },
      debug: this.debugEnabled,
      structured: this.structured,
    });
  }

  trace(obj: unknown, msg?: string): void {
    if (!this.debugEnabled) return;
    if (this.level !== 'trace') return;
    this.logWithLevel('verbose', obj, msg ?? 'trace');
  }

  debug(obj: unknown, msg?: string): void {
    if (!this.debugEnabled) return;
    this.logWithLevel('debug', obj, msg ?? 'debug');
  }

  info(obj: unknown, msg?: string): void {
    this.logWithLevel('log', obj, msg ?? 'info');
  }

  warn(obj: unknown, msg?: string): void {
    this.logWithLevel('warn', obj, msg ?? 'warn');
  }

  error(obj: unknown, msg?: string): void {
    if (obj instanceof Error) {
      const message = msg ?? obj.message;
      this.nest.error(message, obj.stack);
      return;
    }
    this.logWithLevel('error', obj, msg ?? 'error');
  }

  private logWithLevel(level: NestLogLevel, obj: unknown, msg: string): void {
    if (!this.debugEnabled && (level === 'debug' || level === 'verbose')) {
      return;
    }

    const payload = this.structured
      ? this.asJSON(level, obj, msg)
      : this.composeMessage(level, obj, msg);

    switch (level) {
      case 'error':
        return this.nest.error(payload);
      case 'warn':
        return this.nest.warn(payload);
      case 'debug':
        return this.nest.debug(payload);
      case 'verbose':
        return this.nest.verbose(payload);
      default:
        return this.nest.log(payload);
    }
  }

  private sanitize(obj: unknown) {
    const s = typeof obj === 'string' ? obj : JSON.stringify(obj ?? '');
    return s
      .replace(/\d+@s\.whatsapp\.net/g, '[wa-user]')
      .replace(/"clientToken":"[^"]+"/g, '"clientToken":"[hidden]"')
      .replace(/"serverToken":"[^"]+"/g, '"serverToken":"[hidden]"')
      .replace(/"noiseKey":[^}]+}/g, '"noiseKey":"[hidden]"');
  }

  private asJSON(level: NestLogLevel, obj: unknown, msg: string) {
    return JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ctx: this.context,
      msg,
      data: this.sanitize(obj),
      meta: this.metadata,
    });
  }

  private composeMessage(
    level: NestLogLevel,
    obj: unknown,
    msg: string,
  ): string {
    const segments: string[] = [];
    segments.push(`${level.toUpperCase()}: ${msg}`);

    if (obj !== undefined && obj !== null) {
      try {
        segments.push(inspect(JSON.parse(this.sanitize(obj)), { depth: 4 }));
      } catch {
        segments.push(this.sanitize(obj));
      }
    }

    if (Object.keys(this.metadata).length) {
      segments.push(`meta=${inspect(this.metadata, { depth: 2 })}`);
    }

    return segments.join(' | ');
  }
}
