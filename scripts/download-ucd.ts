import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const UNICODE_VERSION = '16.0.0';
const BASE_URL = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd`;
const MAPPINGS_BASE_URL = 'https://www.unicode.org/Public/MAPPINGS';
const CLDR_ANNOTATIONS_URL = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json';
const OUTPUT_DIR = './data/ucd';

const FILES_TO_DOWNLOAD = [
  'UnicodeData.txt',
  'NameAliases.txt',
  'Blocks.txt',
  'Scripts.txt',
  'PropertyValueAliases.txt',
  'EastAsianWidth.txt',
  'emoji/emoji-data.txt',
];

// マッピングファイル (Unicode公式)
const MAPPING_FILES = [
  { url: `${MAPPINGS_BASE_URL}/OBSOLETE/EASTASIA/JIS/JIS0208.TXT`, output: 'mappings/JIS0208.TXT' },
  { url: `${MAPPINGS_BASE_URL}/VENDORS/MICSFT/WINDOWS/CP932.TXT`, output: 'mappings/CP932.TXT' },
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

  // Download mapping files (JIS X 0208, CP932)
  console.log('\nDownloading mapping files...');
  const mappingsDir = join(OUTPUT_DIR, 'mappings');
  if (!existsSync(mappingsDir)) {
    await mkdir(mappingsDir, { recursive: true });
  }

  for (const mapping of MAPPING_FILES) {
    console.log(`Downloading ${mapping.output}...`);
    const response = await fetch(mapping.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${mapping.url}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    await writeFile(join(OUTPUT_DIR, mapping.output), text, 'utf-8');
    console.log(`  Saved to ${join(OUTPUT_DIR, mapping.output)} (${text.length} bytes)`);
  }

  // Download and extract Unihan.zip
  console.log('\nDownloading Unihan.zip...');
  const unihanUrl = `${BASE_URL}/Unihan.zip`;
  const unihanZipPath = join(OUTPUT_DIR, 'Unihan.zip');
  const unihanDir = join(OUTPUT_DIR, 'Unihan');

  const unihanResponse = await fetch(unihanUrl);
  if (!unihanResponse.ok) {
    throw new Error(`Failed to download Unihan.zip: ${unihanResponse.status} ${unihanResponse.statusText}`);
  }

  const unihanBuffer = Buffer.from(await unihanResponse.arrayBuffer());
  await writeFile(unihanZipPath, unihanBuffer);
  console.log(`  Saved Unihan.zip (${unihanBuffer.length} bytes)`);

  // Extract
  if (!existsSync(unihanDir)) {
    await mkdir(unihanDir, { recursive: true });
  }
  execSync(`unzip -o "${unihanZipPath}" -d "${unihanDir}"`);
  console.log(`  Extracted to ${unihanDir}`);

  // Download CLDR annotations
  console.log('\nDownloading CLDR annotations...');
  const cldrDir = join(OUTPUT_DIR, 'cldr');
  if (!existsSync(cldrDir)) {
    await mkdir(cldrDir, { recursive: true });
  }

  const cldrResponse = await fetch(CLDR_ANNOTATIONS_URL);
  if (!cldrResponse.ok) {
    throw new Error(`Failed to download CLDR annotations: ${cldrResponse.status} ${cldrResponse.statusText}`);
  }
  const cldrText = await cldrResponse.text();
  const cldrPath = join(cldrDir, 'annotations-en.json');
  await writeFile(cldrPath, cldrText, 'utf-8');
  console.log(`  Saved to ${cldrPath} (${cldrText.length} bytes)`);

  console.log('\nAll files downloaded successfully!');
}

main();
