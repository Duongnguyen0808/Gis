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