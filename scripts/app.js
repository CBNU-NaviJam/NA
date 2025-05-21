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
        document.getElementById('notfound')?.classList.add('active');
    }
    if(id === 'home'){
        renderList([],
            'bill',
            'home-list-header',
            'home-list-body',
            'home-pagination',
            'home-pagination-link',
            ['번호', '대수', '의안번호', '의안명', '제안자', '제안일', '처리구분'],
            '/css/homePagination.css',
            '#home');
    }else if(id === 'searched'){
        const params = pageId?.split('?')[1];
        const isQuick = Number(params?.split('&')[0]?.split('=')[1]);
        if(isQuick){
            // 간편검색
        }else{
            // 상세검색
        }
        renderList([],
            'bill',
            'searched-list-header',
            'searched-list-body',
            'searched-pagination',
            'searched-pagination-link',
            ['번호', '대수', '의안번호', '의안명', '제안자', '제안일', '처리구분'],
            '/css/searchedPagination.css',
            '#searched');
    }else if(id === 'laws'){
        renderList([],
            'laws',
            'laws-list-header',
            'laws-list-body',
            'laws-pagination',
            'laws-pagination-link',
            ['번호', '분류', '의안번호', '법률명', '공포일'],
            '/css/lawsPagination.css',
            '#laws');
    }
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
    showPage(id);
    updateURL(id);
}
// 초기 라우팅 및 이벤트 등록
function initSPA() {
    // a 태그 클릭 시 페이지 이동
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.hasAttribute('data-page')) {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            navigate(pageId);
        }
    });
    // 브라우저 뒤로/앞으로 이동 처리
    window.addEventListener('popstate', (e) => {
        const page = sanitizePageId(e.state?.page);
        showPage(page);
    });
    // 메인 페이지 검색창 이벤트 처리
    document.getElementById('home-search-form').addEventListener('submit', function(e) {
        e.preventDefault(); // 페이지 리로드 방지
        const query = document.getElementById('home-search-input').value;
        navigate('searched?quick=1&query='+query);
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
            // '전체' 또는 기타 경우 둘 다 숨김
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
            const tr = document.createElement('tr');
            if(knd === 'bill'){
                tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.age}</td>
                <td>${item.bill_no}</td>
                <td>${item.bill_nm}</td>
                <td>${item.proposer}</td>
                <td>${item.ppsr_dt}</td>
                <td>${item.proc_rslt}</td>`;
            }else if(knd === 'law'){
                tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.sector}</td>
                <td>${item.bill_no}</td>
                <td>${item.prom_law_nm}</td>
                <td>${item.prom_dt}</td>`;
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
