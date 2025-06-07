from django.core.management.base import BaseCommand
import pandas as pd
import requests as rq
from io import BytesIO


class Command(BaseCommand):
    def get_latest_bizday(self, mktId='STK'):
        for i in range(10):
            day = pd.Timestamp.today() - pd.Timedelta(days=i)
            biz_day = day.strftime("%Y%m%d")
            df = self.download_krx_data(mktId, biz_day)
            if df['시가총액'].notna().sum() > 0:
                return biz_day
        raise Exception("Could not find a valid business day. Please check the market ID or the date range.")

    def download_krx_data(self, mktId, biz_day):
        headers = {
            'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36'
        }
        gen_otp_url = 'http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd'
        gen_otp_params = {
            'mktId': mktId,
            'trdDd': biz_day,
            'money': '1',
            'csvxls_isNo': 'false',
            'name': 'fileDown',
            'url': 'dbms/MDC/STAT/standard/MDCSTAT03901'
        }
        otp = rq.post(gen_otp_url, gen_otp_params, headers=headers).text
        down_url = 'http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd'
        response = rq.post(down_url, {'code': otp}, headers=headers)
        df = pd.read_csv(BytesIO(response.content), encoding='EUC-KR')
        return df

    def get_top7_per_sector(self, df):
        top7_by_sector = {}
        for sector, group in df.groupby('Sector'):
            top7 = group.sort_values(by='MarketCap', ascending=False).head(7)
            top7_by_sector[sector] = top7[['Company', 'Code', 'MarketCap']].reset_index(drop=True)
        return top7_by_sector

    def handle(self, *args, **options):
        # 코스피, 코스닥 데이터 다운로드
        sector_stk = self.download_krx_data('STK', self.get_latest_bizday('STK'))
        sector_ksq = self.download_krx_data('KSQ', self.get_latest_bizday('KSQ'))
        # 데이터 병합
        krx_sector = pd.concat([sector_stk, sector_ksq]).reset_index(drop=True)
        krx_sector = krx_sector[['업종명', '종목명', '종목코드', '시가총액']]
        krx_sector.columns = ['Sector', 'Company', 'Code', 'MarketCap']
        krx_sector['MarketCap'] = pd.to_numeric(krx_sector['MarketCap'], errors='coerce')
        sectors = sorted(krx_sector['Sector'].dropna().unique())
        print(f"\n총 {len(sectors)}개 섹터 목록:")
        for s in sectors:
            print("-", s)
        top7_by_sector = self.get_top7_per_sector(krx_sector)
        for sector, df_top7 in top7_by_sector.items():
            print(f"\n{sector} Sector MarketCap TOP 7:")
            print(df_top7.to_string(index=False))
