import { NextResponse } from 'next/server';
import { getUsers } from '../../../../services/db';

export async function GET() {
  try {
    const users = await getUsers();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users for admin:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
