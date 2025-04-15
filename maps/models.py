from django.db import models

class BRANCH(models.Model):
    """
    Model đại diện cho một chi nhánh ngân hàng.
    """
    ten_chi_nhanh = models.CharField(max_length=255, verbose_name="Tên chi nhánh")
    dia_chi = models.TextField(verbose_name="Địa chỉ")
    kinh_do = models.FloatField(verbose_name="Kinh độ")  # longitude
    vi_do = models.FloatField(verbose_name="Vĩ độ")    # latitude
    gio_mo_cua = models.TimeField(verbose_name="Giờ mở cửa")
    gio_dong_cua = models.TimeField(verbose_name="Giờ đóng cửa")
    lai_suat = models.FloatField(verbose_name="Lãi suất", null=True, blank=True)
    hinh_anh = models.ImageField(upload_to='branch_images/', verbose_name="Hình ảnh", null=True, blank=True)

    def __str__(self):
        """
        Trả về tên chi nhánh khi đối tượng được biểu diễn dưới dạng chuỗi.
        """
        return self.ten_chi_nhanh