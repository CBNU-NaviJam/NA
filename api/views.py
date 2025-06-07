from rest_framework import generics
from .models import Bill
from .serializers import BillDetailSerializer, BillListSerializer
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
import json
import pandas as pd
import requests as rq
from io import BytesIO
import FinanceDataReader as fdr
from datetime import datetime, timedelta, time
from django.views.decorators.http import require_GET
from groq import Groq
import codecs


class BillListView(generics.ListAPIView):
    serializer_class = BillListSerializer

    fixed_ages = [
        "제헌",
        "제1대",
        "제2대",
        "제3대",
        "제4대",
        "제5대",
        "국가재건최고회의",
        "제6대",
        "제7대",
        "제8대",
        "비상국무회의",
        "제9대",
        "제10대",
        "국가보위입법회의",
        "제11대",
        "제12대",
        "제13대",
        "제14대",
        "제15대",
        "제16대",
        "제17대",
        "제18대",
        "제19대",
        "제20대",
        "제21대",
        "제22대",
    ]

    def get_session_range(self, start, end, session_list):
        try:
            start_idx = session_list.index(start.split(' ')[0])
            end_idx = session_list.index(end.split(' ')[0])
        except ValueError:
            return []

        if start_idx <= end_idx:
            return session_list[start_idx:end_idx + 1]
        else:
            return session_list[end_idx:start_idx + 1]

    def get_queryset(self):
        queryset = Bill.objects.all()
        # AGE Filtering
        start_age = self.request.query_params.get('start_age', None)
        end_age = self.request.query_params.get('end_age', None)
        if start_age and end_age:
            session_range = self.get_session_range(start_age, end_age, self.fixed_ages)
            queryset = queryset.filter(AGE__in=session_range)
        # Bill Number Filtering
        bill_no = self.request.query_params.get('bill_no', None)
        if bill_no:
            queryset = queryset.filter(BILL_NO=bill_no)
        # Bill Name Filtering
        bill_nm = self.request.query_params.get('bill_nm', None)
        if bill_nm:
            queryset = queryset.filter(BILL_NM__icontains=bill_nm)
        # Bill Kind Filtering
        bill_knd = self.request.query_params.get('bill_knd', None)
        if bill_knd:
            queryset = queryset.filter(BILL_KND=bill_knd)
        # Proposer kind Filtering
        ppsr_knd = self.request.query_params.get('ppsr_knd', None)
        if ppsr_knd:
            queryset = queryset.filter(PPSR_KND=ppsr_knd)
        # Proposer Name Filtering
        ppsr_nm = self.request.query_params.get('ppsr_nm', None)
        if ppsr_nm:
            queryset = queryset.filter(PPSR_NM__icontains=ppsr_nm)
        # Proposing date filtering
        ppsr_dt_from = self.request.query_params.get('ppsr_dt_from', None)
        ppsr_dt_to = self.request.query_params.get('ppsr_dt_to', None)
        if ppsr_dt_from and ppsr_dt_to:
            queryset = queryset.filter(PPSR_DT__range=[ppsr_dt_from, ppsr_dt_to])
        # Proposing session filtering
        ppsr_sess_from = self.request.query_params.get('ppsr_sess_from', None)
        ppsr_sess_to = self.request.query_params.get('ppsr_sess_to', None)
        if ppsr_sess_from and ppsr_sess_to:
            queryset = queryset.filter(PPSR_SESS__range=[ppsr_sess_from, ppsr_sess_to])
        # JRCMIT Name filtering
        jrcmitnm = self.request.query_params.get('jrcmitnm', None)
        if jrcmitnm:
            queryset = queryset.filter(JRCMIT_NM=jrcmitnm)
        # JRCMIT result filtering
        jrcmitprocrsl = self.request.query_params.get('jrcmitprocrsl', None)
        if jrcmitprocrsl:
            queryset = queryset.filter(JRCMIT_PROC_RSL=jrcmitprocrsl)
        # RGS result filtering
        rgsconfrslt = self.request.query_params.get('rgsconfrslt', None)
        if rgsconfrslt:
            queryset = queryset.filter(RGS_CONF_RSLT__in=[x.strip() for x in rgsconfrslt.split('/')])
        return queryset


