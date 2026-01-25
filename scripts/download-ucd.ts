import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

const UNICODE_VERSION = '16.0.0';
const BASE_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;
const OUTPUT_DIR = './data/ucd';

const FILES_TO_DOWNLOAD = [
  'UnicodeData.txt',
  'NameAliases.txt',
  'Blocks.txt',
  'Scripts.txt',
  'PropertyValueAliases.txt',
  'emoji/emoji-data.txt',
];

async function downloadFile(filename: string): Promise<void> {
  const url = `${BASE_URL}/${filename}`;
  const outputPath = join(OUTPUT_DIR, filename);
  const outputDirPath = join(OUTPUT_DIR, filename.includes('/') ? filename.split('/')[0] : '');

  // Create directory if needed
  if (filename.includes('/') && !existsSync(outputDirPath)) {
    await mkdir(outputDirPath, { recursive: true });
  }

  console.log(`Downloading ${filename}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${filename}: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  await writeFile(outputPath, text, 'utf-8');
  console.log(`  Saved to ${outputPath} (${text.length} bytes)`);
}

async function main() {
  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Downloading UCD files (Unicode ${UNICODE_VERSION})...\n`);

  for (const file of FILES_TO_DOWNLOAD) {
    try {
      await downloadFile(file);
    } catch (error) {
      console.error(`Error downloading ${file}:`, error);
      process.exit(1);
    }
  }

  console.log('\nAll files downloaded successfully!');
}

main();
