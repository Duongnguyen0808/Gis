// utils.js

// Hàm fetchData của bạn (giữ nguyên nếu đã có)
export async function fetchData(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Lỗi HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        alert(`Không thể tải dữ liệu: ${e.message}`);
        console.error(e);
        return null;
    }
}

// --- THÊM HÀM NÀY ---
/**
 * Tính toán xem một địa điểm có đang mở cửa dựa trên properties và thời gian hiện tại.
 * @param {object} properties Thuộc tính của feature, chứa opening_time và closing_time (HH:MM).
 * @param {Date} now Đối tượng Date đại diện cho thời gian hiện tại.
 * @returns {boolean|undefined} true nếu mở, false nếu đóng, undefined nếu không rõ.
 */
export function calculateIsOpen(properties, now) {
    // --- Logic kiểm tra trạng thái mở cửa (như đã định nghĩa ở các bước trước) ---
    const currentDay = now.getDay(); // 0=Chủ Nhật, 1=Thứ Hai, ..., 6=Thứ Bảy
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // --- Quy tắc cơ bản (Cần điều chỉnh theo thực tế Việt Nam) ---
    // Ví dụ: Mặc định đóng cửa Chủ Nhật
    if (currentDay === 0) return false;
    // Ví dụ: Xử lý Thứ Bảy (nếu ngân hàng thường chỉ mở buổi sáng)
    // if (currentDay === 6 && (currentHour < 8 || currentHour >= 12)) { // Ví dụ: Mở 8h-12h Thứ 7
    //     return false;
    // }

    const openTimeStr = properties?.opening_time;
    const closeTimeStr = properties?.closing_time;

    // Kiểm tra dữ liệu đầu vào cơ bản
    if (!openTimeStr || !closeTimeStr || typeof openTimeStr !== 'string' || typeof closeTimeStr !== 'string') {
        return undefined; // Không rõ trạng thái nếu thiếu dữ liệu
    }

    // Kiểm tra các giá trị không hợp lệ phổ biến
    if (openTimeStr.includes('N/A') || closeTimeStr.includes('N/A') ||
        openTimeStr.toLowerCase().includes('cập nhật') || closeTimeStr.toLowerCase().includes('cập nhật')) {
        return undefined; // Không rõ trạng thái
    }

    // Regex để kiểm tra định dạng HH:MM
    const timePattern = /^\d{1,2}:\d{2}$/;
    if (!timePattern.test(openTimeStr) || !timePattern.test(closeTimeStr)) {
        console.warn("Invalid time format detected:", properties?.name, openTimeStr, closeTimeStr);
        return undefined; // Định dạng không hợp lệ
    }

    try {
        const [openHour, openMinute] = openTimeStr.split(':').map(Number);
        const [closeHour, closeMinute] = closeTimeStr.split(':').map(Number);

        // Kiểm tra kết quả parse (NaN - Not a Number)
        if (isNaN(openHour) || isNaN(openMinute) || isNaN(closeHour) || isNaN(closeMinute)) {
            console.warn("NaN detected after parsing time:", properties?.name, openTimeStr, closeTimeStr);
            return undefined; // Lỗi parse số
        }

        const openTimeInMinutes = openHour * 60 + openMinute;
        let closeTimeInMinutes = closeHour * 60 + closeMinute;

        // Xử lý trường hợp đóng cửa qua nửa đêm (ví dụ: 22:00 - 06:00) - Ít gặp ở ngân hàng
        if (closeTimeInMinutes < openTimeInMinutes) {
            return currentTimeInMinutes >= openTimeInMinutes || currentTimeInMinutes < closeTimeInMinutes;
        } else {
            // Trường hợp thông thường trong ngày
            return currentTimeInMinutes >= openTimeInMinutes && currentTimeInMinutes < closeTimeInMinutes;
        }

    } catch (e) {
        console.error("Error parsing time for:", properties?.name, openTimeStr, closeTimeStr, e);
        return undefined; // Lỗi khi parse
    }
}
// --- KẾT THÚC HÀM THÊM ---