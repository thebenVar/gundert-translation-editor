import type { Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: Session['user'] & {
      id: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
