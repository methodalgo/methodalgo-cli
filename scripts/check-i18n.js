import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const i18nPath = join(__dirname, '../src/utils/i18n.js');

try {
    const content = readFileSync(i18nPath, 'utf-8');
    
    // 粗略但有效的 key 提取方法
    const getKeys = (lang) => {
        const startMarker = `${lang}: {`;
        const startIndex = content.indexOf(startMarker);
        if (startIndex === -1) return [];
        
        let braceCount = 1;
        let pos = startIndex + startMarker.length;
        let block = "";
        
        while (braceCount > 0 && pos < content.length) {
            if (content[pos] === '{') braceCount++;
            if (content[pos] === '}') braceCount--;
            if (braceCount > 0) block += content[pos];
            pos++;
        }
        
        const keys = [];
        block.split('\n').forEach(line => {
            const match = line.match(/^\s*([A-Z0-9_]+):/);
            if (match) keys.push(match[1]);
        });
        return keys;
    };

    const enKeys = getKeys('en');
    const zhKeys = getKeys('zh');

    if (enKeys.length === 0 || zhKeys.length === 0) {
        console.error('❌ 提取词条失败');
        process.exit(1);
    }

    const missingInZh = enKeys.filter(k => !zhKeys.includes(k));
    const missingInEn = zhKeys.filter(k => !enKeys.includes(k));

    if (missingInZh.length === 0 && missingInEn.length === 0) {
        console.log(`✅ i18n 同步正常 (共 ${enKeys.length} 条)`);
    } else {
        if (missingInZh.length > 0) console.error('❌ zh 缺失:', missingInZh.join(', '));
        if (missingInEn.length > 0) console.error('❌ en 缺失:', missingInEn.join(', '));
        process.exit(1);
    }
} catch (err) {
    console.error(err);
    process.exit(1);
}
