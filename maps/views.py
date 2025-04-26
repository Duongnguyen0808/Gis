from django.shortcuts import render
from .models import BRANCH
from django.http import JsonResponse
import json
from django.views.decorators.csrf import csrf_exempt
import os
import google.generativeai as genai
import logging # Import logging
from . import views

# Cấu hình logging cơ bản
logging.basicConfig(level=logging.INFO) # Có thể đổi thành logging.DEBUG để xem nhiều thông tin hơn
logger = logging.getLogger(__name__)

# --- Lấy API Key ---
# Ưu tiên biến môi trường, nếu không có thì dùng key test (thay thế nếu cần test)
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY', 'AIzaSyBgyQxHorP5LM69vx9Fk-BjjtFu0JYokcM') # !!! THAY KEY CỦA BẠN VÀO ĐÂY KHI TEST !!!

# --- Dữ liệu (Cần cơ chế cập nhật) ---
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

# --- Cấu hình Gemini (Thực hiện một lần khi module được load) ---
model = None # Khởi tạo là None
try:
    if not GOOGLE_API_KEY or GOOGLE_API_KEY == 'YOUR_API_KEY_HERE':
         logger.warning("GOOGLE_API_KEY is not set or using placeholder. Gemini functionality will be disabled.")
         # raise ValueError("API Key is missing or invalid.") # Hoặc raise lỗi nếu muốn dừng hẳn
    else:
        genai.configure(api_key=GOOGLE_API_KEY)
        # Sử dụng model phù hợp, flash thường nhanh và rẻ hơn
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        logger.info("Gemini model configured successfully.")
except Exception as e:
    # Ghi lại lỗi chi tiết vào log của server Django
    logger.error(f"ERROR: Failed to configure Gemini: {e}", exc_info=True)
    # Không raise lỗi ở đây để các view khác vẫn có thể chạy

# --- Các hàm helper ---
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

