import { db } from "./db";

export async function audit(actor: { id: string; name: string } | null, action: string, target?: string, detail?: string) {
  await db.auditLog.create({
    data: { actorId: actor?.id, actorName: actor?.name ?? "System", action, target, detail },
  });
}
