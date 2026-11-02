/**
 * Run work inside one database transaction.
 * It commits when the callback resolves and rolls back, leaving no partial data, when it throws.
 *
 * @template T
 * @param {import('@prisma/client').PrismaClient} prisma Prisma client.
 * @param {(tx: import('@prisma/client').Prisma.TransactionClient) => Promise<T>} work Callback receiving the transaction client.
 * @param {{ timeoutMs?: number }} [options] Transaction options.
 * @returns {Promise<T>} Value returned by the callback.
 */
export function withTransaction(prisma, work, { timeoutMs = 60_000 } = {}) {
  return prisma.$transaction(work, { timeout: timeoutMs, maxWait: 10_000 });
}
