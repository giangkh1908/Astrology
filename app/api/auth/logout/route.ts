import { handleLogout } from '@/lib/auth/handlers';
import { SESSION_COOKIE } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleLogout(request, SESSION_COOKIE);
}
