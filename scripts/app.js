const pages = document.querySelectorAll('.page');
const apiKey = API_KEY;
// 페이지 이동 함수
function navigate(pageId) {
    if (bills.length === 0) {
        alert("데이터를 아직 불러오는 중입니다.");
        return;
    }
    pageId = pageId.split('?')[0];
    showPage(pageId);
    history.pushState({ page: pageId }, '', '/' + pageId); // URL 변경
}
// 페이지 표시 함수
function showPage(id) {
    pages.forEach(p => p.classList.remove('active')); // 기존 페이지 숨기기
    id = id.split('?')[0]; // hash 제거
    const target = document.getElementById(id); // 선택한 페이지 찾기
    if (target) {
        target.classList.add('active'); // 해당 페이지 표시
    } else {
        document.getElementById('notfound').classList.add('active'); // 페이지 없으면 404
    }
    // 상세검색 페이지 검색 버튼에 이벤트리스너 추가
    if(id === 'detail'){
        document.querySelector('#detail-search-button').addEventListener('click', handleDetailSearch);
    }
}
// 브라우저 뒤로가기/앞으로가기 시 처리
window.addEventListener('popstate', (e) => {
    const page = e.state?.page || 'home'; // URL 상태가 없으면 기본 'home' 페이지
    showPage(page);
});
// 상단메뉴(NAStock, 상세검색, 시장분석) 링크에 이벤트 리스너 추가
document.querySelector('nav').addEventListener('click', function(e) {
    const clickedLink = e.target.closest('a'); // 클릭된 요소가 링크인지 확인
    if (clickedLink) {
        e.preventDefault(); // 기본 동작 막기
        const pageId = clickedLink.getAttribute('data-page'); // data-page 속성으로 페이지 ID 얻기
        navigate(pageId);
        if(pageId === 'market') fetchAndShowLaws();
    }
});
// 브라우저 처음 열 때 로딩 후 홈페이지 보여주기
window.addEventListener('DOMContentLoaded', async () => {
    showPage("loading");
    try{
        await fetchBills(); // 의안 목록 불러오기
        renderHomePage(1);
        renderHomePagination(1);
        showPage('home');
        history.replaceState({ page: 'home' }, '', '/home');
    }catch (err) {
        console.error('초기 데이터 로딩 실패:', err);
        alert('의안 데이터를 불러오지 못했습니다.');
        showPage('home');
    }

});
// API 호출 함수 - 의안 목록 불러오기 - test case: 60개
function fetchBills() {
    return new Promise((resolve, reject) => {
        const url = `https://open.assembly.go.kr/portal/openapi/BILLRCP?KEY=${apiKey}&Type=json&pIndex=1&pSize=60`;
        $('#loading-container').show();
        $('#progress-bar').val(0);
        $('#progress-text').text('0%');
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
            const total = bills.length;
            let completed = 0;
            function updateProgress() {
                completed = Math.min(completed, total);
                const percent = Math.round((completed / total) * 100);
                $('#progress-bar').val(percent);
                $('#progress-text').text(`${percent}%`);
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
                    }).always(function(){
                        completed++;
                        updateProgress();
                    });
                });
                // 한 배치가 끝난 후 다음 배치를 처리
                Promise.all(batchPromises).then(function() {
                    index += batchSize;  // 처리된 항목만큼 index 증가
                    if (index < bills.length) {
                        processBatch();  // 더 처리할 항목이 있으면 계속해서 배치 처리
                    } else {
                        $('#loading-container').hide(); // 완료 후 숨기기
                        resolve(bills);
                    }
                }).catch(function(error) {
                    console.error('에러 발생:', error);
                    $('#loading-container').hide();
                });
            }
            processBatch()
        }).catch(function(error) {
            console.error('에러 발생:', error);
        });
    });
}

