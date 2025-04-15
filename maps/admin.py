from django.contrib import admin
from .models import BRANCH

class BRANCHAdmin(admin.ModelAdmin):
    list_display = ('ten_chi_nhanh', 'dia_chi', 'gio_mo_cua', 'gio_dong_cua', 'lai_suat', 'hinh_anh')
    search_fields = ('ten_chi_nhanh', 'dia_chi')
    list_filter = ('gio_mo_cua', 'gio_dong_cua')

admin.site.register(BRANCH, BRANCHAdmin)