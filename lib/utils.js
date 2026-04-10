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
