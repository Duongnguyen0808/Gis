# maps/views.py

from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings # Import settings để lấy MEDIA_URL
from .models import BRANCH
import json
import os
import google.generativeai as genai
import logging

# --- Cấu hình logging ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- !!!!! KEY API CỦA BẠN !!!!! ---
# Key bạn đã cung cấp
YOUR_ACTUAL_GOOGLE_API_KEY = 'AIzaSyCBr2npgyPgmpNVyfWFqvkHsuF8tXj1RH8'

# Ưu tiên lấy key từ biến môi trường, nếu không có thì dùng key bạn đặt ở trên
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', YOUR_ACTUAL_GOOGLE_API_KEY)
# ----------------------------------------------------

# --- Dữ liệu tĩnh (Giữ nguyên) ---
INTEREST_RATES_VND = {
    "không kỳ hạn": 0.10, "7 ngày": 0.20, "14 ngày": 0.20, "1 tháng": 1.60,
    "2 tháng": 1.60, "3 tháng": 1.90, "6 tháng": 2.90, "9 tháng": 2.90,
    "12 tháng": 4.60, "24 tháng": 4.70, "36 tháng": 4.70, "48 tháng": 4.70,
    "60 tháng": 4.70,
}
EXCHANGE_RATES_BUY_CASH = {
    "USD": 25805.00, "EUR": 28801.35, "GBP": 33766.92, "JPY": 175.65,
    "AUD": 16241.52, "SGD": 19311.55, "THB": 687.60, "CAD": 18313.69,
    "CHF": 30558.84, "HKD": 3261.54, "CNY": 3482.36,
}

# --- Cấu hình và Khởi tạo Model Gemini (ĐÃ SỬA LỖI KIỂM TRA KEY) ---
model = None
try:
    # --- SỬA LỖI Ở ĐÂY: Chỉ kiểm tra xem key có bị rỗng hay không ---
    if not GOOGLE_API_KEY:
        logger.warning("!!! GOOGLE_API_KEY is not set. Gemini functionality will be DISABLED.")
        # Giữ model là None
    else:
        # Luôn thử cấu hình và tạo model nếu key không rỗng
        logger.info(f"Attempting to configure Gemini with provided API key ending in '...{GOOGLE_API_KEY[-4:]}'.") # Log key cuối để xác nhận
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Hoặc model bạn muốn dùng
        logger.info(f"Gemini model ('{model.model_name}') configured successfully.")
except Exception as e:
    # Ghi lỗi chi tiết NẾU có vấn đề khi khởi tạo bằng key được cung cấp
    logger.error(f"ERROR: Failed to configure Gemini (API Key might be invalid, quota exceeded, network issue, etc.): {e}", exc_info=True)
    # Giữ model là None nếu có lỗi
# --- Hết phần sửa lỗi ---

# --- Các hàm helper (Giữ nguyên) ---
def get_interest_rate_data(term_keyword):
    term_keyword_lower = term_keyword.lower()
    for term, rate in INTEREST_RATES_VND.items():
        if term_keyword_lower in term.lower():
            return f"Lãi suất tiền gửi VND cho kỳ hạn {term} hiện là {rate}%/năm."
    return None

def get_exchange_rate_data(currency_code):
    code_upper = currency_code.upper()
    rate = EXCHANGE_RATES_BUY_CASH.get(code_upper)
    if rate:
        return f"Tỷ giá mua tiền mặt tham khảo cho {code_upper} là {rate:,.2f} VND."
    return None

