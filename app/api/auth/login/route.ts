import { handleLogin } from '@/lib/auth/handlers';
import { readAuthConfig, SESSION_COOKIE } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleLogin(request, readAuthConfig(), SESSION_COOKIE);
}
