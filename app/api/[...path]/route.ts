import { handle } from '@/lib/api';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
async function handler(req: Request, context: { params: Promise<{ path: string[] }> }) {
  return handle(req, (await context.params).path);
}
export { handler as GET, handler as POST, handler as DELETE };
