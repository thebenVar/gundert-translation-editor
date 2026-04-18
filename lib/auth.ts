import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('[AUTH] Authorize called with credentials:', {
          email: credentials?.email,
          hasPassword: !!credentials?.password,
        });

        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing email or password');
          return null;
        }

        try {
          const user = await db.query.users.findFirst({
            where: eq(users.email, credentials.email as string),
          });

          console.log('[AUTH] User query result:', { found: !!user, email: user?.email });

          if (!user) {
            console.log('[AUTH] User not found for email:', credentials.email);
            return null;
          }

          // TODO: implement password hashing/verification with bcrypt
          // For demo: accept the demo password
          const passwordMatch = credentials.password === 'Demo@2026!';
          console.log('[AUTH] Password match:', passwordMatch);

          if (!passwordMatch) {
            console.log('[AUTH] Invalid password for email:', credentials.email);
            return null;
          }

          console.log('[AUTH] Authorization successful for:', credentials.email);
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? user.email,
          };
        } catch (error) {
          console.error('[AUTH] Authorization error:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.AUTH_SECRET || 'dev-secret-do-not-use-in-production',
  trustHost: true,
});

