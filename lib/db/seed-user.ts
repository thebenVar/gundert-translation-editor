import { db } from './index';
import { users } from './schema';
import { eq } from 'drizzle-orm';

async function seedUser() {
  try {
    console.log('Checking for demo user...');
    
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com'),
    });

    if (existingUser) {
      console.log('Demo user already exists:', existingUser);
      return;
    }

    console.log('Creating demo user...');
    const newUser = await db.insert(users).values({
      email: 'demo@example.com',
      display_name: 'Demo Translator',
      password_hash: 'password',
    }).returning();

    console.log('Demo user created:', newUser);
  } catch (error) {
    console.error('Seed failed:', error);
  }
}

seedUser();
