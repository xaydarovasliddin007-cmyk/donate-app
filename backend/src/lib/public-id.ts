import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

// No 0/O/1/I/L — avoids visual ambiguity when a support agent or the user
// reads this ID aloud/copies it by hand.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ID_LENGTH = 8;

function generatePublicIdCandidate(): string {
  const bytes = randomBytes(ID_LENGTH);
  let suffix = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    suffix += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return `UZD-${suffix}`;
}

/**
 * The permanent, user-facing UZDONATE ID ("UZD-XXXXXXXX") — never the DB
 * primary key, never changes once assigned. Collision odds are astronomically
 * low (32^8 combinations) but this still verifies uniqueness against the DB
 * rather than trusting probability alone.
 */
export async function generateUniquePublicId(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generatePublicIdCandidate();
    const existing = await prisma.user.findUnique({
      where: { publicId: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error('Failed to generate a unique public ID after multiple attempts');
}
