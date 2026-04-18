import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if demo user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com'),
    });

    if (existingUser) {
      // Update the password to a new one
      await db
        .update(users)
        .set({ password_hash: 'Demo@2026!' })
        .where(eq(users.email, 'demo@example.com'));

      return NextResponse.json({
        success: true,
        message: 'Demo user password updated',
        credentials: {
          email: 'demo@example.com',
          password: 'Demo@2026!',
        },
      });
    }

    // Create demo user
    const newUser = await db
      .insert(users)
      .values({
        email: 'demo@example.com',
        display_name: 'Demo Translator',
        password_hash: 'Demo@2026!',
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Demo user created',
      user: newUser[0],
      credentials: {
        email: 'demo@example.com',
        password: 'Demo@2026!',
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
