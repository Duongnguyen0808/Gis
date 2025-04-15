from django.shortcuts import render
from .models import BRANCH
from django.http import JsonResponse

def VCB(request):
    """
    View render trang index.html.
    """
    return render(request, 'index.html')

def branch_geojson(request):
    """
    Tạo GeoJSON cho chi nhánh.
    """
    features = []
    for branch in BRANCH.objects.all():
        image_url = branch.hinh_anh.url if branch.hinh_anh else None  # Lấy URL nếu có ảnh

        features.append({
            "type": "Feature",
            "properties": {
                "name": branch.ten_chi_nhanh,
                "address": branch.dia_chi,
                "opening_time": branch.gio_mo_cua.strftime('%H:%M') if branch.gio_mo_cua else None,
                "closing_time": branch.gio_dong_cua.strftime('%H:%M') if branch.gio_dong_cua else None,
                "lai_suat": branch.lai_suat,
                "hinh_anh_url": image_url,  # Sử dụng URL của ảnh
            },
            "geometry": {
                "type": "Point",
                "coordinates": [branch.kinh_do, branch.vi_do]
            }
        })

    data = {
        "type": "FeatureCollection",
        "features": features
    }

    return JsonResponse(data)