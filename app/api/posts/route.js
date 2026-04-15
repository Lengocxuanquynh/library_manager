import { NextResponse } from 'next/server';
import { getPosts, addPost } from '../../services/db';

export async function GET() {
  try {
    const posts = await getPosts();
    return NextResponse.json(posts);
  } catch (error) {
    console.error('Error fetching posts API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, content, excerpt, slug, coverImage, author, tags } = body;

    if (!title || !content || !slug) {
      return NextResponse.json({ error: 'Missing title, content, or slug' }, { status: 400 });
    }

    const docRef = await addPost({
      title,
      content,
      excerpt: excerpt || '',
      slug,
      coverImage: coverImage || '',
      author: author || 'Admin',
      tags: tags || []
    });

    return NextResponse.json({ success: true, id: docRef.id }, { status: 201 });
  } catch (error) {
    console.error('Error creating post API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
