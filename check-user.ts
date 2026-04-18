import { config } from 'dotenv';
config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './lib/db/schema';
import { eq } from 'drizzle-orm';

const sql = neon(process.env.POSTGRES_URL!);
const db = drizzle(sql, { schema });

async function checkUser() {
  try {
    console.log('Checking for demo user...');
    
    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, 'demo@example.com'),
    });

    if (user) {
      console.log('User found:', {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
      });
    } else {
      console.log('User not found');
      console.log('Creating demo user...');
      
      const newUser = await db.insert(schema.users).values({
        email: 'demo@example.com',
        display_name: 'Demo Translator',
        password_hash: 'Demo@2026!', // Store the password for testing
      }).returning();

      console.log('Demo user created:', newUser);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUser();
