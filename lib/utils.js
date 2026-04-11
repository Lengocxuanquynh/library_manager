/**
 * Converts a string to a URL-friendly slug, handling Vietnamese characters.
 * @param {string} text - The string to slugify.
 * @returns {string} - The generated slug.
 */
export function slugify(text) {
  if (!text) return "";
  
  let slug = text.toLowerCase();

  // Convert Vietnamese characters
  slug = slug.replace(/[áàảãạăắằẳẵặâấầẩẫậ]/g, 'a');
  slug = slug.replace(/[éèẻẽẹêếềểễệ]/g, 'e');
  slug = slug.replace(/[íìỉĩị]/g, 'i');
  slug = slug.replace(/[óòỏõọôốồổỗộơớờởỡợ]/g, 'o');
  slug = slug.replace(/[úùủũụưứừửữự]/g, 'u');
  slug = slug.replace(/[ýỳỷỹỵ]/g, 'y');
  slug = slug.replace(/đ/g, 'd');

  // Remove special characters
  slug = slug.replace(/([^0-9a-z-\s])/g, '');

  // Replace spaces with hyphens
  slug = slug.replace(/(\s+)/g, '-');

  // Remove consecutive hyphens
  slug = slug.replace(/-+/g, '-');

  // Trim hyphens from start and end
  slug = slug.replace(/^-+|-+$/g, '');

  return slug;
}

/**
 * Robustly formats a date from various formats (JS Date, ISO string, Firestore Timestamp)
 * @param {any} date - The date to format
 * @param {boolean} includeTime - Whether to include time in the output
 * @returns {string} - Formatted date string
 */
export function formatDate(date, includeTime = false) {
  if (!date) return "—";
  
  let d = date;
  
  // Handle Firestore Timestamp object
  if (date && typeof date === 'object') {
    if (typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date.seconds !== undefined) {
      d = new Date(date.seconds * 1000);
    } else if (date._seconds !== undefined) {
      d = new Date(date._seconds * 1000);
    } else {
      d = new Date(date);
    }
  } else {
    d = new Date(date);
  }
  
  if (isNaN(d.getTime())) return "N/A";
  
  if (includeTime) {
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  }
  return d.toLocaleDateString('vi-VN');
}
