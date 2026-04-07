import { pgPool } from "./db";

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      replied_at TIMESTAMPTZ,
      replied_by TEXT
    );
  `);
  tableReady = true;
}

export type SupportTicket = {
  id: number;
  email: string;
  name: string;
  subject: string;
  message: string;
  ip: string;
  created_at: string;
  replied_at: string | null;
  replied_by: string | null;
};

export async function insertSupportTicket(ticket: {
  email: string;
  name: string;
  subject: string;
  message: string;
  ip: string;
}): Promise<number> {
  await ensureTable();
  const result = await pgPool.query<{ id: number }>(
    `INSERT INTO support_tickets (email, name, subject, message, ip)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [ticket.email, ticket.name, ticket.subject, ticket.message, ticket.ip],
  );
  return result.rows[0]!.id;
}

export async function getSupportTickets(): Promise<SupportTicket[]> {
  await ensureTable();
  const result = await pgPool.query<SupportTicket>(
    `SELECT id, email, name, subject, message, ip,
            created_at::text as created_at,
            replied_at::text as replied_at,
            replied_by
     FROM support_tickets
     ORDER BY created_at DESC
     LIMIT 200`,
  );
  return result.rows ?? [];
}

export async function markTicketReplied(id: number, repliedBy: string): Promise<void> {
  await ensureTable();
  await pgPool.query(
    `UPDATE support_tickets SET replied_at = NOW(), replied_by = $1 WHERE id = $2`,
    [repliedBy, id],
  );
}
