# myproject/urls.py

from django.contrib import admin
from django.urls import path, include
from . import views  # <<< THÊM DÒNG NÀY VÀO
from django.conf.urls.static import static
from django.conf import settings

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.homepage, name='homepage'), # Dòng này giờ sẽ không lỗi nữa
    path('gioi-thieu/', views.aboutpage, name='about'), # Đảm bảo views.aboutpage cũng tồn tại trong myproject/views.py
    path('maps/', include('maps.urls')),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)