class BillDetailView(generics.RetrieveAPIView):
    queryset = Bill.objects.all()
    serializer_class = BillDetailSerializer
    lookup_field = 'BILL_NO'

@csrf_exempt
def add_comment(request, bill_id):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            name = data.get('name')
            vote = data.get('vote')
            content = data.get('text')

            if not all([name, vote, content]):
                return JsonResponse({'error': '모든 항목을 입력해주세요.'}, status=400)

            bill = get_object_or_404(Bill, BILL_NO=bill_id)  # <- BILL_NO 또는 실제 필드명으로 변경
            new_comment = {"name": name, "vote": vote, "content": content}

            comments = bill.COMMENTS or []
            comments.append(new_comment)
            bill.COMMENTS = comments
            bill.save()

            return JsonResponse({'message': '의견 저장됨', 'comments': bill.COMMENTS})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


def valid_prom_bills(request):
    query = request.GET.get('query', None)
    sector = request.GET.get('sector', None)
    filters = {'PROM_DT__isnull': False}

    if sector and sector != '전체':
        filters['LAW_SECTOR'] = sector

    if query and query != '':
        filters['BILL_NM__icontains'] = query

    data = list(
        Bill.objects
            .filter(**filters)
            .values('LAW_SECTOR', 'BILL_NO', 'BILL_NM', 'PROM_DT')
    )
    return JsonResponse(data, safe=False)

# 기업 분류 처리 /api/companies
sector_classification = {
    "정보기술": ["IT 서비스", "전기·전자"],
    "산업재": ["건설", "기계·장비", "운송·창고", "운송장비·부품", "유통", "기타제조"],
    "자유소비재": ["출판·매체복제", "섬유·의류", "오락·문화", "일반서비스"],
    "헬스케어": ["의료·정밀기기", "제약"],
    "소재": ["화학", "금속", "비금속", "농업, 임업 및 어업", "종이·목재"],
    "통신서비스": ["통신"],
    "금융": ["금융", "기타금융", "보험", "은행", "증권"],
    "필수소비재": ["음식료·담배"],
    "에너지": ["전기·가스", "전기·가스·수도"],
    "유틸리티": ["전기·가스", "전기·가스·수도"],
    "부동산": ["부동산"],
}


def get_latest_bizday(mktId='STK'):
    for i in range(10):
        day = pd.Timestamp.today() - pd.Timedelta(days=i)
        biz_day = day.strftime("%Y%m%d")
        try:
            df = download_krx_data(mktId, biz_day)
            if df['시가총액'].notna().sum() > 0:
                return biz_day
        except Exception:
            continue
    raise Exception("사업일을 찾을 수 없습니다.")


def download_krx_data(mktId, biz_day):
    headers = {
        'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader',
        'User-Agent': 'Mozilla/5.0'
    }
    gen_otp_url = 'http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd'
    gen_otp_params = {
        'mktId': mktId,
        'trdDd': biz_day,
        'money': '1',
        'csvxls_isNo': 'false',
        'name': 'fileDown',
        'url': 'dbms/MDC/STAT/standard/MDCSTAT03901' if mktId != 'ALL' else 'dbms/MDC/STAT/standard/MDCSTAT01901'
    }
    otp = rq.post(gen_otp_url, gen_otp_params, headers=headers).text
    down_url = 'http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd'
    response = rq.post(down_url, {'code': otp}, headers=headers)
    df = pd.read_csv(BytesIO(response.content), encoding='EUC-KR')
    return df


