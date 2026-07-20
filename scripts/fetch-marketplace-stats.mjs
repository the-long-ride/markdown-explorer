import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openVsxApiUrl = "https://open-vsx.org/api/the-long-ride/vscode-extension-markdown-explorer";
const marketplaceApiUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery";

async function fetchStats() {
  let openVsxCount = 0;
  let vscodeCount = 0;

  // Fetch Open VSX
  try {
    const res = await fetch(openVsxApiUrl);
    if (!res.ok) throw new Error(`Open VSX returned ${res.status}`);
    const data = await res.json();
    openVsxCount = Number(data.downloadCount) || 0;
    console.log(`Open VSX downloads: ${openVsxCount}`);
  } catch (err) {
    console.error("Error fetching Open VSX stats:", err.message);
    process.exit(1);
  }

  // Fetch VS Code Marketplace
  try {
    const res = await fetch(marketplaceApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json;api-version=7.2-preview.1;excludeUrls=true",
      },
      body: JSON.stringify({
        filters: [
          {
            criteria: [
              {
                filterType: 7,
                value: "the-long-ride.vscode-extension-markdown-explorer",
              },
            ],
          },
        ],
        flags: 914,
      }),
    });
    if (!res.ok) throw new Error(`VS Code Marketplace returned ${res.status}`);
    const data = await res.json();
    const statistics = data?.results?.[0]?.extensions?.[0]?.statistics || [];
    vscodeCount = Number(statistics.find((e) => e.statisticName === "downloadCount")?.value) || 0;
    console.log(`VS Code Marketplace downloads: ${vscodeCount}`);
  } catch (err) {
    console.error("Error fetching VS Code Marketplace stats:", err.message);
    process.exit(1);
  }

  const stats = { "open-vsx": openVsxCount, "vscode-marketplace": vscodeCount };
  const destPath = path.resolve(__dirname, '../website/marketplace-stats.json');
  fs.writeFileSync(destPath, JSON.stringify(stats, null, 2) + '\n');
  console.log(`Wrote stats to ${destPath}`);
  console.log(JSON.stringify(stats, null, 2));
}

fetchStats();
