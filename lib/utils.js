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

/**
 * Extracts a numeric timestamp (ms) from various date formats
 * @param {any} date 
 * @returns {number} - Milliseconds since epoch
 */
export function getTimestamp(date) {
  if (!date) return 0;
  
  if (typeof date.toMillis === 'function') return date.toMillis();
  if (typeof date.toDate === 'function') return date.toDate().getTime();
  if (date.seconds !== undefined) return date.seconds * 1000;
  if (date._seconds !== undefined) return date._seconds * 1000;
  
  const d = new Date(date);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}

/**
 * Converts various date formats (Firestore Timestamp, ISO string, etc.) to a JS Date object.
 * @param {any} date 
 * @returns {Date|null}
 */
export function toJsDate(date) {
  if (!date) return null;
  if (date instanceof Date) return date;
  
  // Handle Firestore Timestamp
  if (typeof date.toDate === 'function') return date.toDate();
  
  // Handle raw seconds objects (standard and internal Firebase formats)
  if (date.seconds !== undefined) return new Date(date.seconds * 1000);
  if (date._seconds !== undefined) return new Date(date._seconds * 1000);
  
  const d = new Date(date);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Converts a string to Title Case (e.g., "john doe" -> "John Doe").
 * @param {string} str - The string to convert.
 * @returns {string} - The Title Case string.
 */
export function toTitleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
