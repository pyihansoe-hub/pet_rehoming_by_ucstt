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

nividia model-  z-ai/glm-5.2  mistralai/mistral-medium-3.5-128b

1. Groq

Extremely fast, great free tier (but strict token limits per minute).

     API URL: https://api.groq.com/openai/v1/chat/completions
     Header: 'Authorization': 'Bearer ${process.env.GROQ_API_KEY}'
     Recommended Model (Burmese): llama-3.3-70b-versatile
     Get Key: https://console.groq.com/keys

2. OpenRouter

Aggregator, hosts almost all models. 200 free requests/day.

     API URL: https://openrouter.ai/api/v1/chat/completions
     Header: 'Authorization': 'Bearer ${process.env.OPENROUTER_API_KEY}'
     Extra Headers required: 'HTTP-Referer': 'http://localhost:3000', 'X-Title': 'PawBot'
     Recommended Model (Burmese): qwen/qwen-2.5-72b-instruct:free
     Get Key: https://openrouter.ai/keys

3. Qwen (Alibaba Cloud DashScope)

Official home of Qwen. The absolute best at Burmese. Gives free credits to new users.

     API URL: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
     Header: 'Authorization': 'Bearer ${process.env.DASHSCOPE_API_KEY}'
     Recommended Model (Burmese): qwen-plus (or qwen-turbo for speed)
     Get Key: https://dashscope.console.aliyun.com/apiKey

nividia
const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

export NODE_OPTIONS="--dns-result-order=ipv4first"
lt --port 3000
lt --port 3000 --subdomain mypetapp
http://localhost:3000
fuser -k 3000/tcp
while true; do lt --port 3000 --subdomain ucstt-pet-mm && break; sleep 2; done
pm2 start src/server.js --name petapp

pyihansoe@debian:~$ sudo ufw allow ssh
Rules updated
Rules updated (v6)
pyihansoe@debian:~$ sudo ufw allow from 192.168.100.49/24 to any port 3000
WARN: Rule changed after normalization
Rules updated
pyihansoe@debian:~$ sudo ufw enable
Firewall is active and enabled on system startup
pyihansoe@debian:~$ sudo ufw status
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere                  
3000                       ALLOW       192.168.100.0/24          
22/tcp (v6)                ALLOW       Anywhere (v6)             

pyihansoe@debian:~$ sudo ufw disable
Firewall stopped and disabled on system startup
pyihansoe@debian:~$ sudo ufw delete allow from 192.168.100.0/24 to any port 3000
Rules updated
