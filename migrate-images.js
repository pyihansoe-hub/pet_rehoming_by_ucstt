require('dotenv').config();
const fs = require('fs');
const path = require('path');
// const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BUCKET_NAME = 'uploads';
const LOCAL_UPLOADS_DIR = path.join(__dirname, 'uploads'); 
const subfolders = ['pets', 'blogs', 'avatars'];

// Helper function to get the correct MIME type
const getContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  // Default to jpeg for .jpg and .jpeg
  return 'image/jpeg';
};

async function migrateFiles() {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    console.log('No local uploads folder found. Nothing to migrate.');
    return;
  }

  for (const folder of subfolders) {
    const localFolderPath = path.join(LOCAL_UPLOADS_DIR, folder);
    
    if (!fs.existsSync(localFolderPath)) {
      console.log(`Subfolder ${folder} not found locally, skipping...`);
      continue;
    }

    const files = fs.readdirSync(localFolderPath);
    console.log(`Found ${files.length} files in ${folder}...`);

    for (const file of files) {
      const localFilePath = path.join(localFolderPath, file);
      if (fs.statSync(localFilePath).isDirectory()) continue;

      const fileBuffer = fs.readFileSync(localFilePath);
      const supabaseFilePath = `${folder}/${file}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(supabaseFilePath, fileBuffer, {
          contentType: getContentType(file), // Pass the correct MIME type here!
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error(`Failed to migrate ${supabaseFilePath}:`, error.message);
      } else {
        console.log(` Successfully migrated ${supabaseFilePath}`);
      }
    }
  }
  console.log('\n=== Image Migration Complete! ===');
}

migrateFiles();