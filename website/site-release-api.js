window.MdeSiteReleaseApi = ({ apiHeaders, releasesApiUrl, openVsxApiUrl, marketplaceApiUrl }) => {
const fetchJson = (url) =>
    fetch(url, { headers: apiHeaders }).then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json();
    });

  const fetchMarketplaceDownloadStats = async () => {
    // Try static pre-fetched JSON first (generated weekly by GHA, no CORS concerns)
    try {
      const res = await fetch("./marketplace-stats.json");
      if (res.ok) {
        const stats = await res.json();
        if (typeof stats["open-vsx"] === "number" && typeof stats["vscode-marketplace"] === "number") {
          return stats;
        }
      }
    } catch (_) {
      // fall through to live API
    }

    // Live fallback: VS Code Marketplace supports CORS (Access-Control-Allow-Origin: *)
    const [openVsxResponse, marketplaceResponse] = await Promise.all([
      fetch(openVsxApiUrl),
      fetch(marketplaceApiUrl, {
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
      }),
    ]);

    if (!openVsxResponse.ok) {
      throw new Error(`Open VSX returned ${openVsxResponse.status}`);
    }
    if (!marketplaceResponse.ok) {
      throw new Error(`Marketplace returned ${marketplaceResponse.status}`);
    }

    const openVsx = await openVsxResponse.json();
    const marketplace = await marketplaceResponse.json();
    const statistics =
      marketplace?.results?.[0]?.extensions?.[0]?.statistics || [];

    return {
      "open-vsx": Number(openVsx.downloadCount) || 0,
      "vscode-marketplace":
        Number(
          statistics.find(
            (entry) => entry.statisticName === "downloadCount",
          )?.value,
        ) || 0,
    };
  };

  const getNextPageUrl = (linkHeader) => {
    if (!linkHeader) return "";
    const nextLink = linkHeader
      .split(",")
      .find((link) => link.includes(`rel="next"`));
    const match = nextLink && nextLink.match(/<([^>]+)>/);
    return match ? match[1] : "";
  };

  const fetchReleasePages = (url = releasesApiUrl, releases = []) =>
    fetch(url, { headers: apiHeaders }).then((response) => {
      if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
      return response.json().then((page) => {
        const combined = releases.concat(Array.isArray(page) ? page : []);
        const nextUrl = getNextPageUrl(response.headers.get("Link"));
        return nextUrl ? fetchReleasePages(nextUrl, combined) : combined;
      });
    });

  return { fetchJson, fetchMarketplaceDownloadStats, fetchReleasePages };
};