def get_top7_per_main_sector(df, prom_dt):
    df = df[['업종명', '종목명', '종목코드', '시가총액']]
    df.columns = ['Sector', 'Company', 'Code', 'MarketCap']
    # 해당 종목 상장 정보 조회
    headers = {
        'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader',
        'User-Agent': 'Mozilla/5.0'
    }
    gen_otp_url = 'http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd'
    trdDd = get_latest_bizday('STK')
    gen_otp_params = {
        'mktId': 'ALL',
        'trdDd': get_latest_bizday('STK') if trdDd else get_latest_bizday('KSQ'),
        'money': '1',
        'csvxls_isNo': 'false',
        'name': 'fileDown',
        'url': 'dbms/MDC/STAT/standard/MDCSTAT01901'
    }
    otp = rq.post(gen_otp_url, gen_otp_params, headers=headers).text
    down_url = 'http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd'
    response = rq.post(down_url, {'code': otp}, headers=headers)
    df_list = pd.read_csv(BytesIO(response.content), encoding='EUC-KR')
    df_list = df_list[['단축코드', '상장일']].copy()
    df_list.columns = ['Code', 'ListingDate']
    df_list['ListingDate'] = pd.to_datetime(df_list['ListingDate'], format='%Y/%m/%d', errors='coerce')
    df = pd.merge(df, df_list, on='Code', how='inner')
    df['MarketCap'] = pd.to_numeric(df['MarketCap'], errors='coerce')
    df = df[df['ListingDate'] + pd.Timedelta(days=90) <= prom_dt]
    df['MainSector'] = None

    for main_sector, sub_sectors in sector_classification.items():
        df.loc[df['Sector'].isin(sub_sectors), 'MainSector'] = main_sector

    df = df.dropna(subset=['MainSector'])
    top7_by_sector = {}
    for sector, group in df.groupby('MainSector'):
        top7 = group.sort_values(by='MarketCap', ascending=False).head(7)
        top7_by_sector[sector] = top7[['Company', 'Code', 'MarketCap', 'ListingDate']].to_dict(orient='records')
    return top7_by_sector


def top7_companies_by_sector(request):
    try:
        bizday_stk = get_latest_bizday('STK')
        bizday_ksq = get_latest_bizday('KSQ')

        df_stk = download_krx_data('STK', bizday_stk)
        df_ksq = download_krx_data('KSQ', bizday_ksq)

        df = pd.concat([df_stk, df_ksq])
        result = get_top7_per_main_sector(df, request.GET.get('prom_dt'))
        return JsonResponse(result, json_dumps_params={'ensure_ascii': False})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# 기업별 주가 조회 /api/stock?code=<code>
def get_nearest_bizday(df, target_date_str):
    if target_date_str in df['Date'].values:
        return target_date_str
    all_dates = pd.to_datetime(df['Date'])
    target_date = pd.to_datetime(target_date_str)
    nearest = all_dates.iloc[(all_dates - target_date).abs().argsort().iloc[0]]
    return nearest.strftime('%Y-%m-%d')


