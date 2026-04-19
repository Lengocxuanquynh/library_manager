import { NextResponse } from 'next/server';
import { updateCategory, deleteCategory } from '../../../../services/db';

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    await updateCategory(id, body);

    return NextResponse.json({ success: true, message: 'Cập nhật thành công' });
  } catch (error) {
    console.error('Error updating category API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}

export async function DELETE(request, context) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const { getCategory, countBooksByCategory, hasActiveBorrowingsByCategory, deleteCategory, deleteCategoryWithBooks } = await import('../../../../services/db');

    // 1. Lấy thông tin thể loại
    const category = await getCategory(id);
    if (!category) return NextResponse.json({ error: 'Thể loại không tồn tại' }, { status: 404 });

    // 2. Kiểm tra số lượng sách
    const bookCount = await countBooksByCategory(category.name);

    if (bookCount > 0) {
      // 3. Kiểm tra xem có ai đang mượn sách thuộc thể loại này không
      const hasActive = await hasActiveBorrowingsByCategory(category.name);
      if (hasActive) {
        return NextResponse.json({ 
          error: `Không thể xóa: Có ${bookCount} cuốn sách thuộc thể loại này mang trạng thái đang mượn hoặc chưa trả hết.`, 
          code: 'ACTIVE_BORROWING' 
        }, { status: 400 });
      }

      // 4. Nếu không có ai mượn nhưng chưa force, yêu cầu xác nhận xóa hàng loạt
      if (!force) {
        return NextResponse.json({ 
          error: `Thể loại này đang chứa ${bookCount} cuốn sách. Bạn có chắc chắn muốn xóa sạch chúng không?`, 
          code: 'HAS_BOOKS',
          count: bookCount
        }, { status: 400 });
      }

      // 5. Nếu force=true và an toàn, tiến hành xóa hàng loạt
      await deleteCategoryWithBooks(id, category.name);
      return NextResponse.json({ success: true, message: `Đã xóa thể loại và toàn bộ ${bookCount} cuốn sách liên quan.` });
    }

    // 6. Xóa bình thường nếu không có sách
    await deleteCategory(id);
    return NextResponse.json({ success: true, message: 'Xóa thành công' });
  } catch (error) {
    console.error('Error deleting category API:', error);
    return NextResponse.json({ error: 'Lỗi hệ thống' }, { status: 500 });
  }
}
