import { db } from './lib/db/index.js';
import { users } from './lib/db/schema.js';

async function seed() {
  try {
    console.log('Seeding demo user...');
    
    const existingUser = await db.query.users.findFirst({
      where: (u) => u.email.eq('demo@example.com'),
    });

    if (existingUser) {
      console.log('Demo user already exists');
      return;
    }

    const newUser = await db.insert(users).values({
      email: 'demo@example.com',
      name: 'Demo Translator',
      password: 'password', // TODO: hash this with bcrypt
    }).returning();

    console.log('Demo user created:', newUser);
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
