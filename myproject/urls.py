from django.contrib import admin
from django.urls import path, include  
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', views.homepage, name='homepage'),  
    path('gioi-thieu/', views.aboutpage, name='about'),
    path('posts/', include('posts.urls', namespace="posts")),
    path('maps/', include('maps.urls'))
]
