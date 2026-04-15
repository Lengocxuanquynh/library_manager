import { NextResponse } from 'next/server';
import { addMember, getMembers, getBorrowRecords } from '../../../services/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    const members = await getMembers();

    // Helper to add borrowCount to member objects
    const addBorrowCount = async (memberList) => {
      return await Promise.all(memberList.map(async (m) => {
        const records = await getBorrowRecords(m.id);
        const activeCount = records.filter(r => r.status === 'BORROWING' || r.status === 'OVERDUE').length;
        return { ...m, borrowCount: activeCount };
      }));
    };

    if (phone) {
      const filtered = members.filter(m => m.phone === phone);
      const enriched = await addBorrowCount(filtered);
      return NextResponse.json(enriched);
    }

    const enrichedAll = await addBorrowCount(members);
    return NextResponse.json(enrichedAll);
  } catch (error) {
    console.error('Error listing members API:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Họ tên và email là bắt buộc' },
        { status: 400 }
      );
    }

    const docRef = await addMember({
      name,
      email,
      phone: phone || ''
    });

    return NextResponse.json({
      success: true,
      message: 'Thêm hội viên thành công',
      id: docRef.id
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding member API:', error);
    return NextResponse.json(
      { error: 'Lỗi hệ thống khi thêm hội viên' },
      { status: 500 }
    );
  }
}
