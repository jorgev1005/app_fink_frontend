import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4002';

const options = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        // If explicit dev creds configured, prefer them (convenience)
        const devUser = process.env.DEV_AUTH_USERNAME;
        const devPass = process.env.DEV_AUTH_PASSWORD;
        if (devUser && devPass) {
          if (credentials?.username === devUser && credentials?.password === devPass) {
            return { id: '1', name: devUser, email: `${devUser}@local`, accessToken: 'dev-token' };
          }
          return null;
        }

        // Otherwise call the backend login endpoint
        try {
          const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: credentials?.username, password: credentials?.password })
          });
          const j = await res.json();
          if (!j || !j.success) return null;
          const user = j.data?.user;
          const token = j.data?.token;
          if (!user) return null;
          return { id: user.id, name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email, email: user.email, role: user.role, accessToken: token };
        } catch (err) {
          return null;
        }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret',
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }: any) {
      // On sign in, persist accessToken from authorize() into the JWT
      if (user) {
        if (user.accessToken) token.accessToken = user.accessToken;
        if (user.role) token.role = user.role;
        if (user.id) token.sub = String(user.id);
      }
      return token;
    },
    async session({ session, token }: any) {
      // Expose accessToken and role to the client session
      session.user = session.user || {};
      session.user.id = token.sub;
      if (token.accessToken) session.accessToken = token.accessToken;
      if (token.role) session.user.role = token.role;
      return session;
    }
  }
};

const handler = NextAuth(options as any);
export { handler as GET, handler as POST };
