// Migrate all Supabase Storage files (bucket objects) from the OLD project to
// the NEW project. Buckets must already exist in the new project (they do if you
// restored the database dump, or ran setup.sql).
//
// Keys are read from environment variables so nothing secret is committed.
//
// Usage:
//   OLD_PROJECT_URL=https://OLDREF.supabase.co \
//   OLD_SERVICE_KEY=old-service-role-key \
//   NEW_PROJECT_URL=https://NEWREF.supabase.co \
//   NEW_SERVICE_KEY=new-service-role-key \
//   node scripts/migrate-storage.mjs
//
// Requires: npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js'

const OLD_PROJECT_URL = process.env.OLD_PROJECT_URL
const OLD_SERVICE_KEY = process.env.OLD_SERVICE_KEY
const NEW_PROJECT_URL = process.env.NEW_PROJECT_URL
const NEW_SERVICE_KEY = process.env.NEW_SERVICE_KEY

if (!OLD_PROJECT_URL || !OLD_SERVICE_KEY || !NEW_PROJECT_URL || !NEW_SERVICE_KEY) {
  console.error('Missing env vars. Set OLD_PROJECT_URL, OLD_SERVICE_KEY, NEW_PROJECT_URL, NEW_SERVICE_KEY.')
  process.exit(1)
}

const oldSupabase = createClient(OLD_PROJECT_URL, OLD_SERVICE_KEY)
const newSupabase = createClient(NEW_PROJECT_URL, NEW_SERVICE_KEY)

// Recursively list every file in a bucket (handles nested folders).
async function listAllFiles(bucket, path = '') {
  const { data, error } = await oldSupabase.storage.from(bucket).list(path, { limit: 1000 })
  if (error) throw new Error(`List failed in '${bucket}/${path}': ${error.message}`)
  if (!data || data.length === 0) return []

  let files = []
  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name
    if (!item.metadata) {
      // It's a folder — recurse.
      files = files.concat(await listAllFiles(bucket, fullPath))
    } else {
      files.push({ fullPath, metadata: item.metadata })
    }
  }
  return files
}

async function ensureBucket(bucket) {
  const { data: existing, error } = await newSupabase.storage.getBucket(bucket.name)
  if (error && !error.message.toLowerCase().includes('not found')) {
    throw new Error(`Checking bucket '${bucket.name}': ${error.message}`)
  }
  if (!existing) {
    const { error: createErr } = await newSupabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: bucket.file_size_limit ?? undefined,
      allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
    })
    if (createErr) throw new Error(`Creating bucket '${bucket.name}': ${createErr.message}`)
    console.log(`  created bucket '${bucket.name}'`)
  }
}

async function migrateFile(bucket, file) {
  const { data, error: dErr } = await oldSupabase.storage.from(bucket).download(file.fullPath)
  if (dErr) return { ok: false, path: file.fullPath, error: `download: ${dErr.message}` }

  const { error: uErr } = await newSupabase.storage.from(bucket).upload(file.fullPath, data, {
    upsert: true,
    contentType: file.metadata?.mimetype,
    cacheControl: file.metadata?.cacheControl,
  })
  if (uErr) return { ok: false, path: file.fullPath, error: `upload: ${uErr.message}` }
  return { ok: true, path: file.fullPath }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function main() {
  console.log(`Migrating storage:\n  from ${OLD_PROJECT_URL}\n  to   ${NEW_PROJECT_URL}\n`)

  const { data: buckets, error } = await oldSupabase.storage.listBuckets()
  if (error) throw new Error(`Listing buckets: ${error.message}`)
  console.log(`Found ${buckets.length} bucket(s).`)

  let total = 0, ok = 0
  const failures = []

  for (const bucket of buckets) {
    console.log(`\nBucket: ${bucket.name}`)
    await ensureBucket(bucket)
    const files = await listAllFiles(bucket.name)
    console.log(`  ${files.length} file(s)`)
    total += files.length

    for (const batch of chunk(files, 10)) {
      const results = await Promise.all(batch.map((f) => migrateFile(bucket.name, f)))
      for (const r of results) {
        if (r.ok) ok++
        else failures.push(r)
      }
    }
    console.log(`  done`)
  }

  console.log(`\nSummary: ${ok}/${total} files migrated.`)
  if (failures.length) {
    console.log('Failed:')
    failures.forEach((f) => console.log(`  - ${f.path}: ${f.error}`))
    process.exit(1)
  }
  console.log('All storage files migrated successfully.')
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
