import { getPosts } from "../services/db";

export default async function sitemap() {
  const baseUrl = 'https://your-production-url.com';

  let posts = [];
  try {
    posts = await getPosts();
  } catch (error) {
    console.error("Failed fetching for sitemap", error);
  }

  const blogPages = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug || post.id}`,
    lastModified: post.createdAt?.toDate ? post.createdAt.toDate() : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...blogPages,
  ];
}
