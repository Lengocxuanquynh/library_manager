import { NextResponse } from 'next/server';
import { deleteAuthor, updateAuthor, getAuthor, checkNameExists } from '../../../../services/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Tên tác giả là bắt buộc' }, { status: 400 });
    }

    // 1. Kiểm tra tồn tại và trùng tên
    const exists = await checkNameExists('authors', name, id);
    if (exists) {
      return NextResponse.json({ error: 'Tên tác giả đã tồn tại' }, { status: 400 });
    }

    await updateAuthor(id, name);
    return NextResponse.json({ success: true, message: 'Cập nhật tác giả thành công' });
  } catch (error) {
    console.error('Lỗi cập nhật tác giả:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const { getAuthor, countBooksByAuthor, hasActiveBorrowingsByAuthor, deleteAuthor, deleteAuthorWithBooks } = await import('../../../../services/db');
    
    // 1. Lấy thông tin tác giả
    const author = await getAuthor(id);
    if (!author) return NextResponse.json({ error: 'Tác giả không tồn tại' }, { status: 404 });

    // 2. Kiểm tra số lượng sách
    const bookCount = await countBooksByAuthor(author.name);
    
    if (bookCount > 0) {
      // 3. Nếu có sách, kiểm tra xem có ai đang mượn không
      const hasActive = await hasActiveBorrowingsByAuthor(author.name);
      if (hasActive) {
        return NextResponse.json({ 
          error: `Không thể xóa: Có ${bookCount} cuốn sách thuộc tác giả này, trong đó có sách đang được mượn hoặc chưa trả.`,
          code: 'ACTIVE_BORROWING'
        }, { status: 400 });
      }

      // 4. Nếu không có ai mượn nhưng admin chưa chọn 'force', thì yêu cầu xác nhận lần 2
      if (!force) {
        return NextResponse.json({ 
          error: `Tác giả này có ${bookCount} cuốn sách liên kết. Bạn có chắc chắn muốn xóa tất cả sách của tác giả này không?`,
          code: 'HAS_BOOKS',
          count: bookCount
        }, { status: 400 });
      }

      // 5. Nếu force=true và an toàn, tiến hành xóa hàng loạt
      await deleteAuthorWithBooks(id, author.name);
      return NextResponse.json({ message: `Đã xóa tác giả và toàn bộ ${bookCount} cuốn sách liên quan.` });
    }

    // 6. Trường hợp không có sách nào liên kết, xóa bình thường
    await deleteAuthor(id);
    return NextResponse.json({ message: 'Xóa tác giả thành công' });
  } catch (error) {
    console.error('Lỗi xóa tác giả:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
