import { handleLogout } from '@/lib/auth/handlers';
import { ADMIN_COOKIE } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleLogout(request, ADMIN_COOKIE);
}
