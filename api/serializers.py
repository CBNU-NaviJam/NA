from rest_framework import serializers
from .models import Bill


class BillDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = '__all__'


class BillListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bill
        fields = ['AGE', 'BILL_NO', 'BILL_NM', 'PPSR_NM', 'PPSR_DT', 'PROC_RSLT']