// 검색 처리 ( 간편검색 / 상세검색 )
let searchCurrentPage = 1;
let searchPageSize = 20;
let searchBills = [];
const ERACO_ORDER = [
    "제헌",
    "제1대",
    "제2대",
    "제3대",
    "제4대",
    "제5대",
    "제6대",
    "제7대",
    "제8대",
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
    "제22대"
]
// home 페이지 검색창에 이벤트 리스너 추가
document.getElementById('search-form').addEventListener('submit', function(e) {
    e.preventDefault(); // 페이지 리로드 방지
    const query = document.getElementById('search-input').value;
    searchBills = bills.filter(bill => {
        const matchedAge = ERACO_ORDER.includes(query);
        const matchNo = bill.BILL_NO?.includes(query);
        const matchNm = bill.BILL_NM?.includes(query);
        const matchProposer = bill.PROPOSER?.includes(query);
        const matchDate = bill.PPSL_DT?.includes(query);
        return matchedAge || matchNo || matchNm || matchProposer || matchDate;
    });
    renderSearchPage(searchCurrentPage);
    renderSearchPagination();
    navigate('search');
});
// detail - 상세검색
function handleDetailSearch() {
    let first_age = document.querySelector('#age1').value.split(' ')[0];
    if(first_age === '국가재건회의'){
        first_age = '제5대';
    }else if(first_age === '비상국무회의'){
        first_age = '제7대';
    }
    let second_age = document.querySelector('#age2').value.split(' ')[0];
    if(second_age === '국가재건회의'){
        second_age = '제5대';
    }else if(first_age === '비상국무회의'){
        second_age = '제7대';
    }
    const billno = document.querySelector('#billno').value;
    const billnm = document.querySelector('#billnm').value;
    const proposer = document.querySelector('#proposer').value;
    const ppdt = document.querySelector('[name="ppdt"]').value;
    const query = new URLSearchParams({
        first_age,
        second_age,
        billno,
        billnm,
        proposer,
        ppdt
    }).toString();
    history.pushState({ page: 'search', query }, '', '/search?'+query);
    renderDetailSearchResults(query);
}
function renderDetailSearchResults(){
    const params = new URLSearchParams(window.location.search);
    const first_age = params.get('first_age');
    const second_age = params.get('second_age');
    const billno = params.get('billno');
    const billnm = params.get('billnm');
    const proposer = params.get('proposer');
    const ppdt = params.get('ppdt');
    searchBills = bills.filter(bill => {
        const eraco = bill.ERACO?.trim();
        const idx1 = ERACO_ORDER.indexOf(first_age);
        const idx2 = ERACO_ORDER.indexOf(second_age);
        let matchedAge = true;

        if (idx1 !== -1 && idx2 !== -1) {
            const startIdx = Math.min(idx1, idx2);
            const endIdx = Math.max(idx1, idx2);
            const validRange = ERACO_ORDER.slice(startIdx, endIdx + 1);
            matchedAge = validRange.includes(eraco);
        }
        const matchNo = !billno || bill.BILL_NO?.includes(billno);
        const matchNm = !billnm || bill.BILL_NM?.includes(billnm);
        const matchProposer = !proposer || bill.PROPOSER?.includes(proposer);
        const matchDate = !ppdt || bill.PPSL_DT?.includes(ppdt); // 정확히 일치하려면 ===

        return matchedAge && matchNo && matchNm && matchProposer && matchDate;
    });
    renderSearchPage(searchCurrentPage);
    renderSearchPagination();
    navigate('search');
}
function renderSearchPage(page) {
    const start = (page - 1) * searchPageSize;
    const pageItems = searchBills.slice(start, start + searchPageSize);

    $('#search-result-list-body').empty();
    pageItems.forEach((bill, index) => {
        $('#search-result-list-body').append(`
      <tr>
        <td>${start + index + 1}</td>
        <td>${bill.ERACO || '-'}</td>
        <td>${bill.BILL_NO || '-'}</td>
        <td><a id="bill_detail" href="#bills?bill_no=${bill.BILL_NO}" style="color:white">${bill.BILL_NM || '-'}</a></td>
        <td>${bill.PROPOSER || '-'}</td>
        <td>${bill.PPSL_DT || '-'}</td>
        <td>${bill.PROC_RSLT || '-'}</td>
      </tr>
    `);
    });
}
function renderSearchPagination(startPage = 1) {
    const totalPages = Math.ceil(searchBills.length / searchPageSize);
    const $pagination = $('#search-result-pagination');
    $pagination.empty();
    // 페이지 그룹 계산
    const pageGroupSize = 5;
    startPage = Math.max(1, startPage); // 음수 방지
    const endPage = Math.min(startPage + pageGroupSize - 1, totalPages);
    // 이전(<) 버튼
    if (startPage > 1) {
        const prevStartPage = Math.max(1, startPage - pageGroupSize);
        $pagination.append(`<a href="javascript:void(0)" class="page-link" data-page="${prevStartPage}">&lt;</a>`);
    }
    // 페이지 숫자 버튼
    for (let i = startPage; i <= endPage; i++) {
        $pagination.append(`<a href="javascript:void(0)" class="page-link" data-page="${i}">${i}</a> `);
    }
    // 다음(>) 버튼
    if (endPage < totalPages) {
        const nextStartPage = startPage + pageGroupSize;
        $pagination.append(`<a href="javascript:void(0)" class="page-link" data-page="${nextStartPage}">&gt;</a>`);
    }
    // 페이지 링크 클릭 시
    $('.page-link').on('click', function () {
        const page = $(this).data('page');
        if (page !== searchCurrentPage) {
            searchCurrentPage = page;
            renderSearchPage(page);     // 페이지 내용 갱신
            const newStartPage = Math.floor((page - 1) / pageGroupSize) * pageGroupSize + 1;
            renderSearchPagination(newStartPage); // 페이지네이션 갱신
        }
    });
}
// home - 의안 목록
let bills = [];
const pageSize = 10;
let currentPage = parseInt($('.page-link.active').data('page')) || 1;
function renderHomePage(page) {
    const start = (page - 1) * pageSize;
    const pageItems = bills.slice(start, start + pageSize);
    $('#home-list-body').empty();
    pageItems.forEach((bill, index) => {
        $('#home-list-body').append(`
      <tr>
        <td>${start + index + 1}</td>
        <td>${bill.ERACO || '-'}</td>
        <td>${bill.BILL_NO || '-'}</td>
        <td><a id="bill_detail" href="#bills?bill_no=${bill.BILL_NO}" style="color:white">${bill.BILL_NM || '-'}</a></td>
        <td>${bill.PROPOSER || '-'}</td>
        <td>${bill.PPSL_DT || '-'}</td>
        <td>${bill.PROC_RSLT || '-'}</td>
      </tr>
    `);
    });
}
function renderHomePagination(startPage = 1) {
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
        $pagination.append(`<a href="javascript:void(0)" class="page-link" data-page="${prevStartPage}">&lt;</a>`);
    }
    // 페이지 숫자 버튼
    for (let i = startPage; i <= endPage; i++) {
        $pagination.append(`<a href="javascript:void(0)" class="page-link" data-page="${i}">${i}</a> `);
    }
    // 다음(>) 버튼
    if (endPage < totalPages) {
        const nextStartPage = startPage + pageGroupSize;
        $pagination.append(`<a href="javascript:void(0)" class="page-link" data-page="${nextStartPage}">&gt;</a>`);
    }
    // 페이지 링크 클릭 시
    $('.page-link').on('click', function () {
        const page = $(this).data('page');
        if (page !== currentPage) {
            currentPage = page;
            renderHomePage(page);     // 페이지 내용 갱신
            const newStartPage = Math.floor((page - 1) / pageGroupSize) * pageGroupSize + 1;
            renderHomePagination(newStartPage); // 페이지네이션 갱신
        }
    });
}
// 의안 상세정보 페이지
window.addEventListener('hashchange', handleHashChange);
window.addEventListener('load', handleHashChange); // 새로고침 대응

