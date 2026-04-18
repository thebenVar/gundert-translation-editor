// Load environment variables
require('dotenv').config({ path: '.env.local' })

// Set NODE_ENV to test for migrations
process.env.NODE_ENV = 'test'
