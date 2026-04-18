import { db } from './lib/db/index.js';
import { users } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

async function seed() {
  try {
    console.log('Seeding demo user...');
    
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'demo@example.com'),
    });

    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    const newUser = await db.insert(users).values({
      email: 'demo@example.com',
      display_name: 'Demo Translator',
      password_hash: 'password', // TODO: hash this with bcrypt
    }).returning();

    console.log('Demo user created:', newUser);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
