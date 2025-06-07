from django.core.management.base import BaseCommand
from api.models import Bill
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import json
import os
from django.db import transaction
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import backoff
FAILED_LOG = "failed_bill_nos.json"

class Command(BaseCommand):
    help = "OpenAPI에서 법안 데이터를 불러와 DB에 저장 또는 갱신"
    API_KEY = "803da807f8b847b1ba3c330f442ca708"

    def add_arguments(self, parser):
        parser.add_argument('--retry-failed', action='store_true', help='이전에 실패한 BILL_NO만 재시도')
        parser.add_argument('--summary-only', action='store_true', help='요약문만 수집')

    def log(self, message):
        now = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
        self.stdout.write(f"{now} {message}")

    def create_session(self):
        session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=(500, 502, 503, 504),
            allowed_methods=["GET"]
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("http://", adapter)
        session.mount("https://", adapter)
        session.headers.update({
            'User-Agent': 'NA-LawBot/1.0 (+https://cbnu-navi.net)'
        })
        return session

    def parse_date(self, value):
        try:
            return datetime.strptime(value, "%Y-%m-%d").date()
        except Exception:
            return None

    @backoff.on_exception(
        backoff.expo,
        (requests.exceptions.RequestException,),
        max_tries=5,
        jitter=backoff.full_jitter
    )
    def fetch_summary(self, session, url):
        try:
            res = session.get(url, timeout=5)
            res.raise_for_status()
            soup = BeautifulSoup(res.content, 'html.parser')
            div = soup.find("div", {"class": "textType02", "id": "summaryContentDiv"})
            if not div:
                self.stderr.write(f"[요약문 누락] URL: {url}")
            return div.get_text(separator="\n", strip=True) if div else ""
        except Exception as e:
            self.stderr.write(f"[요약문 오류] {url} - {e}")
            return ""

    @backoff.on_exception(
        backoff.expo,
        (requests.exceptions.RequestException,),
        max_tries=5,
        jitter=backoff.full_jitter
    )
    def fetch_bill_detail(self, session, bill_no):
        start_time = time.time()
        time.sleep(0.1)
        try:
            params = {
                'KEY': self.API_KEY,
                'Type': 'xml',
                'pIndex': 1,
                'pSize': 1,
                'BILL_NO': bill_no,
            }
            res = session.get("https://open.assembly.go.kr/portal/openapi/ALLBILL", params=params, timeout=10)
            res.raise_for_status()
            root = ET.fromstring(res.text)
            row = root.find(".//row")
            if row is None:
                self.stderr.write(f"[상세정보 누락] BILL_NO {bill_no}")
                return None

            return {
                'bill_no': bill_no,
                'row': row,
                'link': row.findtext("LINK_URL"),
                'duration': time.time() - start_time
            }
        except Exception as e:
            self.stderr.write(f"[상세 수집 오류] BILL_NO {bill_no} - {e}")
            return None

    def save_bill(self, session, detail):
        row = detail['row']
        bill_no = detail['bill_no']
        link = detail['link']

        existing = Bill.objects.filter(BILL_NO=bill_no).first()
        summary_text = ""
        if existing and existing.SUMMARY:
            summary_text = existing.SUMMARY
        elif link:
            summary_text = self.fetch_summary(session, link)

        defaults = {
            'AGE': row.findtext("ERACO"),
            'BILL_ID': row.findtext("BILL_ID"),
            'BILL_NO': bill_no,
            'BILL_KND': row.findtext("BILL_KND"),
            'BILL_NM': row.findtext("BILL_NM"),
            'PPSR_NM': row.findtext("PPSR_NM"),
            'PPSR_KND': row.findtext("PPSR_KND"),
            'PPSR_DT': self.parse_date(row.findtext("PPSL_DT")),
            'PPSR_SESS': int(row.findtext("PPSL_SESS") or 0),
            'JRCMIT_NM': row.findtext("JRCMIT_NM"),
            'JRCMIT_CMMT_DT': self.parse_date(row.findtext("JRCMIT_CMMT_DT")),
            'JRCMIT_PRSNT_DT': self.parse_date(row.findtext("JRCMIT_PRSNT_DT")),
            'JRCMIT_PROC_DT': self.parse_date(row.findtext("JRCMIT_PROC_DT")),
            'JRCMIT_PROC_RSL': row.findtext("JRCMIT_PROC_RSLT"),
            'LAW_CMMT_DT': self.parse_date(row.findtext("LAW_CMMT_DT")),
            'LAW_PRSNT_DT': self.parse_date(row.findtext("LAW_PRSNT_DT")),
            'LAW_PROC_DT': self.parse_date(row.findtext("LAW_PROC_DT")),
            'LAW_PROC_RSLT': row.findtext("LAW_PROC_RSLT"),
            'RGS_PRSNT_DT': self.parse_date(row.findtext("RGS_PRSNT_DT")),
            'RGS_RSLN_DT': self.parse_date(row.findtext("RGS_RSLN_DT")),
            'RGS_CONF_NM': row.findtext("RGS_CONF_NM"),
            'RGS_CONF_RSLT': row.findtext("RGS_CONF_RSLT"),
            'GVRN_TRSF_DT': self.parse_date(row.findtext("GVRN_TRSF_DT")),
            'PROM_LAW_NM': row.findtext("PROM_LAW_NM"),
            'LAW_SECTOR': '',
            'PROM_DT': self.parse_date(row.findtext("PROM_DT")),
            'PROM_NO': int(row.findtext("PROM_NO") or 0),
            'LINK_URL': link,
            'SUMMARY': summary_text,
            'COMMENTS': {},
        }

        try:
            with transaction.atomic():
                existing = Bill.objects.filter(BILL_NO=bill_no).first()
                if existing:
                    for k, v in defaults.items():
                        if getattr(existing, k) != v:
                            Bill.objects.update_or_create(BILL_NO=bill_no, defaults=defaults)
                            return True
                    return False  # 저장 생략
                else:
                    Bill.objects.create(**defaults)
                    return True
        except Exception as e:
            self.stderr.write(f"[DB 저장 오류] BILL_NO {bill_no} - {e}")
            return False

    def fetch_and_update_summaries(self, session, bill_nos):
        self.log(f"총 {len(bill_nos)}개 법안 요약문 수집 시작")
        updated_count = 0
        failed = []

        for i, bill_no in enumerate(bill_nos, 1):
            try:
                bill = Bill.objects.get(BILL_NO=bill_no)
                link = bill.LINK_URL
                if not link:
                    self.stderr.write(f"[링크 누락] BILL_NO {bill_no}")
                    failed.append(bill_no)
                    continue

                summary_text = self.fetch_summary(session, link)
                if summary_text and summary_text != bill.SUMMARY:
                    bill.SUMMARY = summary_text
                    bill.save(update_fields=['SUMMARY'])
                    updated_count += 1

                if i % 100 == 0:
                    self.log(f"[진행상황] {i}/{len(bill_nos)} 요약문 업데이트 {updated_count}건")

            except Bill.DoesNotExist:
                self.stderr.write(f"[DB 누락] BILL_NO {bill_no}")
                failed.append(bill_no)
            except Exception as e:
                self.stderr.write(f"[요약문 업데이트 실패] BILL_NO {bill_no} - {e}")
                failed.append(bill_no)

        self.log(f"요약문 수집 완료: {updated_count}건 업데이트, 실패 {len(failed)}건")
        if failed:
            with open(FAILED_LOG, 'w', encoding='utf-8') as f:
                json.dump(failed, f, ensure_ascii=False, indent=2)
            self.stderr.write(f"실패한 BILL_NO {len(failed)}건 {FAILED_LOG}에 저장됨")
        else:
            if os.path.exists(FAILED_LOG):
                os.remove(FAILED_LOG)
            self.log("실패 없이 완료")

    def handle(self, *args, **options):
        session = self.create_session()
        retry_only = options.get('retry_failed', False)
        summary_only = options.get('summary_only', False)

        if summary_only:
            self.log("요약문 수집 모드 실행")
            bill_nos = list(Bill.objects.values_list('BILL_NO', flat=True))
            self.fetch_and_update_summaries(session, bill_nos)
            return

        if retry_only:
            self.log("실패한 BILL_NO 재시도 모드 실행")
            if not os.path.exists(FAILED_LOG):
                self.stderr.write(f"{FAILED_LOG} 파일 없음. 전체 실행 먼저 필요.")
                return

            with open(FAILED_LOG) as f:
                failed_nos = json.load(f)

            self.run_pipeline(session, failed_nos)
        else:
            try:
                params = {
                    'KEY': self.API_KEY,
                    'Type': 'xml',
                    'pIndex': 1,
                    'pSize': 1,
                }
                res = session.get("https://open.assembly.go.kr/portal/openapi/BILLRCP", params=params, timeout=10)
                res.raise_for_status()
                root = ET.fromstring(res.text)
                api_total_count = int(root.findtext(".//list_total_count") or 0)
            except Exception as e:
                self.stderr.write(f"[API 총개수 조회 실패] {e}")
                api_total_count = 0

            db_total_count = Bill.objects.count()

            self.log(f"API 총개수: {api_total_count}, DB 총개수: {db_total_count}")

            if api_total_count > db_total_count:
                self.log("API 목록 새로 수집 시작")
                bill_map = {}
                page = 1
                while True:
                    try:
                        params = {
                            'KEY': self.API_KEY,
                            'Type': 'xml',
                            'pIndex': page,
                            'pSize': 1000,
                        }
                        res = session.get("https://open.assembly.go.kr/portal/openapi/BILLRCP", params=params,
                                          timeout=10)
                        res.raise_for_status()
                        root = ET.fromstring(res.text)
                        rows = root.findall(".//row")
                        if not rows:
                            break
                        for row in rows:
                            bill_no = row.findtext("BILL_NO")
                            if bill_no:
                                bill_map[bill_no] = True
                        self.log(f"{page}페이지 완료 (누적 {len(bill_map)}건)")
                        page += 1
                    except Exception as e:
                        self.stderr.write(f"[목록 수집 실패] 페이지 {page} - {e}")
                        break

                self.log(f"총 {len(bill_map)}개 BILL_NO 수집 완료")
                self.run_pipeline(session, list(bill_map.keys()))
            else:
                self.log("DB에 최신 목록 존재. DB 데이터를 기반으로 상세 처리 진행")

                bills = Bill.objects.values('BILL_NO')
                bill_map = [bill['BILL_NO'] for bill in bills]

                self.log(f"총 {len(bill_map)}개 법안 DB에서 불러옴")
                self.run_pipeline(session, bill_map)

    def run_pipeline(self, session, bill_nos):
        self.log("상세 수집 시작")
        details = []
        failed = []

        total_start = time.time()
        total_duration = 0
        durations = []

        with ThreadPoolExecutor(max_workers=12) as executor:
            futures = [executor.submit(self.fetch_bill_detail, session, bill_no) for bill_no in bill_nos]
            for i, f in enumerate(as_completed(futures), 1):
                result = f.result()
                if result:
                    details.append(result)
                    if 'duration' in result:
                        durations.append(result['duration'])
                        total_duration += result['duration']
                else:
                    failed.append(bill_nos[i-1])
                if i % 100 == 0:
                    avg_duration = total_duration / len(durations) if durations else 0
                    tps = i / (time.time() - total_start)
                    self.log(f"[진행상황] {i}/{len(bill_nos)} - 평균 응답 시간: {avg_duration:.2f}s, TPS: {tps:.2f}/sec")

        self.log(f"상세 수집 완료: {len(details)} 성공, {len(failed)} 실패")
        self.log(f"총 소요 시간: {time.time() - total_start:.2f}s / 평균 응답 시간: {total_duration / len(durations):.2f}s")

        self.log("DB 저장 시작")
        saved, skipped = 0, 0
        retry_failed = []
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(self.save_bill, session, detail) for detail in details]
            for f in as_completed(futures):
                try:
                    result = f.result()
                    if result:
                        saved += 1
                    else:
                        skipped += 1
                    self.log(f"[진행상황] {saved+skipped}/{len(details)} - {saved} 저장됨, {skipped} 저장 생략")
                except:
                    retry_failed.append(details['bill_no'])

        self.log(f"[저장 완료] {saved+skipped}/{len(details)} - {saved} 저장됨, {skipped} 저장 생략")

        all_failed = list(set(failed + retry_failed))
        if all_failed:
            with open(FAILED_LOG, 'w') as f:
                json.dump(all_failed, f, ensure_ascii=False, indent=2)
            self.stderr.write(f"실패한 BILL_NO {len(all_failed)}건 {FAILED_LOG}에 저장됨")
        else:
            if os.path.exists(FAILED_LOG):
                os.remove(FAILED_LOG)
            self.log("실패 없이 완료")
