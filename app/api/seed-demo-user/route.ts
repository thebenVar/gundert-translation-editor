import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    console.log('[SEED] Starting seed process...');

    // Check if demo user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com'),
    });

    console.log('[SEED] Existing user:', existingUser);

    if (existingUser) {
      return NextResponse.json({
        exists: true,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
        },
      });
    }

    // Create demo user if it doesn't exist
    console.log('[SEED] Creating user...');
    const newUser = await db
      .insert(users)
      .values({
        email: 'demo@example.com',
        name: 'Demo Translator',
        password: 'Demo@2026!',
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