# --- Views ---
@csrf_exempt
def chat_api(request):
    """Xử lý tin nhắn bằng Gemini API."""
    # Kiểm tra xem model đã được khởi tạo thành công chưa
    if not model:
        logger.error("Chat API called but Gemini model is not available.")
        return JsonResponse({'reply': 'Lỗi: Dịch vụ chatbot hiện không khả dụng do lỗi cấu hình.'}, status=503) # 503 Service Unavailable

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            user_message = data.get('message', '').strip()
            logger.info(f"Received chat message: {user_message}")

            if not user_message:
                return JsonResponse({'reply': 'Bạn muốn hỏi gì?'})

            # --- Tạo Prompt ---
            # Chuyển đổi dict thành chuỗi JSON để đưa vào prompt
            try:
                 current_interest_rates_str = json.dumps(INTEREST_RATES_VND, ensure_ascii=False, indent=2)
                 current_exchange_rates_str = json.dumps(EXCHANGE_RATES_BUY_CASH, ensure_ascii=False, indent=2)
            except Exception as json_err:
                 logger.error(f"Error formatting rates to JSON: {json_err}")
                 current_interest_rates_str = "{ Lỗi dữ liệu lãi suất }"
                 current_exchange_rates_str = "{ Lỗi dữ liệu tỷ giá }"


            prompt = f"""Bạn là một trợ lý ảo hữu ích cho một ứng dụng bản đồ ngân hàng VCB. Trả lời câu hỏi của người dùng một cách ngắn gọn, thân thiện và chính xác bằng tiếng Việt.
            Dữ liệu tham khảo:
            - Lãi suất tiền gửi VND (%/năm): {current_interest_rates_str}
            - Tỷ giá mua tiền mặt (VND): {current_exchange_rates_str}

            Nếu người dùng hỏi về lãi suất hoặc tỷ giá có trong dữ liệu trên, hãy cung cấp thông tin đó.
            Nếu người dùng hỏi về giờ làm việc, hãy nói rằng giờ làm việc thông thường là từ 8:00-17:00 T2-T6, nhưng nên kiểm tra chi tiết tại chi nhánh cụ thể trên bản đồ.
            Với các câu hỏi khác không liên quan trực tiếp đến dữ liệu trên hoặc chức năng ứng dụng, hãy trả lời một cách tự nhiên như một trợ lý ảo thông thường (ví dụ: chào hỏi, cảm ơn). Nếu không biết câu trả lời, hãy nói rằng bạn không có thông tin đó.

            Câu hỏi của người dùng: "{user_message}"
            Câu trả lời của bạn:"""

            logger.debug(f"Sending prompt to Gemini:\n{prompt}")

            # --- Gọi Gemini API ---
            # Thêm cài đặt an toàn để tránh nội dung không phù hợp (tùy chọn)
            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            ]
            response = model.generate_content(prompt, safety_settings=safety_settings)

            # --- Xử lý phản hồi ---
            bot_response = "Xin lỗi, tôi không thể tạo câu trả lời lúc này." # Mặc định nếu có lỗi
            try:
                # Kiểm tra xem có nội dung trả về không
                if response.parts:
                    bot_response = response.text
                else:
                    # Kiểm tra lý do bị chặn (nếu có)
                    block_reason = response.prompt_feedback.block_reason if response.prompt_feedback else 'Không rõ'
                    logger.warning(f"Gemini response blocked. Reason: {block_reason}")
                    bot_response = f"Rất tiếc, tôi không thể trả lời câu hỏi này (Lý do: {block_reason})."

            except ValueError:
                 # If the response doesn't contain text, check if the prompt was blocked.
                 logger.warning(f"Gemini response possibly blocked or empty. Response: {response}")
                 # Cung cấp thông tin phản hồi chặn nếu có
                 try:
                     block_reason = response.prompt_feedback.block_reason
                     bot_response = f"Rất tiếc, yêu cầu của bạn có thể đã bị chặn (Lý do: {block_reason})."
                 except Exception:
                     bot_response = "Rất tiếc, tôi không nhận được phản hồi hợp lệ."
            except Exception as resp_err:
                 logger.error(f"Error processing Gemini response: {resp_err}", exc_info=True)
                 bot_response = "Đã có lỗi xảy ra khi xử lý phản hồi từ AI."


            logger.info(f"Sending reply: {bot_response}")
            return JsonResponse({'reply': bot_response})

        except json.JSONDecodeError:
            logger.error("Invalid JSON received in chat request.")
            return JsonResponse({'reply': 'Lỗi: Dữ liệu gửi lên không hợp lệ.'}, status=400)
        except Exception as e:
            logger.error(f"ERROR: Unhandled exception in chat_api: {e}", exc_info=True)
            return JsonResponse({'reply': 'Lỗi máy chủ nội bộ khi xử lý chat.'}, status=500)

    logger.warning(f"Invalid request method received: {request.method}")
    return JsonResponse({'reply': 'Lỗi: Phương thức yêu cầu không hợp lệ.'}, status=405)


def VCB(request):
    """View render trang chính."""
    logger.info("Rendering VCB page (index.html)")
    return render(request, 'index.html')

def branch_geojson(request):
    """Tạo GeoJSON cho chi nhánh."""
    logger.info("Generating branch GeoJSON")
    features = []
    try:
        for branch in BRANCH.objects.all():
            image_url = branch.hinh_anh.url if branch.hinh_anh else None
            features.append({
                "type": "Feature",
                "properties": {
                    "name": branch.ten_chi_nhanh,
                    "address": branch.dia_chi,
                    "opening_time": branch.gio_mo_cua.strftime('%H:%M') if branch.gio_mo_cua else None,
                    "closing_time": branch.gio_dong_cua.strftime('%H:%M') if branch.gio_dong_cua else None,
                    "tinh_trang": branch.tinh_trang,
                    "hinh_anh_url": image_url,
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [branch.kinh_do, branch.vi_do]
                }
            })
        data = {"type": "FeatureCollection", "features": features}
        logger.info(f"Generated GeoJSON with {len(features)} features.")
        return JsonResponse(data, json_dumps_params={'ensure_ascii': False})
    except Exception as e:
         # Ghi lại lỗi nếu có vấn đề khi truy vấn DB hoặc tạo JSON
         logger.error(f"Error generating branch GeoJSON: {e}", exc_info=True)
         # Trả về lỗi 500 để frontend biết có vấn đề
         return JsonResponse({"error": "Không thể tạo dữ liệu chi nhánh."}, status=500)