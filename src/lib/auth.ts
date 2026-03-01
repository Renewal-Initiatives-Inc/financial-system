import NextAuth from 'next-auth'
import type { NextAuthConfig, Session } from 'next-auth'
import 'next-auth/jwt'

interface ZitadelRoles {
  [key: string]: {
    [orgId: string]: string
  }
}

export type AppRole = 'user' | 'admin'

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole
    sub?: string
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      role: AppRole
    }
  }
}

function hasAppAccess(roles: ZitadelRoles | undefined): boolean {
  if (!roles) return false
  return !!roles['admin'] || !!roles['app:finance']
}

function extractRole(roles: ZitadelRoles | undefined): AppRole {
  if (!roles) return 'user'

  if (roles['admin']) {
    return 'admin'
  }

  const appRoles = roles['app:finance']
  if (appRoles) {
    const hasAdmin = Object.values(appRoles).some((role) => role === 'admin')
    if (hasAdmin) return 'admin'
  }

  return 'user'
}

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: 'zitadel',
      name: 'Zitadel',
      type: 'oidc',
      issuer: process.env.AUTH_ZITADEL_ISSUER,
      clientId: process.env.AUTH_ZITADEL_CLIENT_ID,
      client: {
        token_endpoint_auth_method: 'none',
      },
      checks: ['pkce', 'state'],
      authorization: {
        params: {
          scope: `openid email profile urn:zitadel:iam:org:projects:roles urn:zitadel:iam:org:project:id:${process.env.AUTH_ZITADEL_PROJECT_ID}:aud`,
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  callbacks: {
    async signIn({ profile }) {
      const roles =
        (profile?.['urn:zitadel:iam:org:project:roles'] as ZitadelRoles) ||
        (profile?.['roles'] as ZitadelRoles)
      if (!hasAppAccess(roles)) {
        return false
      }
      return true
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = profile.sub as string

        const roles =
          (profile['urn:zitadel:iam:org:project:roles'] as ZitadelRoles) ||
          (profile['roles'] as ZitadelRoles)
        token.role = extractRole(roles)
      }

      return token
    },
    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub || '',
          role: token.role || 'user',
        },
      }
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = request.nextUrl.pathname.startsWith('/login')
      const isOnAuthApi = request.nextUrl.pathname.startsWith('/api/auth')

      if (isOnAuthApi) {
        return true
      }

      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL('/', request.nextUrl))
      }

      if (isOnLogin) {
        return true
      }

      return isLoggedIn
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  trustHost: true,
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

/**
 * Get the authenticated user's ID from the session.
 * For use in server actions and API routes.
 */
export async function getUserId(): Promise<string> {
  const session = await auth()
  return session?.user?.id ?? 'system'
}
