
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables from .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const projectId = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = env.FIREBASE_CLIENT_EMAIL;
const privateKey = env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error("❌ Missing Firebase Admin credentials in .env");
  process.exit(1);
}

// 2. Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();

const books = [
  // Văn Học Việt Nam
  { title: "Số Đỏ", author: "Vũ Trọng Phụng", category: "Văn học Việt Nam", quantity: 15, isbn: "9786046991319", publisher: "NXB Văn Học", year: "1936", description: "Tác phẩm trào phúng kinh điển về xã hội Việt Nam thời Pháp thuộc.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/6e/de/6b/25697669d511397b91d2634e56711516.jpg" },
  { title: "Tắt Đèn", author: "Ngô Tất Tố", category: "Văn học Việt Nam", quantity: 12, isbn: "9786046991326", publisher: "NXB Văn Học", year: "1937", description: "Bức tranh hiện thực về đời sống khốn cùng của nông dân Việt Nam.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/4b/8d/ae/53706037f3743c4a45a353683f2a36b5.jpg" },
  { title: "Mắt Biếc", author: "Nguyễn Nhật Ánh", category: "Văn học Việt Nam", quantity: 20, isbn: "9786042123456", publisher: "NXB Trẻ", year: "1990", description: "Câu chuyện tình buồn đầy nuối tiếc của nhân vật Ngạn dành cho Hà Lan.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/bc/57/02/b083b0ebf283c8466ed326588243be1f.jpg" },
  { title: "Cho Tôi Xin Một Vé Đi Tuổi Thơ", author: "Nguyễn Nhật Ánh", category: "Văn học Việt Nam", quantity: 25, isbn: "9786042123470", publisher: "NXB Trẻ", year: "2008", description: "Cuốn sách dành cho cả trẻ em lẫn người lớn để tìm lại ký ức tuổi thơ.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/72/75/7f/7519965251433f48a73599b4f738f7a8.jpg" },
  { title: "Dế Mèn Phiêu Lưu Ký", author: "Tô Hoài", category: "Văn học Việt Nam", quantity: 30, isbn: "9786042084474", publisher: "NXB Kim Đồng", year: "1941", description: "Tác phẩm văn học thiếu nhi kinh điển của Việt Nam.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/ca/d0/22/a9d562f6460113c726715f33f9059f63.jpg" },
  
  // Kinh Điển Thế Giới
  { title: "1984", author: "George Orwell", category: "Kinh điển", quantity: 15, isbn: "9780451524935", publisher: "Secker & Warburg", year: "1949", description: "Tiểu thuyết tiên tri về một thế giới độc tài đen tối.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/71kxa1-0mfL.jpg" },
  { title: "Giết Con Chim Nhại", author: "Harper Lee", category: "Kinh điển", quantity: 18, isbn: "9780061120084", publisher: "J.B. Lippincott & Co.", year: "1960", description: "Tác phẩm sâu sắc về nạn phân biệt chủng tộc và sự mất mát trong trắng.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/81gepf1eMqL.jpg" },
  { title: "Đại Gia Gatsby", author: "F. Scott Fitzgerald", category: "Kinh điển", quantity: 14, isbn: "9780743273565", publisher: "Charles Scribner's Sons", year: "1925", description: "Câu chuyện về giấc mơ Mỹ tan vỡ trong kỷ nguyên Jazz.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/81af+MCATTL.jpg" },
  { title: "Hoàng Tử Bé", author: "Antoine de Saint-Exupéry", category: "Kinh điển", quantity: 30, isbn: "9780156012195", publisher: "Reynal & Hitchcock", year: "1943", description: "Một câu chuyện triết lý nhẹ nhàng về tình yêu và cuộc sống.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/71OZY03K6wL.jpg" },
  { title: "Ông Già Và Biển Cả", author: "Ernest Hemingway", category: "Kinh điển", quantity: 22, isbn: "9780684801223", publisher: "Charles Scribner's Sons", year: "1952", description: "Cuộc chiến kiên cường của một ông lão với con cá kiếm khổng lồ.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/71-6uIeaO-L.jpg" },
  
  // Công Nghệ & Lập Trình
  { title: "Clean Code", author: "Robert C. Martin", category: "Công nghệ", quantity: 20, isbn: "9780132350884", publisher: "Prentice Hall", year: "2008", description: "Cuốn sách gối đầu giường cho mọi lập trình viên muốn viết code sạch.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/41xShlnTZTL._SX376_BO1,204,203,200_.jpg" },
  { title: "The Pragmatic Programmer", author: "Andrew Hunt", category: "Công nghệ", quantity: 15, isbn: "9780201616224", publisher: "Addison-Wesley", year: "1999", description: "Những lời khuyên thực tế để trở thành một nghệ nhân phần mềm.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/41HIn9m9zZL._SX258_BO1,204,203,200_.jpg" },
  { title: "Refactoring", author: "Martin Fowler", category: "Công nghệ", quantity: 12, isbn: "9780134757599", publisher: "Addison-Wesley", year: "1999", description: "Kỹ thuật cải thiện thiết kế mã nguồn hiện có.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/516m83wK3KL._SX396_BO1,204,203,200_.jpg" },
  { title: "Design Patterns", author: "Gang of Four", category: "Công nghệ", quantity: 10, isbn: "9780201633610", publisher: "Addison-Wesley", year: "1994", description: "Các mẫu thiết kế phần mềm hướng đối tượng phổ biến.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/51szD9HC9pL._SX395_BO1,204,203,200_.jpg" },
  { title: "Effective Java", author: "Joshua Bloch", category: "Công nghệ", quantity: 15, isbn: "9780134685991", publisher: "Addison-Wesley", year: "2017", description: "Hướng dẫn thực hành các kỹ thuật lập trình Java tốt nhất.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/41-s96S8SgL._SX396_BO1,204,203,200_.jpg" },
  
  // Kinh Doanh & Kỹ Năng
  { title: "Đắc Nhân Tâm", author: "Dale Carnegie", category: "Kỹ năng sống", quantity: 50, isbn: "9780671027032", publisher: "Simon & Schuster", year: "1936", description: "Cuốn sách nổi tiếng nhất về nghệ thuật giao tiếp và thu phục lòng người.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/8d/e2/0b/2290f6b4a3a69a0d33e5513ab3e54b64.jpg" },
  { title: "Cha Giàu Cha Nghèo", author: "Robert Kiyosaki", category: "Kinh doanh", quantity: 35, isbn: "9781612680194", publisher: "Warner Books", year: "1997", description: "Những bài học về tư duy tài chính và làm giàu.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/9a/14/d0/0d68c946c1f1ec71eb6dfa3aa728e7e1.jpg" },
  { title: "Atomic Habits", author: "James Clear", category: "Kỹ năng sống", quantity: 40, isbn: "9780735211292", publisher: "Avery", year: "2018", description: "Thay đổi nhỏ, kết quả lớn thông qua việc xây dựng thói quen tốt.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/91bYsX41DVL.jpg" },
  { title: "Nhà Giả Kim", author: "Paulo Coelho", category: "Kỹ năng sống", quantity: 45, isbn: "9780062315007", publisher: "HarperTorch", year: "1988", description: "Hành trình theo đuổi ước mơ và vận mệnh của chàng chăn cừu Santiago.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/00/69/34/4cb3f9828d57d76296b142461d360057.jpg" },
  { title: "Think and Grow Rich", author: "Napoleon Hill", category: "Kinh doanh", quantity: 28, isbn: "9781585424337", publisher: "The Ralston Society", year: "1937", description: "Công thức thành công từ những người giàu có nhất thế giới.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/71Uup6I7BLL.jpg" },
  
  // Khoa Học & Triết Lý
  { title: "Lược Sử Thời Gian", author: "Stephen Hawking", category: "Khoa học", quantity: 18, isbn: "9780553380163", publisher: "Bantam Books", year: "1988", description: "Khám phá các bí ẩn của vũ trụ từ vụ nổ Big Bang đến các lỗ đen.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/91TmqMh69SL.jpg" },
  { title: "Sapiens: Lược Sử Loài Người", author: "Yuval Noah Harari", category: "Khoa học", quantity: 25, isbn: "9780062316097", publisher: "Harper", year: "2011", description: "Hành trình phát triển của loài người từ thời đồ đá đến kỷ nguyên công nghệ.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/713jIoMO3UL.jpg" },
  { title: "Vũ Trụ", author: "Carl Sagan", category: "Khoa học", quantity: 15, isbn: "9780345331359", publisher: "Random House", year: "1980", description: "Khám phá vẻ đẹp và sự vĩ đại của vũ trụ qua lăng kính khoa học.", coverImage: "https://images-na.ssl-images-amazon.com/images/I/81vN1fS9SML.jpg" },
  { title: "Tâm Lý Học Tội Phạm", author: "Stanton E. Samenow", category: "Tâm lý học", quantity: 12, isbn: "9780445203387", publisher: "Jason Aronson", year: "1984", description: "Phân tích cấu trúc tư duy của những kẻ phạm tội.", coverImage: "https://salt.tikicdn.com/cache/w1200/ts/product/49/09/89/4e3e3465b98ea73070409a809f4cf008.jpg" }
];

async function seed() {
  console.log(`🚀 Starting direct seeding of ${books.length} books...`);
  let success = 0;
  
  const categoriesSet = new Set(books.map(b => b.category));
  
  // 1. Seed Categories
  console.log("📁 Seeding categories...");
  for (const catName of categoriesSet) {
    const catQuery = await db.collection('categories').where('name', '==', catName).get();
    if (catQuery.empty) {
      await db.collection('categories').add({
        name: catName,
        description: "Tự động tạo từ hệ thống sách",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`   ✅ Category created: ${catName}`);
    }
  }

  // 2. Seed Books
  console.log("📚 Seeding books...");
  for (const book of books) {
    try {
      await db.collection('books').add({
        ...book,
        status: "Available",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`   ✅ Added: ${book.title} (${book.quantity} copies)`);
      success++;
    } catch (error) {
      console.error(`   ❌ Failed: ${book.title}`, error.message);
    }
  }

  console.log('-----------------------------');
  console.log(`🎉 Seed completed! Total books added: ${success}`);
  process.exit(0);
}

seed();
