/**
 * Tiện ích tính toán tiền phạt và ngày trễ hạn thông minh
 * Tự động loại bỏ các ngày nghỉ (Chủ nhật, Lễ tết) khỏi bộ đếm
 */

export const calculatePenaltyDetails = (dueDateInput, returnDateInput = new Date(), settings = {}) => {
  if (!dueDateInput) return { chargeableDays: 0, penaltyFine: 0, isLocked: false };

  // Chuyển đổi sang đối tượng Date
  const dueDate = new Date(dueDateInput);
  const returnDate = new Date(returnDateInput);
  
  // Reset giờ về 0h để tính toán chính xác theo ngày
  dueDate.setHours(0, 0, 0, 0);
  returnDate.setHours(0, 0, 0, 0);

  if (returnDate <= dueDate) {
    return { chargeableDays: 0, penaltyFine: 0, isLocked: false };
  }

  const { 
    excludeSundays = true, 
    holidays = [] // Mảng các chuỗi ngày "YYYY-MM-DD"
  } = settings;

  let chargeableDays = 0;
  let tempDate = new Date(dueDate);

  // Bắt đầu đếm từ ngày tiếp theo của ngày hạn
  while (tempDate < returnDate) {
    tempDate.setDate(tempDate.getDate() + 1);
    
    const dayOfWeek = tempDate.getDay(); // 0 là Chủ nhật
    const dateString = tempDate.toISOString().split('T')[0];

    // Kiểm tra xem ngày này có được tính phạt không?
    const isSunday = dayOfWeek === 0;
    const isHoliday = holidays.includes(dateString);

    if (excludeSundays && isSunday) continue;
    if (isHoliday) continue;

    chargeableDays++;
  }

  // Chốt trần 14 ngày phạt (Max 70,000đ) theo yêu cầu nghiệp vụ
  const cappedDays = Math.min(chargeableDays, 14);
  const penaltyFine = cappedDays * 5000;
  
  // Một người bị khóa thẻ khi số ngày TÍNH PHẠT thực tế vượt quá 14 ngày
  const isLocked = chargeableDays > 14;

  return { 
    chargeableDays, 
    penaltyFine, 
    isLocked,
    actualDiffDays: Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24)) // Để tham khảo
  };
};

/**
 * Tính ngày hết hạn thông minh: Cộng X ngày làm việc (bỏ qua lễ/Chủ nhật)
 */
export const calculateSmartDueDate = (startDateInput, durationDays = 14, settings = {}) => {
  const startDate = new Date(startDateInput);
  startDate.setHours(0, 0, 0, 0);
  
  const { 
    excludeSundays = true, 
    holidays = [] 
  } = settings;

  let addedDays = 0;
  let tempDate = new Date(startDate);

  // Đếm cho đến khi đủ số ngày mượn thực tế
  while (addedDays < durationDays) {
    tempDate.setDate(tempDate.getDate() + 1);
    
    const dayOfWeek = tempDate.getDay();
    const dateString = tempDate.toISOString().split('T')[0];

    const isSunday = dayOfWeek === 0;
    const isHoliday = holidays.includes(dateString);

    // Nếu là ngày nghỉ thì nhảy qua, không tính vào số ngày đã cộng
    if (excludeSundays && isSunday) continue;
    if (isHoliday) continue;

    addedDays++;
  }

  // Hạn trả là cuối ngày của ngày làm việc thứ 14
  tempDate.setHours(23, 59, 59, 999);
  return tempDate;
};
