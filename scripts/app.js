const pages = document.querySelectorAll('.page');

// 페이지 이동 함수
function navigate(pageId) {
    showPage(pageId);
    history.pushState({ page: pageId }, '', '/' + pageId); // URL 변경
}

// 페이지 표시 함수
function showPage(id) {
    pages.forEach(p => p.classList.remove('active')); // 기존 페이지 숨기기
    const target = document.getElementById(id); // 선택한 페이지 찾기
    if (target) {
        target.classList.add('active'); // 해당 페이지 표시
    } else {
        document.getElementById('notfound').classList.add('active'); // 페이지 없으면 404
    }
}

// 브라우저 뒤로가기/앞으로가기 시 처리
window.addEventListener('popstate', (e) => {
    const page = e.state?.page || 'home'; // URL 상태가 없으면 기본 'home' 페이지
    showPage(page);
});

// 링크에 이벤트 리스너 추가
document.querySelector('nav').addEventListener('click', function(e) {
    const clickedLink = e.target.closest('a'); // 클릭된 요소가 링크인지 확인
    if (clickedLink) {
        e.preventDefault(); // 기본 동작 막기
        const pageId = clickedLink.getAttribute('data-page'); // data-page 속성으로 페이지 ID 얻기
        navigate(pageId);
    }
});

// 검색 폼 처리
function submitSearch(event) {
    event.preventDefault(); // 기본 제출 동작 방지
    alert("검색됨! 검색결과 페이지로 이동");
    navigate('search');
}
document.getElementById('search-form').addEventListener('submit', function(e) {
    e.preventDefault(); // 페이지 리로드 방지
    const query = document.getElementById('search-input').value;
    alert("검색어:"+query);
    navigate('search');
    // 여기에 실제 검색 로직을 작성하세요
});

// 브라우저 처음 열 때 주소에 맞는 페이지 보여주기
window.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname.replace('/', '') || 'home'; // 주소에서 페이지 정보 추출
    if (path !== 'home' && !document.getElementById(path)) {
        showPage('home');
        history.replaceState({ page: 'home' }, '', '/home');
    } else {
        showPage(path);
        history.replaceState({ page: path }, '', '/' + path);
    }
});

// 의안 목록
const apiKey = API_KEY;
let bills = [];
const pageSize = 10;
let currentPage = parseInt($('.page-link.active').data('page')) || 1;

function fetchBills() {
    const url = `https://open.assembly.go.kr/portal/openapi/BILLRCP?KEY=${apiKey}&Type=json&pIndex=1&pSize=60`;

    $.ajax({
        url: url,
        type: 'GET',
        dataType: 'json'
    }).then(function(res) {
        const billContainer = res.BILLRCP && res.BILLRCP[1].row.length > 1 && res.BILLRCP[1].row;
        if (Array.isArray(billContainer)) {
            bills = billContainer;
        } else {
            console.warn('의안 데이터가 없거나 형식이 예상과 다릅니다:', res);
        }
        const batchSize = 10;  // 한 번에 보낼 요청의 수
        let index = 0;
        // 모든 API 호출을 then으로 처리
        function processBatch() {
            const batch = bills.slice(index, index + batchSize); // 현재 배치 처리할 항목들
            const batchPromises = batch.map(bill => {
                const url2 = `https://open.assembly.go.kr/portal/openapi/ALLBILL?KEY=${apiKey}&Type=json&pIndex=1&pSize=60&BILL_NO=${bill.BILL_NO}`;

                return $.ajax({
                    url: url2,
                    type: 'GET',
                    dataType: 'json'
                }).then(function(res2) {
                    const billContainer2 = res2.ALLBILL && res2.ALLBILL[1].row.length > 1 && res2.ALLBILL[1].row;
                    if (Array.isArray(billContainer2)) {
                        bill.PROPOSER = res2.ALLBILL[1].row[0].PPSR_NM;
                    } else {
                        console.warn('의안 데이터가 없거나 형식이 예상과 다릅니다:', res2);
                    }
                }).catch(function(error) {
                    console.error('ALLBILL API 요청 실패:', error);
                });
            });
            // 한 배치가 끝난 후 다음 배치를 처리
            Promise.all(batchPromises)
                .then(function() {
                    index += batchSize;  // 처리된 항목만큼 index 증가
                    if (index < bills.length) {
                        processBatch();  // 더 처리할 항목이 있으면 계속해서 배치 처리
                    } else {
                        renderPage(1);  // 모든 요청이 완료된 후 페이지 렌더링
                        renderPagination();  // 페이지네이션 렌더링
                    }
                }).catch(function(error) {
                    console.error('에러 발생:', error);
                });
        }
        processBatch()
    }).catch(function(error) {
        console.error('에러 발생:', error);
    });
}

function renderPage(page) {
    const start = (page - 1) * pageSize;
    const pageItems = bills.slice(start, start + pageSize);

    $('#home-list-body').empty();
    pageItems.forEach((bill, index) => {
        $('#home-list-body').append(`
      <tr>
        <td>${start + index + 1}</td>
        <td>${bill.ERACO || '-'}</td>
        <td>${bill.BILL_NO || '-'}</td>
        <td>${bill.BILL_NM || '-'}</td>
        <td>${bill.PROPOSER || '-'}</td>
        <td>${bill.PPSL_DT || '-'}</td>
        <td>${bill.PROC_RSLT || '-'}</td>
      </tr>
    `);
    });
}
function renderPagination(startPage = 1) {
    const totalPages = Math.ceil(bills.length / pageSize);
    const $pagination = $('#pagination');
    $pagination.empty();

    // 페이지 그룹 계산
    const pageGroupSize = 5;
    startPage = Math.max(1, startPage); // 음수 방지
    const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);

    // 이전(<) 버튼
    if (startPage > 1) {
        const prevStartPage = Math.max(1, startPage - pageGroupSize);
        $pagination.append(`<a href="#" class="page-link" data-page="${prevStartPage}">&lt;</a>`);
    }

    // 페이지 숫자 버튼
    for (let i = startPage; i <= endPage; i++) {
        $pagination.append(`<a href="#" class="page-link" data-page="${i}">${i}</a> `);
    }

    // 다음(>) 버튼
    if (endPage < totalPages) {
        const nextStartPage = startPage + pageGroupSize;
        $pagination.append(`<a href="#" class="page-link" data-page="${nextStartPage}">&gt;</a>`);
    }

    // 페이지 링크 클릭 시
    $('.page-link').on('click', function () {
        const page = $(this).data('page');
        console.log(startPage, endPage, currentPage, page);
        if (page !== currentPage) {
            console.log(1);
            currentPage = page;
            renderPage(page);     // 페이지 내용 갱신
            const newStartPage = Math.floor((page - 1) / pageGroupSize) * pageGroupSize + 1;
            renderPagination(newStartPage); // 페이지네이션 갱신
        }
    });
}
fetchBills();