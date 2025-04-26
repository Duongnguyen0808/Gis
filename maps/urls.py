from django.urls import path
from . import views

app_name = 'maps'

urlpatterns = [
    path('VCB/', views.VCB, name="VCB"),
    path('api/geojson/branch/', views.branch_geojson, name='branch'),
    path('chat/message/', views.chat_api, name='chat_api'),
]