import { generate } from 'critical';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, '..', 'dist');

async function extractCriticalCSS() {
  try {
    console.log('🎨 Extraindo CSS crítico...');
    
    await generate({
      inline: true,
      base: distPath,
      src: 'index.html',
      target: {
        html: 'index.html',
      },
      width: 1920,
      height: 1080,
      extract: true,
      minify: true,
      penthouse: {
        timeout: 60000,
      },
    });

    console.log('✅ CSS crítico extraído e inline com sucesso!');
    console.log('📦 CSS não-crítico movido para carregamento assíncrono');
  } catch (error) {
    console.error('❌ Erro ao extrair CSS crítico:', error);
    process.exit(1);
  }
}

extractCriticalCSS();
