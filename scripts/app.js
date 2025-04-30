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