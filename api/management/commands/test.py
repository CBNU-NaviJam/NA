import pandas as pd
from django.core.management.base import BaseCommand, CommandError
import os

class Command(BaseCommand):
    help = '엑셀 파일의 2열 값이 "기타"인 행을 제거하고 새 파일로 저장합니다.'

    def add_arguments(self, parser):
        parser.add_argument('excel_path', type=str, help='입력 엑셀 파일 경로')
        parser.add_argument('--output', type=str, help='출력 엑셀 파일 경로 (기본: *_no_etc.xlsx)', default=None)

    def handle(self, *args, **options):
        excel_path = options['excel_path']
        output_path = options['output']

        if not os.path.exists(excel_path):
            raise CommandError(f"입력 파일이 존재하지 않습니다: {excel_path}")

        try:
            df = pd.read_excel(excel_path)
            second_col = df.columns[1]

            self.stdout.write(f"🎯 대상 컬럼: {second_col}")
            before = len(df)

            # '기타' 아닌 행만 유지
            df_clean = df[df[second_col] != '기타']
            after = len(df_clean)

            # 저장 경로 자동 생성 (입력명 기반)
            if not output_path:
                base, ext = os.path.splitext(excel_path)
                output_path = f"{base}_no_etc{ext}"

            df_clean.to_excel(output_path, index=False)
            self.stdout.write(self.style.SUCCESS(f"✅ 저장 완료: {output_path}"))
            self.stdout.write(f"   - 원본 행 수: {before}")
            self.stdout.write(f"   - 제거 후: {after}")
            self.stdout.write(f"   - 제거된 행 수: {before - after}")

        except Exception as e:
            raise CommandError(f"처리 중 오류 발생: {str(e)}")
