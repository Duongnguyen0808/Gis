from rest_framework import serializers
from .models import Vietcombank

class VietcombankSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vietcombank
        fields = '__all__'

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Chuyển đổi PointField sang dạng JSON có thể đọc được
        if instance.toa_do:
            representation['toa_do'] = {
                'latitude': instance.toa_do.y,  # vĩ độ
                'longitude': instance.toa_do.x  # kinh độ
            }
        return representation