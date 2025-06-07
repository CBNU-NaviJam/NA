from django.core.management.base import BaseCommand
from api.models import Bill
import pandas as pd


class Command(BaseCommand):
    help = 'Export bills with PROM_DT to Excel'
    def handle(self, *args, **kwargs):
        bills = Bill.objects.filter(PROM_DT__isnull=False).values_list('BILL_NM', flat=True)
        df = pd.DataFrame({'BILL_NM': bills})
        df.to_excel('bills_with_prom_dt.xlsx', index=False)
        self.stdout.write(self.style.SUCCESS('✅ PROM_DT 있는 BILL_NM만 저장 완료!'))