# --- View xử lý Chat API (Giữ nguyên logic kiểm tra 'if not model') ---
@csrf_exempt
def chat_api(request):
    """Xử lý tin nhắn bằng Gemini API, có tham khảo CSDL chi nhánh."""
    if not model: # Kiểm tra xem model đã được khởi tạo thành công ở trên chưa
        logger.error("Chat API called but Gemini model is not available (Initialization failed during startup).")
        return JsonResponse({'reply': 'Lỗi 503: Dịch vụ chatbot tạm thời không khả dụng do lỗi khởi tạo. Vui lòng kiểm tra log server.'}, status=503)

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_message_original = data.get('message', '').strip()
            user_message_lower = user_message_original.lower()
            logger.info(f"Received chat message (original): {user_message_original}")

            if not user_message_original:
                return JsonResponse({'reply': 'Bạn muốn hỏi gì?'})

            # --- Xử lý và truy vấn CSDL nếu cần (Giữ nguyên) ---
            branch_info_str = ""
            if "atm" in user_message_lower:
                logger.info("Keyword 'atm' detected. Querying branches with ATM.")
                relevant_branches = BRANCH.objects.filter(tinh_trang=True).order_by('ten_chi_nhanh')[:5]
                if relevant_branches:
                    branch_info_str += "Một số chi nhánh có ATM:\n"
                    for branch in relevant_branches:
                        branch_info_str += f"- {branch.ten_chi_nhanh}: {branch.dia_chi}\n"
                else:
                    branch_info_str += "Hiện không tìm thấy thông tin chi nhánh nào có ATM trong dữ liệu.\n"

            elif "giờ mở cửa" in user_message_lower or "mấy giờ" in user_message_lower:
                potential_name = user_message_lower.replace("giờ mở cửa", "").replace("mấy giờ","").replace("chi nhánh", "").strip()
                if potential_name:
                    logger.info(f"Keywords 'giờ mở cửa' detected. Searching for branch like: {potential_name}")
                    relevant_branches = BRANCH.objects.filter(ten_chi_nhanh__icontains=potential_name).order_by('ten_chi_nhanh')[:3]
                    if relevant_branches:
                        branch_info_str += "Thông tin giờ hoạt động của chi nhánh bạn tìm:\n"
                        for branch in relevant_branches:
                            open_time = branch.gio_mo_cua.strftime('%H:%M') if branch.gio_mo_cua else "Chưa cập nhật"
                            close_time = branch.gio_dong_cua.strftime('%H:%M') if branch.gio_dong_cua else "Chưa cập nhật"
                            branch_info_str += f"- {branch.ten_chi_nhanh}: Mở cửa: {open_time}, Đóng cửa: {close_time}\n"
                    else:
                         branch_info_str += f"Không tìm thấy thông tin giờ cho chi nhánh giống '{potential_name}'.\n"
                else:
                     branch_info_str += "Giờ làm việc thông thường của các chi nhánh là 8:00-17:00 từ Thứ 2 đến Thứ 6. Bạn nên kiểm tra chi tiết tại chi nhánh cụ thể trên bản đồ nhé.\n"

            elif "chi nhánh" in user_message_lower or "địa chỉ" in user_message_lower:
                 potential_name = user_message_lower.replace("chi nhánh", "").replace("địa chỉ", "").strip()
                 if potential_name:
                    logger.info(f"Keywords 'chi nhánh/địa chỉ' detected. Searching for branch like: {potential_name}")
                    relevant_branches = BRANCH.objects.filter(ten_chi_nhanh__icontains=potential_name).order_by('ten_chi_nhanh')[:3]
                    if relevant_branches:
                        branch_info_str += "Thông tin địa chỉ chi nhánh bạn tìm:\n"
                        for branch in relevant_branches:
                            branch_info_str += f"- {branch.ten_chi_nhanh}: {branch.dia_chi}\n"
                    else:
                        branch_info_str += f"Không tìm thấy thông tin địa chỉ cho chi nhánh giống '{potential_name}'.\n"
                 else:
                    logger.info("Keywords 'chi nhánh/địa chỉ' detected. Listing some branches.")
                    some_branches = BRANCH.objects.all().order_by('ten_chi_nhanh')[:3]
                    if some_branches:
                        branch_info_str += "Một số chi nhánh của chúng tôi:\n"
                        for branch in some_branches:
                             branch_info_str += f"- {branch.ten_chi_nhanh}: {branch.dia_chi}\n"

            # --- Tạo Prompt (Giữ nguyên) ---
            try:
                current_interest_rates_str = json.dumps(INTEREST_RATES_VND, ensure_ascii=False, indent=2)
                current_exchange_rates_str = json.dumps(EXCHANGE_RATES_BUY_CASH, ensure_ascii=False, indent=2)
            except Exception as json_err:
                logger.error(f"Error formatting static rates to JSON: {json_err}")
                current_interest_rates_str = "{ Lỗi dữ liệu lãi suất }"
                current_exchange_rates_str = "{ Lỗi dữ liệu tỷ giá }"

            prompt = f"""Bạn là một trợ lý ảo hữu ích cho một ứng dụng bản đồ ngân hàng VCB. Trả lời câu hỏi của người dùng một cách ngắn gọn, thân thiện và chính xác bằng tiếng Việt.
            Dữ liệu tham khảo:
            - Lãi suất tiền gửi VND (%/năm): {current_interest_rates_str}
            - Tỷ giá mua tiền mặt (VND): {current_exchange_rates_str}
            {f'- Thông tin chi nhánh liên quan (từ CSDL):\\n{branch_info_str}' if branch_info_str else ''}

            Hướng dẫn trả lời:
            1. Ưu tiên sử dụng thông tin từ CSDL chi nhánh nếu câu hỏi liên quan đến địa chỉ, giờ mở cửa, hoặc tình trạng ATM và có thông tin được cung cấp trong mục "Thông tin chi nhánh liên quan".
            2. Nếu hỏi về lãi suất hoặc tỷ giá, hãy dùng dữ liệu lãi suất/tỷ giá cung cấp.
            3. Nếu người dùng hỏi về chi nhánh "gần đây", "quanh đây", "gần tôi", hãy giải thích rằng bạn không thể xác định vị trí của họ qua chat, và khuyên họ sử dụng chức năng tìm kiếm hoặc nút vị trí trên bản đồ để xem các chi nhánh gần nhất.
            4. Với các câu hỏi khác không liên quan trực tiếp đến dữ liệu trên hoặc chức năng ứng dụng (ví dụ: chào hỏi, cảm ơn), hãy trả lời một cách tự nhiên.
            5. Nếu không có thông tin trong dữ liệu cung cấp để trả lời, hãy nói rằng bạn không có thông tin đó hoặc thông tin chưa được cập nhật.

            Câu hỏi của người dùng: "{user_message_original}"
            Câu trả lời của bạn:"""

            logger.debug("Sending prompt to Gemini...")

            # --- Gọi Gemini API (Giữ nguyên) ---
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ]
            request_options = {"timeout": 60}
            response = model.generate_content(
                prompt,
                safety_settings=safety_settings,
                request_options=request_options
            )

            # --- Xử lý phản hồi (Giữ nguyên) ---
            bot_response = "Xin lỗi, tôi không thể tạo câu trả lời lúc này."
            try:
                if response.parts:
                    bot_response = response.text
                else:
                    block_reason = response.prompt_feedback.block_reason if response.prompt_feedback else 'Không rõ'
                    logger.warning(f"Gemini response blocked. Reason: {block_reason}")
                    if block_reason == 'SAFETY':
                         bot_response = "Rất tiếc, câu hỏi của bạn có chứa nội dung không phù hợp hoặc nhạy cảm nên tôi không thể trả lời."
                    elif block_reason:
                         bot_response = f"Rất tiếc, tôi không thể trả lời câu hỏi này (Lý do: {block_reason}). Vui lòng thử diễn đạt khác."
                    else:
                         bot_response = "Rất tiếc, tôi không thể xử lý yêu cầu của bạn lúc này."
            except ValueError:
                logger.warning(f"Gemini response possibly blocked or empty. Response: {response}")
                try:
                    block_reason = response.prompt_feedback.block_reason
                    if block_reason == 'SAFETY':
                         bot_response = "Rất tiếc, yêu cầu của bạn có thể đã bị chặn vì lý do an toàn."
                    elif block_reason:
                         bot_response = f"Rất tiếc, yêu cầu của bạn có thể đã bị chặn (Lý do: {block_reason})."
                    else:
                         bot_response = "Rất tiếc, tôi không nhận được phản hồi hợp lệ từ AI."
                except Exception:
                    bot_response = "Rất tiếc, tôi không nhận được phản hồi hợp lệ từ AI."
            except Exception as resp_err:
                logger.error(f"Error processing Gemini response: {resp_err}", exc_info=True)
                bot_response = "Đã có lỗi xảy ra khi xử lý phản hồi từ AI."

            logger.info(f"Sending reply: {bot_response[:100]}...")
            return JsonResponse({'reply': bot_response})

        except json.JSONDecodeError:
            logger.error("Invalid JSON received in chat request.")
            return JsonResponse({'reply': 'Lỗi: Dữ liệu gửi lên không hợp lệ.'}, status=400)
        except Exception as e:
            logger.error(f"ERROR: Unhandled exception in chat_api for message '{data.get('message', '')}': {e}", exc_info=True)
            return JsonResponse({'reply': 'Lỗi máy chủ nội bộ khi xử lý chat. Vui lòng thử lại sau.'}, status=500)

    logger.warning(f"Invalid request method received for chat_api: {request.method}")
    return JsonResponse({'error': 'Method Not Allowed'}, status=405)


