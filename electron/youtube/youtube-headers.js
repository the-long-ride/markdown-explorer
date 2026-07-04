const YOUTUBE_EMBED_REFERRER = "https://the-long-ride.github.io/markdown-explorer/";

function configureYouTubeEmbedHeaders(session) {
  const filter = {
    urls: [
      "https://www.youtube.com/*",
      "https://www.youtube-nocookie.com/*",
    ],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      const hasReferer = Object.keys(requestHeaders).some(
        (name) => name.toLowerCase() === "referer",
      );

      if (!hasReferer) {
        requestHeaders.Referer = YOUTUBE_EMBED_REFERRER;
      }

      callback({ requestHeaders });
    },
  );
}

module.exports = { configureYouTubeEmbedHeaders };
