module.exports = {
  pwa: {
    iconPaths: {
      favicon32: 'favicon/favicon-32x32.png',
      favicon16: 'favicon/favicon-16x16.png',
      appleTouchIcon: 'favicon/apple-touch-icon-152x152.png',
      maskIcon: null,
      msTileImage: null
    },
    manifestOptions: {
      icons: [
        {
          src: "favicon/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "favicon/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ]
    }
  }
}