# --- View render trang chính (Giữ nguyên) ---
def VCB(request):
    logger.info("Rendering VCB page (index.html)")
    return render(request, 'index.html')

# --- View cung cấp dữ liệu GeoJSON (Giữ nguyên) ---
def branch_geojson(request):
    logger.info("Generating branch GeoJSON")
    features = []
    try:
        branches = BRANCH.objects.order_by('ten_chi_nhanh').values(
            'ten_chi_nhanh', 'dia_chi', 'kinh_do', 'vi_do',
            'gio_mo_cua', 'gio_dong_cua', 'tinh_trang', 'hinh_anh'
        )
        for branch_data in branches:
            image_url = None
            hinh_anh_path = branch_data.get('hinh_anh')
            if hinh_anh_path and hasattr(settings, 'MEDIA_URL') and settings.MEDIA_URL:
                try:
                    image_url = f"{settings.MEDIA_URL}{hinh_anh_path}"
                except Exception as img_url_err:
                     logger.error(f"Error constructing image URL for {hinh_anh_path}: {img_url_err}")
            elif hinh_anh_path:
                 logger.warning(f"MEDIA_URL not configured in settings.py. Cannot generate full image URL for {hinh_anh_path}.")

            opening_time_str = branch_data.get('gio_mo_cua').strftime('%H:%M') if branch_data.get('gio_mo_cua') else None
            closing_time_str = branch_data.get('gio_dong_cua').strftime('%H:%M') if branch_data.get('gio_dong_cua') else None

            features.append({
                "type": "Feature",
                "properties": {
                    "name": branch_data.get('ten_chi_nhanh'),
                    "address": branch_data.get('dia_chi'),
                    "opening_time": opening_time_str,
                    "closing_time": closing_time_str,
                    "tinh_trang": branch_data.get('tinh_trang'),
                    "hinh_anh_url": image_url,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [branch_data.get('kinh_do'), branch_data.get('vi_do')]
                }
            })
        data = {"type": "FeatureCollection", "features": features}
        logger.info(f"Generated GeoJSON with {len(features)} features.")
        return JsonResponse(data, json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        logger.error(f"Error generating branch GeoJSON: {e}", exc_info=True)
        return JsonResponse({"error": "Không thể tạo dữ liệu chi nhánh."}, status=500, json_dumps_params={'ensure_ascii': False})