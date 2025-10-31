export class Session {
  id: string;
  provider: string;
  status: string;
  phoneNumber: string;
  createdAt: Date;
  updatedAt: Date;

  static create(args: Partial<Session>): Session {
    const session = new Session();
    session.id = args.id || '';
    session.status = args.status || 'disconnected';
    session.createdAt = new Date();
    session.updatedAt = new Date();
    session.phoneNumber = args.phoneNumber || '';
    return session;
  }
}
