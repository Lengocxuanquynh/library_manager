import { NextResponse } from 'next/server';
import { addMember, getMembers, getBorrowRecords, getUsers, checkMemberDuplicate } from '../../../services/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    // Lấy độc giả từ bảng phụ (cũ do Admin tay to tạo)
    const membersOld = await getMembers();
    // Lấy độc giả chuẩn (hiện đại tự đăng ký)
    const usersAll = await getUsers();
    const usersStandard = usersAll.filter(u => u.role === 'user');

    // Gộp 2 mảng lại. Nếu 1 email nằm ở cả 2 nơi (mồ côi/rác), ưu tiên giữ thằng mới.
    const mergedList = [...usersStandard, ...membersOld];
    const uniqueMembers = mergedList.filter((v, i, a) => a.findIndex(v2 => (v2.email === v.email)) === i);

    // Helper to add borrowCount to member objects
    const addBorrowCount = async (memberList) => {
      return await Promise.all(memberList.map(async (m) => {
        // Fallback support if UID vs ID mismatch happens
        const fetchId = m.uid || m.id;
        const records = await getBorrowRecords(fetchId);
        const activeCount = records.filter(r => r.status === 'BORROWING' || r.status === 'OVERDUE').length;
        return { ...m, borrowCount: activeCount };
      }));
    };

    if (phone) {
      const filtered = uniqueMembers.filter(m => m.phone === phone);
      const enriched = await addBorrowCount(filtered);
      return NextResponse.json(enriched);
    }

    const enrichedAll = await addBorrowCount(uniqueMembers);
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

    // Check for duplicates
    const duplicate = await checkMemberDuplicate(email, phone);
    if (duplicate.exists) {
      return NextResponse.json(
        { error: `${duplicate.field} này đã tồn tại trong ${duplicate.source}` },
        { status: 409 }
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