@require_GET
def stock_data(request):
    code = request.GET.get('code')
    prom_dt = request.GET.get('prom_dt')  # 'YYYY-MM-DD' 형식
    if not code or not prom_dt:
        return JsonResponse({'error': 'Invalid parameters'}, status=400)

    prom_date = datetime.strptime(prom_dt, '%Y-%m-%d')
    # 해당 종목 상장 정보 조회
    headers = {
        'Referer': 'http://data.krx.co.kr/contents/MDC/MDI/mdiLoader',
        'User-Agent': 'Mozilla/5.0'
    }
    gen_otp_url = 'http://data.krx.co.kr/comm/fileDn/GenerateOTP/generate.cmd'
    trdDd = get_latest_bizday('STK')
    gen_otp_params = {
        'mktId': 'ALL',
        'trdDd': get_latest_bizday('STK') if trdDd else get_latest_bizday('KSQ'),
        'money': '1',
        'csvxls_isNo': 'false',
        'name': 'fileDown',
        'url': 'dbms/MDC/STAT/standard/MDCSTAT01901'
    }
    otp = rq.post(gen_otp_url, gen_otp_params, headers=headers).text
    down_url = 'http://data.krx.co.kr/comm/fileDn/download_csv/download.cmd'
    response = rq.post(down_url, {'code': otp}, headers=headers)
    df_list = pd.read_csv(BytesIO(response.content), encoding='EUC-KR')
    stock_info = df_list[df_list['단축코드'] == code]
    if stock_info.empty:
        return JsonResponse({'error': 'Invalid stock code'}, status=400)

    # 상장일 정보 추출
    listing_date_str = stock_info['상장일'].values[0]
    if isinstance(listing_date_str, str):
        listing_date = datetime.strptime(listing_date_str, '%Y/%m/%d')
    else:
        listing_date = pd.to_datetime(listing_date_str).to_pydatetime()

    today = datetime.today()

    # 60일 전, 60일 후 계산 및 보정
    start_date = max(listing_date, prom_date - timedelta(days=120))
    end_date = min(today, prom_date + timedelta(days=120))

    print(f"Fetching data for {code} from {start_date.date()} to {end_date.date()}")

    # fdr에서 범위 지정해서 데이터 불러오기
    df = fdr.DataReader(f"KRX:{code}", start_date.date(), end_date.date())
    if df.empty:
        return JsonResponse({'error': 'No stock data available'}, status=404)

    df.reset_index(inplace=True)
    df['Date'] = df['Date'].dt.strftime('%Y-%m-%d')

    # 보정된 prom_dt 찾기
    adjusted_prom_dt = get_nearest_bizday(df, prom_dt)

    # 분석용 함수
    def volatility_around_range(date, days=30, column='Close'):
        date = pd.to_datetime(date)
        start = (date - pd.Timedelta(days=days)).strftime('%Y-%m-%d')
        end = (date + pd.Timedelta(days=days)).strftime('%Y-%m-%d')
        mask = (df['Date'] >= start) & (df['Date'] <= end)
        data_range = df.loc[mask]
        pct_change = data_range[column].pct_change()
        return round(pct_change.iloc[1] * 100, 2) if days == 1 else round(pct_change.std() * 100, 2)

    client = Groq(api_key="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")  # Groq에서 발급받은 키
    analysis = {
        f"법률 시행 1일 전후 주가 변동성": {volatility_around_range(adjusted_prom_dt, 1, 'Close')},
        f"법률 시행 30일 전후 주가 변동성": {volatility_around_range(adjusted_prom_dt, 30, 'Close')},
        f"법률 시행 60일 전후 주가 변동성": {volatility_around_range(adjusted_prom_dt, 60, 'Close')},
        f"법률 시행 1일 전후 거래량 변동성": {volatility_around_range(adjusted_prom_dt, 1, 'Volume')},
        f"법률 시행 30일 전후 거래량 변동성": {volatility_around_range(adjusted_prom_dt, 30, 'Volume')},
        f"법률 시행 60일 전후 거래량 변동성": {volatility_around_range(adjusted_prom_dt, 60, 'Volume')}
    }
    prompt = f"""
    {analysis}
    위 데이터를 보고 요약된 종합 평가 및 향후 비슷한 법률 시행 시 미칠 영향 예측을 줄바꿈 최소화하여 시작말 없이 하나의 글로 작성.
    """
    response = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=300,
    )
    print(len(df['Date'].tolist()), len(df['Close'].tolist()), len(df['Volume'].tolist()))
    result = {
        'chart': {
            'labels': df['Date'].tolist(),
            'prices': df['Close'].tolist(),
            'volumes': df['Volume'].tolist(),
        },
        'analysis': {
            'close_after': volatility_around_range(adjusted_prom_dt, 1, 'Close'),
            'close_before_30': volatility_around_range(adjusted_prom_dt, 30, 'Close'),
            'close_before_60': volatility_around_range(adjusted_prom_dt, 60, 'Close'),
            'volume_after': volatility_around_range(adjusted_prom_dt, 1, 'Volume'),
            'volume_before_30': volatility_around_range(adjusted_prom_dt, 30, 'Volume'),
            'volume_before_60': volatility_around_range(adjusted_prom_dt, 60, 'Volume'),
        },
        'adjusted_prom_dt': adjusted_prom_dt,
        'evaluation': response.choices[0].message.content,
    }

    return JsonResponse(
        result,
        json_dumps_params={'ensure_ascii': False},
        content_type='application/json; charset=utf-8'
    )

