import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('[SEED] Starting seed process...');

    // Delete existing user if present (for re-seeding with bcrypt)
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com'),
    });

    if (existingUser) {
      console.log('[SEED] Deleting existing user for re-seed...');
      await db.delete(users).where(eq(users.email, 'demo@example.com'));
    }

    // Create demo user with hashed password
    console.log('[SEED] Creating user with hashed password...');
    const hashedPassword = await hash('Demo@2026!', 10);
    const newUser = await db
      .insert(users)
      .values({
        email: 'demo@example.com',
        name: 'Demo Translator',
        password: hashedPassword,
      })
      .returning();

    console.log('[SEED] User created:', newUser);

    return NextResponse.json({
      created: true,
      user: newUser[0],
    });
  } catch (error) {
    console.error('[SEED] Error:', error);
    return NextResponse.json(
      { 
        error: String(error),
        details: error instanceof Error ? error.message : '',
      },
      { status: 500 }
    );
  }
}
