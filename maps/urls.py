from django.urls import path
from . import views  # Thêm dòng này!

app_name = 'maps'

urlpatterns = [
    path('VCB/', views.VCB, name="VCB"),
    path('api/geojson/branch/', views.branch_geojson, name='branch'),
]