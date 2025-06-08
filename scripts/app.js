import {Pagination} from './pagination.js';
const pages = document.querySelectorAll('.page');
// ? 이후를 제거한 페이지 ID만 반환
function sanitizePageId(pageId) {
    return pageId?.split('?')[0] || 'home';
}
// 현재 페이지 표시
function showPage(pageId) {
    const id = sanitizePageId(pageId);
    pages.forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    } else {
        navigate('notfound');
    }
    if(id === 'home'){
        let listBody = document.querySelector('.home-list-body');
        if (!listBody) {
            fetch('/api/bills')
                .then(res => res.json())
                .then(data => {
                    const bills = data.results || data;
                    renderList(bills,
                        'bill',
                        'home-list-header',
                        'home-list-body',
                        'home-pagination',
                        'home-pagination-link',
                        ['번호', '대수', '의안번호', '의안명', '제안자', '제안일', '처리구분'],
                        '/css/homePagination.css',
                        '#home');
                })
                .catch(err => console.error('의안 목록 로딩 실패: ', err));
        }
    }else if (id === 'bill') {
        const billNo = new URLSearchParams(pageId.split('?')[1] || '').get('bill_no');
        if (billNo) {
            // 테이블 초기화
            document.querySelectorAll('.table-card').forEach(card => {
                const tbody = card.querySelector('tbody');
                if (tbody) {
                    tbody.remove();  // tbody 전체 제거
                }
            });
            fetch(`/api/bills/${billNo}`)
                .then(res => res.json())
                .then(data => {
                    // 제목 갱신
                    document.querySelector('.bill-section-title').textContent =
                        `[${data.BILL_NO}] ${data.BILL_NM}`;
                    // 접수정보 테이블
                    const receiveTable = document.querySelectorAll('.table-card')[0].querySelector('table');
                    receiveTable.innerHTML += `
                    <tbody>
                        <tr>
                            <td>${data.AGE || '-'}</td>
                            <td>${data.PPSR_SESS || '-'}</td>
                            <td>${data.BILL_KND || '-'}</td>
                            <td>${data.BILL_NM || '-'}</td>
                            <td>${data.PPSR_NM || '-'}</td>
                            <td>${data.PPSR_DT || '-'}</td>
                        </tr>
                    </tbody>`;
                    // 주요내용
                    document.querySelector('.bill-summary').textContent = data.SUMMARY || '내용 없음';
                    // 소관위 심사정보
                    const jrTable = document.querySelectorAll('.table-card')[1].querySelector('table');
                    jrTable.innerHTML += `
                    <tbody>
                        <tr>
                            <td>${data.JRCMIT_NM || '-'}</td>
                            <td>${data.JRCMIT_CMMT_DT || '-'}</td>
                            <td>${data.JRCMIT_PRSNT_DT || '-'}</td>
                            <td>${data.JRCMIT_PROC_DT || '-'}</td>
                            <td>${data.JRCMIT_PROC_RSL || '-'}</td>
                        </tr>
                    </tbody>`;
                    // 법사위 심사정보
                    const lawTable = document.querySelectorAll('.table-card')[2].querySelector('table');
                    lawTable.innerHTML += `
                    <tbody>
                        <tr>
                            <td>${data.LAW_CMMT_DT || '-'}</td>
                            <td>${data.LAW_PRSNT_DT || '-'}</td>
                            <td>${data.LAW_PROC_DT || '-'}</td>
                            <td>${data.LAW_PROC_RSLT || '-'}</td>
                        </tr>
                    </tbody>`;
                    // 본회의 심의정보
                    const mainTable = document.querySelectorAll('.table-card')[3].querySelector('table');
                    mainTable.innerHTML += `
                    <tbody>
                        <tr>
                            <td>${data.RGS_CONF_NM || '-'}</td>
                            <td>${data.RGS_PRSNT_DT || '-'}</td>
                            <td>${data.RGS_RSLN_DT || '-'}</td>
                            <td>${data.RGS_CONF_RSLT || '-'}</td>
                        </tr>
                    </tbody>`;
                    // 정부이송
                    const govTable = document.querySelectorAll('.table-card')[4].querySelector('table');
                    govTable.innerHTML += `
                    <tbody>
                        <tr>
                            <td>${data.GVRN_TRSF_DT || '-'}</td>
                            <td>${data.PROM_NO || '-'}</td>
                            <td>${data.PROM_LAW_NM || '-'}</td>
                            <td>${data.PROM_DT || '-'}</td>
                        </tr>
                    </tbody>`;
                    // 의견 테이블
                    const tbody = document.querySelector('.opinion-table tbody');
                    tbody.innerHTML = '';

                    let agreeCount = 0, disagreeCount = 0;
                    const rawComments = data.COMMENTS || [];
                    const comments = Array.isArray(rawComments)
                        ? rawComments
                        : typeof rawComments === 'object' && rawComments !== null
                            ? Object.values(rawComments)
                            : [];

                    comments.forEach(op => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                                    <td>${op.name}</td>
                                    <td>${op.vote}</td>
                                    <td>${op.content}</td>`;
                        tbody.appendChild(tr);
                        if (op.vote === '찬성') agreeCount++;
                        else if (op.vote === '반대') disagreeCount++;
                    });
                    const total = agreeCount + disagreeCount || 1;
                    const agreeRatio = (agreeCount / total * 100).toFixed(0);
                    const disagreeRatio = (disagreeCount / total * 100).toFixed(0);
                    const agreeBar = document.querySelector('.agree');
                    const disagreeBar = document.querySelector('.disagree');
                    agreeBar.style.width = `${agreeRatio}%`;
                    disagreeBar.style.width = `${disagreeRatio}%`;
                    agreeBar.textContent = `찬성 ${agreeCount}표(${agreeRatio}%)`;
                    disagreeBar.textContent = `${disagreeCount}표(${disagreeRatio}%) 반대`;
                })
                .catch(err => console.error('의안 상세 정보 로딩 실패: ', err));
        }
    }
    else if(id === 'searched'){
        document.querySelector('#searched').innerHTML = `
    <div class="searched-header">
        <h1>🔍 검색 결과</h1>
        <p id="search-count" class="search-count"></p>
    </div>
`;
        const params = new URLSearchParams(pageId?.split('?')[1] || '');
        const isQuick = Number(params.get('quick'));
        if(isQuick){
            fetch(`/api/bills?bill_nm=${params.get('query')}`)
                .then(res => res.json())
                .then(data => {
                    const bills = data.results || data;
                    document.querySelector('#search-count').textContent = `총 ${bills.length}건이 검색되었습니다.`;
                    renderList(bills,
                        'bill',
                        'searched-list-header',
                        'searched-list-body',
                        'searched-pagination',
                        'searched-pagination-link',
                        ['번호', '대수', '의안번호', '의안명', '제안자', '제안일', '처리구분'],
                        '/css/searchedPagination.css',
                        '#searched');
                })
                .catch(err => console.error('의안 간편검색 목록 로딩 실패: ', err));
        }else{
            fetch(`/api/bills?${params.toString()}`)
                .then(res => res.json())
                .then(data => {
                    const bills = data.results || data;
                    document.querySelector('#search-count').textContent = `총 ${bills.length}건이 검색되었습니다.`;
                    renderList(bills,
                        'bill',
                        'searched-list-header',
                        'searched-list-body',
                        'searched-pagination',
                        'searched-pagination-link',
                        ['번호', '대수', '의안번호', '의안명', '제안자', '제안일', '처리구분'],
                        '/css/searchedPagination.css',
                        '#searched');
                })
                .catch(err => console.error('의안 상세검색 목록 로딩 실패: ', err));
        }
    }else if(id === 'laws'){
        const params = new URLSearchParams(pageId?.split('?')[1] || '');
        const sector = params.get('sector');
        const query = params.get('query');
        if(sector && sector !== '전체') {
            fetch('/api/valid-prom-bills/?query=' + encodeURIComponent(query) + '&sector=' + encodeURIComponent(sector), { method: 'GET' })
                .then(res => res.json())
                .then(data => {
                    renderList(data.results || data,
                        'law',
                        'laws-list-header',
                        'laws-list-body',
                        'laws-pagination',
                        'laws-pagination-link',
                        ['번호', '분류', '의안번호', '법률명', '공포일'],
                        '/css/lawsPagination.css',
                        '#laws');
                })
                .catch(err => console.error("공포된 법률 목록 로딩 실패:", err));
        }else{
            let url = '/api/valid-prom-bills/';
            if (query && query !== '') url += '?query=' + encodeURIComponent(query);
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    renderList(data.results || data,
                        'law',
                        'laws-list-header',
                        'laws-list-body',
                        'laws-pagination',
                        'laws-pagination-link',
                        ['번호', '분류', '의안번호', '법률명', '공포일'],
                        '/css/lawsPagination.css',
                        '#laws');
                })
                .catch(err => console.error("공포된 법률 목록 로딩 실패:", err));
        }
    }else if(id === 'market'){
        const params = new URLSearchParams(pageId?.split('?')[1] || '');
        const billNo = params.get('bill_no');
        const lawSector = params.get('law_sector');
        const lawNm = params.get('law_nm');
        const promDt = params.get('prom_dt');
        if (billNo && lawSector && lawNm && promDt){
            document.querySelector('.law-name').textContent = lawNm;
            // 1. 서버에 기업 리스트 요청 (lawSector 기반)
            fetch(`/api/companies?prom_dt=${promDt}`)
                .then(res => res.json())
                .then(data => {
                    const buttonContainer = document.querySelector('.company-buttons');
                    buttonContainer.innerHTML = '';
                    const companies = data[lawSector]; // 예: data["헬스케어"]
                    if (!companies || companies.length === 0) {
                        buttonContainer.innerHTML = '<p>해당 분야의 기업 정보가 없습니다.</p>';
                        return;
                    }
                    companies.forEach((company, i) => {
                        const btn = document.createElement('button');
                        btn.textContent = company.Company;
                        btn.addEventListener('click', () => {
                            drawChart(company.Code, promDt);
                            const canvasLabel = document.querySelector('#chart-label');
                            canvasLabel.textContent = btn.textContent;
                        });
                        buttonContainer.appendChild(btn);
                    });
                    // 초기 차트와 테이블 그리기 (첫 번째 기업)
                    const canvasLabel = document.querySelector('#chart-label');
                    canvasLabel.textContent = companies[0].Company;
                    drawChart(companies[0].Code, promDt);
                })
                .catch(error => {
                    console.error("기업 데이터 불러오기 실패:", error);
                });
        }
    }else if(id === 'notfound'){
        setTimeout(() => {
            navigate('home');
        }, 1000);
    }
}
function drawChart(code, promDt) {
    fetch(`/api/stock?code=${code}&prom_dt=${promDt}`)
        .then(res => res.json())
        .then(data => {
            const ctx = document.getElementById('stockChart').getContext('2d');
            if (window.stockChartInstance) window.stockChartInstance.destroy();
            window.stockChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.chart.labels,
                    datasets: [{
                        label: '종가',
                        data: data.chart.prices,
                        borderColor: '#3b82f6',  // 파란색 (Tailwind blue-500)
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.3,            // 곡선 부드럽게
                        pointRadius: 0,
                        pointHoverRadius: 5,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false // 필요시 true
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: '#111827',
                            titleColor: '#f9fafb',
                            bodyColor: '#d1d5db'
                        },
                        annotation: {
                            annotations: {
                                promoLine: {
                                    type: 'line',
                                    xMin: data.adjusted_prom_dt,
                                    xMax: data.adjusted_prom_dt,
                                    borderColor: '#ef4444',
                                    borderWidth: 2,
                                    label: {
                                        content: '공포일',
                                        enabled: true,
                                        backgroundColor: '#ef4444',
                                        color: '#fff',
                                        font: {
                                            weight: 'bold'
                                        },
                                        position: 'start'
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                parser: 'yyyy-MM-dd',
                                tooltipFormat: 'yyyy-MM-dd',
                                unit: 'day',
                                round: 'day',
                                displayFormats: {
                                    day: 'MM/dd'
                                },
                                minUnit: 'day'
                            },
                            ticks: {
                                color: '#6b7280' // Tailwind gray-500
                            },
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            ticks: {
                                color: '#6b7280'
                            },
                            grid: {
                                color: '#e5e7eb' // Tailwind gray-200
                            }
                        }
                    }
                },
                plugins: [Chart.registry.getPlugin('annotation')]
            });
            const a = data.analysis;
            const rows = document.querySelectorAll('.analysis-table tbody tr');
            rows[0].children[1].textContent = a.close_after.toFixed(2)+'%';
            rows[0].children[2].textContent = a.close_before_30.toFixed(2)+'%';
            rows[0].children[3].textContent = a.close_before_60.toFixed(2)+'%';
            rows[1].children[1].textContent = a.volume_after.toFixed(2)+'%';
            rows[1].children[2].textContent = a.volume_before_30.toFixed(2)+'%';
            rows[1].children[3].textContent = a.volume_before_60.toFixed(2)+'%';
            document.querySelector(".summary").textContent = data.evaluation || '분석 결과가 없습니다.';
        })
        .catch(error => {
            console.error("기업 데이터 불러오기 실패:", error);
        });
}
// URL 업데이트 (push 또는 replace)
function updateURL(pageId, replace = false) {
    const url = '/' + pageId;
    const state = { page: pageId };
    replace ? history.replaceState(state, '', url) : history.pushState(state, '', url);
}
// 페이지 이동 핸들러
function navigate(pageId) {
    const id = sanitizePageId(pageId);
    pages.forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
        showPage(pageId);
        updateURL(id);
    } else {
        navigate('notfound');
    }
}
// 초기 라우팅 및 이벤트 등록
function initSPA() {
    // click 이벤트 등록
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.hasAttribute('data-page')) {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            if (!/^\d+$/.test(pageId)) {
                navigate(pageId);
            }
        }
        const btn = e.target.closest('button');
        if(btn && btn.classList.contains('opinion-submit')) {
            e.preventDefault();
            const nameInput = document.querySelector('.opinion-name');
            const voteSelect = document.querySelector('.opinion-vote');
            const textArea = document.querySelector('.opinion-text');
            const name = nameInput.value.trim();
            const vote = voteSelect.value;
            const text = textArea.value.trim();
            if (!name || !text) {
                alert("이름과 의견을 모두 입력해주세요.");
                return;
            }
            const billId = document.querySelector('.bill-section-title').textContent.split('[')[1]?.split(']')[0];
            if (!billId) {
                alert("의안 ID가 없습니다.");
                return;
            }
            fetch(`/api/bills/${billId}/comments/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, vote, text })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.error) {
                        alert("저장 실패: " + data.error);
                        return;
                    }
                    nameInput.value = '';
                    textArea.value = '';
                    voteSelect.value = '찬성';
                    const comments = data.comments;
                    const tbody = document.querySelector('.opinion-table tbody');
                    tbody.innerHTML = '';
                    let agreeCount = 0, disagreeCount = 0;
                    comments.forEach(op => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                    <td>${op.name}</td>
                    <td>${op.vote}</td>
                    <td>${op.content}</td>
                `;
                        tbody.appendChild(tr);
                        if (op.vote === '찬성') agreeCount++;
                        else if (op.vote === '반대') disagreeCount++;
                    });
                    const total = agreeCount + disagreeCount || 1;
                    const agreeRatio = (agreeCount / total * 100).toFixed(0);
                    const disagreeRatio = (disagreeCount / total * 100).toFixed(0);
                    const agreeBar = document.querySelector('.agree');
                    const disagreeBar = document.querySelector('.disagree');
                    agreeBar.style.width = `${agreeRatio}%`;
                    disagreeBar.style.width = `${disagreeRatio}%`;
                    agreeBar.textContent = `찬성 ${agreeCount}표(${agreeRatio}%)`;
                    disagreeBar.textContent = `${disagreeCount}표(${disagreeRatio}%) 반대`;
                })
                .catch(err => {
                    console.error("의견 저장 실패: ", err);
                    alert("서버 오류 발생");
                });
        }else if(btn && btn.classList.contains('detail-reset-button')) {
            e.preventDefault();
            // select 요소들 초기화
            document.getElementById('ageFrom').selectedIndex = 0;
            document.getElementById('ageTo').selectedIndex = 0;
            document.getElementById('billknd').selectedIndex = 0;
            document.getElementById('proposerknd').selectedIndex = 0;
            document.getElementById('jrcmitnm').selectedIndex = 0;
            document.getElementById('jrcmitprocrsl').selectedIndex = 0;
            document.getElementById('detail-main-select').selectedIndex = 0;
            document.getElementById('detail-sub-select-yes').selectedIndex = 0;
            document.getElementById('detail-sub-select-no').selectedIndex = 0;
            // input 요소들 초기화
            document.getElementById('billno').value = '';
            document.getElementById('billnm').value = '';
            document.getElementById('proposer').value = '';
            document.getElementById('pprodtFrom').value = '';
            document.getElementById('pprodtTo').value = '';
            document.getElementById('ppsrsessFrom').value = '';
            document.getElementById('ppsrsessTo').value = '';
        }
    });
    // 브라우저 뒤로/앞으로 이동 처리
    window.addEventListener('popstate', (e) => {
        const page = sanitizePageId(e.state?.page);
        navigate(page);
    });
    // 메인 페이지/마켓 페이지 검색창 이벤트 처리
    document.body.addEventListener('submit', (e) => {
        const form = e.target.closest('#home-search-form');
        if (form) {
            e.preventDefault();
            const query = document.getElementById('home-search-input').value;
            navigate('searched?quick=1&query=' + query);
        }
        const form2 = e.target.closest('.law-search-form');
        if (form2) {
            e.preventDefault();
            const query = document.getElementById('law-search-input').value;
            const query2 = document.getElementById('law-search-filter').value;
            navigate('laws?query=' + query+'&sector='+query2);
        }
    });
    const sectorSelect = document.getElementById('law-search-filter');
    // 이벤트 리스너 등록
    sectorSelect.addEventListener('change', () => {
        const query2 = sectorSelect.value;
        const query = document.getElementById('law-search-input').value;
        navigate('laws?query=' + query+'&sector='+query2);
    });
    // 상세검색 페이지 검색 버튼 이벤트 처리
    document.getElementById('detail-search-button').addEventListener('click', () => {
        const queryParams = new URLSearchParams();
        //제안대수
        const ageFrom = document.getElementById('ageFrom').value;
        const ageTo = document.getElementById('ageTo').value;
        if(ageFrom && ageTo) {
            queryParams.append('start_age', ageFrom);
            queryParams.append('end_age', ageTo);
        }
        // 의안번호
        const billNo = document.getElementById('billno').value.trim();
        if (billNo) queryParams.append('bill_no', billNo);
        // 의안명
        const billNm = document.getElementById('billnm').value.trim();
        if (billNm) queryParams.append('bill_nm', billNm);
        // 의안종류
        const billKnd = document.getElementById('billknd').value;
        if (billKnd !== '전체') queryParams.append('bill_knd', billKnd);
        // 제안자 구분
        const proposerKnd = document.getElementById('proposerknd').value;
        if (proposerKnd !== '전체') queryParams.append('ppsr_knd', proposerKnd);
        // 제안자
        const proposer = document.getElementById('proposer').value.trim();
        if (proposer) queryParams.append('ppsr_nm', proposer);
        // 제안일
        const pprodtFrom = document.getElementById('pprodtFrom').value;
        const pprodtTo = document.getElementById('pprodtTo').value;
        if (pprodtFrom && pprodtTo){
            queryParams.append('ppsr_dt_from', pprodtFrom);
            queryParams.append('ppsr_dt_to', pprodtTo);
        }
        // 제안회기
        const pprosessFrom = document.getElementById('ppsrsessFrom').value;
        const pprosessTo = document.getElementById('ppsrsessTo').value;
        if (pprosessFrom && pprosessTo){
            queryParams.append('ppsr_sess_from', pprosessFrom);
            queryParams.append('ppsr_sess_to', pprosessTo);
        }
        // 소관위원회명
        const jrcmitnm = document.getElementById('jrcmitnm').value;
        if(jrcmitnm !== '전체') queryParams.append('jrcmitnm', jrcmitnm);
        // 소관위원회 처리결과
        const jrcmitprocrsl = document.getElementById('jrcmitprocrsl').value;
        if(jrcmitprocrsl !== '전체') queryParams.append('jrcmitprocrsl', jrcmitprocrsl);
        // 본회의 심의결과
        const mainSelect = document.getElementById('detail-main-select').value;
        if(mainSelect === '반영'){
            const subSelectYes = document.getElementById('detail-sub-select-yes').value;
            if(subSelectYes !== '전체'){
                queryParams.append('rgsconfrslt', subSelectYes);
            }else{
                queryParams.append('rgsconfrslt', '가결/대안반영폐기/수정안반영폐기');
            }
        }else if(mainSelect === '미반영'){
            const subSelectNo = document.getElementById('detail-sub-select-no').value;
            if(subSelectNo !== '전체'){
                queryParams.append('sub-select-no', subSelectNo);
            }else{
                queryParams.append('rgsconfrslt', '부결/폐기/임기만료폐기/철회/기타/계류');
            }
        }
        // searched 페이지로 이동
        navigate(`searched?${queryParams.toString()}`);
    });
    // 처음 접속 시 기본 페이지
    window.addEventListener('DOMContentLoaded', () => {
        const defaultPage = 'home';
        showPage(defaultPage);
        updateURL(defaultPage, true); // replaceState로 초기 상태 등록
    });
    const mainSelect = document.getElementById('detail-main-select');
    const subSelectYes = document.getElementById('detail-sub-select-yes');
    const subSelectNo = document.getElementById('detail-sub-select-no');
    // 이벤트 리스너 등록
    mainSelect.addEventListener('change', () => {
        const value = mainSelect.value;
        if (value === '반영') {
            subSelectYes.style.display = 'block';
            subSelectNo.style.display = 'none';
        } else if (value === '미반영') {
            subSelectYes.style.display = 'none';
            subSelectNo.style.display = 'block';
        } else {
            // '전체' 일 경우 둘 다 숨김
            subSelectYes.style.display = 'none';
            subSelectNo.style.display = 'none';
        }
    });
}
// 목록 렌더링
function renderList(data, knd, headerLink, listContainer, paginationContainer, paginationLink, headerTitles, cssPath, page) {
    const pagination = new Pagination({
        data: data,
        pageSize: 10,
        renderItem: (item, index, container) => {
            const safeText = (v) => (v === null || v === undefined || v === '') ? '-' : v;
            const tr = document.createElement('tr');
            if(knd === 'bill'){
                tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.AGE}</td>
                <td>${item.BILL_NO}</td>
                <td><a href="/bill" class="navigate-to-bill" data-page="bill?bill_no=${encodeURIComponent(item.BILL_NO)}">${item.BILL_NM}</td>
                <td>${safeText(item.PPSR_NM)}</td>
                <td>${item.PPSR_DT}</td>
                <td>${safeText(item.PROC_RSLT)}</td>`;
            }else if(knd === 'law'){
                let param = 'bill_no='+encodeURIComponent(item.BILL_NO);
                    param += '&law_sector='+encodeURIComponent(item.LAW_SECTOR);
                    param += '&law_nm='+encodeURIComponent(item.BILL_NM);
                    param += '&prom_dt='+encodeURIComponent(item.PROM_DT);
                tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.LAW_SECTOR}</td>
                <td>${item.BILL_NO}</td>
                <td><a href="/market" class="navigate-to-market" data-page="market?${param}">${item.BILL_NM}</td>
                <td>${item.PROM_DT}</td>`;
            }
            container.appendChild(tr);
        },
        headerLink: headerLink,
        listContainer: listContainer,
        paginationContainer: paginationContainer,
        paginationLink: paginationLink,
        autoHeader: true,
        headerTitles: headerTitles,
        cssPath: cssPath,
        page: page,
    });
    pagination.init();
}
initSPA();