function handleHashChange() {
    const hash = location.hash; // "#bills?bill_no=161627"
    if (!hash) return;

    const [path, queryString] = hash.slice(1).split('?'); // "bills", "bill_no=161627"
    const queryParams = new URLSearchParams(queryString);
    const billNo = queryParams.get('bill_no');

    showPage(path);
    if (path === 'bills' && billNo) {
        renderBillDetail(billNo);
    }
}
async function renderBillDetail(billNo) {
    const container = document.getElementById('bills');
    const bill = bills.find(b => b.BILL_NO === billNo);
    console.log(bill);
    const originalUrl = `https://likms.assembly.go.kr/bill/summaryPopup.do?billId=${bill.BILL_ID}`;
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(originalUrl)}`;
    let summary = '요약 정보를 불러오는 중입니다...';
    try {
        const res = await fetch(proxyUrl);
        const data = await res.json();

        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');

        const summaryDiv = doc.querySelector('div.textType02.mt30');
        if (summaryDiv) {
            summary = summaryDiv.innerText.trim();
        } else {
            summary = '요약 정보를 찾을 수 없습니다.';
        }
    } catch (err) {
        console.error('요약 요청 실패:', err);
        summary = '요약 정보를 불러오는 데 실패했습니다.';
    }
    container.innerHTML = `
        <h2>${bill.BILL_NM}</h2>
        <p>의안 번호: ${bill.BILL_NO}</p>
        <p>제안자: ${bill.PROPOSER}</p>
        <p style="width: 50%; white-space:pre-line;">${summary}</p>
        <div id="interaction">
    <h3>이 안건에 대한 의견을 남겨주세요</h3>

    <div id="vote-section">
      <label><input type="radio" name="vote" value="찬성"> 찬성</label>
      <label><input type="radio" name="vote" value="반대"> 반대</label>
    </div>

    <textarea id="opinion-input" placeholder="의견을 작성하세요..." rows="3" cols="60"></textarea><br>
    <button id="submit-opinion">의견 제출</button>

    <h4>다른 사람의 의견</h4>
    <ul id="opinion-list"></ul>
  </div>
    `;
    setupOpinionSection(billNo);
}
function setupOpinionSection(billNo) {
    const submitBtn = document.getElementById('submit-opinion');
    const opinionInput = document.getElementById('opinion-input');
    const opinionList = document.getElementById('opinion-list');
    const voteRadios = document.querySelectorAll('input[name="vote"]');

    // 로컬스토리지에서 불러오기
    const key = `opinions_${billNo}`;
    const opinions = JSON.parse(localStorage.getItem(key)) || [];

    function renderOpinions() {
        opinionList.innerHTML = '';
        opinions.forEach(op => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>[${op.vote}]</strong> ${op.text}`;
            opinionList.appendChild(li);
        });
    }

    submitBtn.onclick = () => {
        const selectedVote = [...voteRadios].find(r => r.checked)?.value;
        const opinionText = opinionInput.value.trim();

        if (!selectedVote || !opinionText) {
            alert('찬반 선택과 의견을 모두 입력해 주세요.');
            return;
        }

        opinions.push({ vote: selectedVote, text: opinionText });
        localStorage.setItem(key, JSON.stringify(opinions));
        opinionInput.value = '';
        voteRadios.forEach(r => r.checked = false);
        renderOpinions();
    };

    renderOpinions();
}

