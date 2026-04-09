export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/user/'],
    },
    sitemap: 'https://your-production-url.com/sitemap.xml',
  }
}
