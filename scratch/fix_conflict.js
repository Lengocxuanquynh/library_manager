const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'app', '(dashboard)', 'admin', 'transactions', 'page.js');
let content = fs.readFileSync(filePath, 'utf8');

// The file has several conflict blocks:

// Block 1: handleOpenDetail vs handleReturn
// This starts around <<<<<<< Updated upstream and ends at >>>>>>> Stashed changes
const block1Start = content.indexOf('<<<<<<< Updated upstream\r\n  const handleOpenDetail');
if (block1Start === -1) {
    const fallbackStart = content.indexOf('<<<<<<< Updated upstream\n  const handleOpenDetail');
    if (fallbackStart !== -1) {
        // Handle LF replacing
    }
}
// We'll use a regex replacement to grab exactly the pieces and fix them.

// It's much easier to just do regex replace for the conflict markers.

function resolveConflict(text, regex, replacer) {
    return text.replace(regex, replacer);
}

// 1. Conflict 1: handleOpenDetail & handleReturnClick vs handleReturn
const regex1 = /<<<<<<< Updated upstream[\s\S]*?const handleOpenDetail = \(record\) => {([\s\S]*?)};[\s\S]*?const handleReturnClick = \(record, book\) => {([\s\S]*?)};[\s\S]*?=======[\s\S]*?const handleReturn = async \(record\) => {[\s\S]*?>>>>>>> Stashed changes/m;

content = content.replace(regex1, `  const handleOpenDetail = async (record) => {
    let updatedRecord = { ...record };
    
    // Nếu phiếu mượn thiếu phone/email, gọi API lấy từ Members/Users
    if ((!updatedRecord.borrowerPhone && !updatedRecord.userPhone && !updatedRecord.phone) || (!updatedRecord.userEmail && !updatedRecord.email)) {
      if (updatedRecord.userId) {
        try {
          const uRes = await fetch(\`/api/members?id=\${updatedRecord.userId}\`);
          if (uRes.ok) {
             const userData = await uRes.json();
             const u = Array.isArray(userData) ? userData.find(x => x.id === updatedRecord.userId) : userData;
             if (u) {
                updatedRecord.borrowerPhone = updatedRecord.borrowerPhone || updatedRecord.userPhone || u.phone;
                updatedRecord.userEmail = updatedRecord.userEmail || u.email;
             }
          }
        } catch (e) {
          console.error("Không thể lấy thêm thông tin độc giả", e);
        }
      }
    }
    setSelectedDetailRecord(updatedRecord);
    setIsDetailModalOpen(true);
  };

  const handleReturnClick = (record, book) => {
    setSelectedReturnRecord({ record, book });`);


// 2. Conflict 2: Detail Modal start vs Return Book Modal start
// <<<<<<< Updated upstream\n\n      {/* DETAIL MODAL */}.... =======\n      {/* RETURN BOOK MODAL / CHI TIẾT PHIẾU MƯỢN */}\n>>>>>>> Stashed changes
const regex2 = /<<<<<<< Updated upstream\s+({\/\* DETAIL MODAL \*\/}[\s\S]*?{\/\* RETURN BOOK MODAL \*\/})\s+=======\s+{\/\* RETURN BOOK MODAL \/ CHI TIẾT PHIẾU MƯỢN \*\/}\s+>>>>>>> Stashed changes/m;
content = content.replace(regex2, `$1`);


// 3. Conflict 3: Return book modal internals
// <<<<<<< Updated upstream\n            <div style={{ padding: '2rem' }}>\n              <div style={{ marginBottom: ... ======= ... >>>>>>> Stashed changes
const regex3 = /<<<<<<< Updated upstream\s+(<div style={{ padding: '2rem' }}>[\s\S]*?<\/div>)\s+=======\s+<div style={{ padding: '1\.5rem', overflowY: 'auto', flex: 1 }}>[\s\S]*?>>>>>>> Stashed changes(?:\s+<\/div>)*\s*/m;
content = content.replace(regex3, `            $1`);

// In case there is an extra closing div missing from the block above:
// Wait, my stashed block had more `</div>` than the upstream block?
// No, upstream's `<div style={{ padding: '2rem' }}>` matches the same scope.

// Now manually inject the changes to DETAIL MODAL!

// Add email to Info Card
// Find: 📞 {selectedDetailRecord.borrowerPhone || selectedDetailRecord.userPhone || "Chưa cập nhật"}
content = content.replace(
    /<p style={{ fontSize: '0.9rem', color: 'rgba\(255,255,255,0.6\)', margin: 0 }}>📞 {selectedDetailRecord.borrowerPhone \|\| selectedDetailRecord.userPhone \|\| "Chưa cập nhật"}<\/p>/,
    `<p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: 0 }}>📞 {selectedDetailRecord.borrowerPhone || selectedDetailRecord.userPhone || "Trống"}</p>
                  <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', margin: '0.3rem 0 0 0' }}>✉️ {selectedDetailRecord.userEmail || selectedDetailRecord.email || "Trống"}</p>`
);

// Add "Thu Hồi Tất Cả" button to Detail Modal actions
// Find:
//               <button \r?\n?                onClick={() => setIsDetailModalOpen(false)} \r?\n?                className="btn-outline"\r?\n?                style={{ padding: '0.7rem 1.5rem' }}\r?\n?              >\r?\n?                Đóng\r?\n?              <\/button>\r?\n?            <\/div>
content = content.replace(
    /(\s*<button[\s\S]*?onClick={\(\) => setIsDetailModalOpen\(false\)}[\s\S]*?>\s*Đóng\s*<\/button>\s*<\/div>)/,
    `
              {(selectedDetailRecord.status === 'BORROWING' || selectedDetailRecord.status === 'PARTIALLY_RETURNED' || selectedDetailRecord.status === 'OVERDUE') && (
                <button
                  onClick={async () => {
                    if (!confirm("Bạn có chắc chắn muốn thu hồi toàn bộ sách trong phiếu này không?")) return;
                    
                    setReturning(true);
                    const loadingToast = toast.loading("Đang thu hồi tất cả sách...");
                    try {
                      const res = await fetch('/api/admin/return-all', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          recordId: selectedDetailRecord.id,
                          transactionId: selectedDetailRecord.transactionId || selectedDetailRecord.slipId,
                          books: selectedDetailRecord.books || [],
                          adminId: user?.uid,
                          returnNote: "Thu hồi toàn bộ",
                          penaltyAmount: 0 // Optional
                        })
                      });
                      if (res.ok) {
                        toast.success("Thu hồi toàn bộ sách thành công!", { id: loadingToast });
                        setIsDetailModalOpen(false);
                        fetchData();
                      } else {
                        const data = await res.json();
                        toast.error(data.message || data.error || "Thu hồi thất bại", { id: loadingToast });
                      }
                    } catch (error) {
                      console.error(error);
                      toast.error("Lỗi kết nối server", { id: loadingToast });
                    } finally {
                      setReturning(false);
                    }
                  }}
                  disabled={returning}
                  style={{
                    padding: '0.7rem 1.5rem',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                    fontWeight: '700',
                    boxShadow: '0 6px 15px -3px rgba(255,65,108,0.4)',
                    opacity: returning ? 0.7 : 1, transition: 'all 0.2s',
                    textTransform: 'uppercase'
                  }}
                >
                  {returning ? 'Đang xử lý...' : 'Thu hồi tất cả sách'}
                </button>
              )}$1`
);

// We should also remove the remaining of the second conflict from stashed changes if the regex didn't get it perfectly.
// Because the regex3 might leave out some trailing `</div>` from my big stashed change block.
// Wait, my stashed block had more lines at the end.
// Let's just blindly use regex and if it fails, we will manually see what is left.

fs.writeFileSync(filePath, content, 'utf8');
console.log("File patched.");