// 공포 법률안 목록
const totalTerms = 22;
const pagSize = 100;
const resultsContainer = document.getElementById('results');
const progressBar = document.getElementById("progress-bar-law");
const progressText = document.getElementById("progress-text-law");
const termProgressSection = document.getElementById("term-progress-section");

async function fetchAndShowLaws() {
    const results = [];
    const termProgressBars = {}; // 각 대수별 진행 상태 저장
    let totalSteps = 0;
    let completedSteps = 0;

    // 1. 대수별 전체 페이지 수 및 총 건수 조회
    const totalPagesByAge = await Promise.all([...Array(totalTerms-9).keys()].map(async i => {
        const term = i + 10;
        const url = `https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph?KEY=${API_KEY}&AGE=${term}&pSize=${pagSize}&pIndex=1`;
        try {
            const res = await fetch(url);
            const xmlText = await res.text();
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const totalCount = parseInt(xmlDoc.querySelector("list_total_count")?.textContent || "0");
            const pages = Math.ceil(totalCount / pagSize);

            // 대수별 진행 바 및 텍스트 영역 생성
            const barId = `term-progress-${term}`;
            const textId = `term-progress-text-${term}`;
            termProgressSection.innerHTML += `
                <div><strong>${term}대</strong></div>
                <div style="height: 10px; width: 100%; background: #eee; margin-bottom: 3px;">
                    <div id="${barId}" style="height: 10px; width: 0%; background: #007bff;"></div>
                </div>
                <div id="${textId}" style="margin-bottom: 10px; font-size: 12px; color: #555;"></div>
            `;
            termProgressBars[term] = {
                barId,
                textId,
                totalPages: pages,
                currentPage: 0,
                totalCount,
                announcedCount: 0,
            };
            return { term, pages };
        } catch (e) {
            console.warn(`제 ${term}대 count 조회 실패:`, e);
            return { term, pages: 0 };
        }
    }));

    totalSteps = totalPagesByAge.reduce((sum, t) => sum + t.pages, 0);

    // 2. 실제 데이터 수집
    for (const { term, pages } of totalPagesByAge) {
        for (let page = 1; page <= pages; page++) {
            const url = `https://open.assembly.go.kr/portal/openapi/nwbpacrgavhjryiph?KEY=${API_KEY}&AGE=${term}&pSize=${pagSize}&pIndex=${page}`;
            try {
                const res = await fetch(url);
                const xmlText = await res.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");

                const items = [...xmlDoc.querySelectorAll("row")];
                items.forEach(item => {
                    const announceDate = item.querySelector("ANNOUNCE_DT")?.textContent;
                    const billName = item.querySelector("BILL_NM")?.textContent || '(제목 없음)';
                    const billurl = item.querySelector("LINK_URL")?.textContent;
                    if (announceDate) {
                        results.push({ name: billName, date: announceDate, term, link: billurl });
                        termProgressBars[term].announcedCount++;
                    }
                });
            } catch (e) {
                console.warn(`제 ${term}대 ${page}페이지 실패:`, e);
            }

            // 전체 진행률 업데이트
            completedSteps++;
            const percent = Math.round((completedSteps / totalSteps) * 100);
            progressBar.style.width = `${percent}%`;
            progressText.innerText = `전체 진행률: ${percent}% (${completedSteps}/${totalSteps} 페이지)`;

            // 대수별 진행률 + 공포 건수 표시
            const termBar = termProgressBars[term];
            termBar.currentPage++;
            const termPercent = Math.round((termBar.currentPage / termBar.totalPages) * 100);
            document.getElementById(termBar.barId).style.width = `${termPercent}%`;
            document.getElementById(termBar.textId).innerText =
                `📘 ${termPercent}% 처리됨 / 공포: ${termBar.announcedCount}건 / 전체: ${termBar.totalCount}건`;
        }
    }

    // 완료 메시지
    progressText.innerText = `✅ 전체 완료! 총 ${results.length}건 공포`;
    termProgressSection.innerHTML = '';
    progressBar.style.display = 'none';

    // 결과 표시
    // 결과를 대수별로 그룹화
    const groupedResults = {};
    results.forEach(bill => {
        const term = bill.term;
        if (!groupedResults[term]) groupedResults[term] = [];
        groupedResults[term].push(bill);
    });

    // 대수별로 토글 가능한 영역 생성
    resultsContainer.innerHTML = Object.entries(groupedResults)
        .sort((a, b) => a[0] - b[0])
        .map(([term, bills]) => `
    <div class="term-group">
      <h3 onclick="toggleTerm('${term}')" style="cursor:pointer;">
        ▶ 제 ${term}대 법률안 (${bills.length}건)
      </h3>
      <div id="term-${term}" class="term-content" style="display:none; margin-left:10px;">
        ${bills.map(b => `<p><a href='${b.link}'><strong>${b.name}</strong></a> - 공포일: ${b.date}</p>`).join('')}
      </div>
    </div>
  `).join('');
}

function toggleTerm(term) {
    const el = document.getElementById(`term-${term}`);
    if (!el) return;
    const header = el.previousElementSibling;
    if (el.style.display === 'none') {
        el.style.display = 'block';
        if (header) header.innerText = header.innerText.replace('▶', '▼');
    } else {
        el.style.display = 'none';
        if (header) header.innerText = header.innerText.replace('▼', '▶');
    }
}

