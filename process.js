const axios = require('axios');
const fs = require('fs');

const M3U_URL = process.env.M3U_URL;
if (!M3U_URL) {
  console.error('M3U_URL environment variable is not set');
  process.exit(1);
}

// 模拟 VLC 的 User-Agent
const VLC_USER_AGENT = 'VLC/3.0.18 LibVLC/3.0.18';

// 延迟函数（毫秒）
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 解析 M3U 内容，返回频道列表 [{ name, url }]
function parseM3U(content) {
  const lines = content.split(/\r?\n/);
  const channels = [];
  let currentName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#EXTINF:')) {
      // 提取频道名称（最后一个逗号之后）
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentName = line.substring(commaIndex + 1).trim();
      } else {
        currentName = '';
      }
    } else if (line && !line.startsWith('#') && currentName !== null) {
      // 这是 URL 行
      channels.push({ name: currentName, url: line });
      currentName = null; // 重置
    }
  }
  return channels;
}

// 生成新的 M3U 内容
function generateM3U(channels) {
  let output = '#EXTM3U\n';
  for (const ch of channels) {
    output += `#EXTINF:-1,${ch.name}\n`;
    output += `${ch.url}\n`;
  }
  return output;
}

async function main() {
  console.log('Downloading original M3U...');
  const response = await axios.get(M3U_URL, {
    headers: { 'User-Agent': VLC_USER_AGENT },
    timeout: 10000
  });
  const originalContent = response.data;

  const channels = parseM3U(originalContent);
  console.log(`Found ${channels.length} channels.`);

  // 模拟逐个请求频道（间隔 1 秒）
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    try {
      console.log(`[${i+1}/${channels.length}] Checking ${ch.name} (${ch.url})`);
      // 只发送 HEAD 请求检查可用性，避免下载大量数据
      await axios.head(ch.url, {
        headers: { 'User-Agent': VLC_USER_AGENT },
        timeout: 5000
      });
      console.log(`  -> OK`);
    } catch (err) {
      console.log(`  -> Failed: ${err.message}`);
      // 即使请求失败也保留频道，不删除
    }
    if (i < channels.length - 1) await delay(1000); // 间隔 1 秒
  }

  // 排序：包含 MCP 的排在最前面（不区分大小写）
  const mcpChannels = channels.filter(ch => ch.name.toLowerCase().includes('mcp') || ch.url.toLowerCase().includes('mcp'));
  const otherChannels = channels.filter(ch => !(ch.name.toLowerCase().includes('mcp') || ch.url.toLowerCase().includes('mcp')));
  const sortedChannels = [...mcpChannels, ...otherChannels];

  // 生成新的 M3U 内容
  const newContent = generateM3U(sortedChannels);

  // 写入文件
  fs.writeFileSync('tv.m3u', newContent, 'utf8');
  console.log('tv.m3u generated successfully.');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
