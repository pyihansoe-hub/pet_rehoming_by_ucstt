# Setup
# Create Upload Folders

After cloning, run:
mkdir -p uploads/avatars uploads/blogs uploads/pets

# run in terminal for install packages
npm install

# Postgresql
window - psql -U postgres
Linux -sudo -u postgres psql

# Login to PostgreSQL (it will ask for password)
psql -U postgres

# Inside psql, create your database
CREATE DATABASE pet_rehoming;

# Exit psql
\q

# run sql schema
cd sql
node migrate.js

# create .env file
.env

+++++++

PORT=3000

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pet_rehoming
DB_USER=postgres
DB_PASSWORD=

# JWT
JWT_SECRET=your_super_secret_key_change_this_to_something_long
JWT_EXPIRES_IN=7d


QWEN_API_KEY=


# Frontend URL for CORS
CLIENT_URL=http://localhost:5500

# Admin seed — runs ONCE on first npm run dev, then locks
ADMIN_NAME= Admin
ADMIN_EMAIL=admin@gmail.com
ADMIN_PASSWORD=indoor67
+++++

# run project _ backend
npm run dev
# create new terminal _ frontend
cd frontend
npx serve . -l 5500