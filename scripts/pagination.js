// pagination.js
export class Pagination {
    constructor({
                    data,
                    pageSize = 10,
                    renderItem,
                    headerLink,
                    listContainer,
                    paginationContainer,
                    paginationLink,
                    pageSizeSelector = null,
                    autoHeader = false,
                    headerTitles = [],
                    cssPath,
                    page,
                }) {
        this.data = data;
        this.pageSize = pageSize;
        this.renderItem = renderItem;
        this.listContainer = listContainer;
        this.paginationContainer = paginationContainer;
        this.pageSizeSelector = pageSizeSelector;
        this.currentPage = 1;
        this.pageGroupSize = 5;
        this.autoHeader = autoHeader;
        this.headerTitles = headerTitles;
        this.paginationLink = paginationLink;
        this.headerLink = headerLink;
        this.cssPath = cssPath;
        this.page = document.querySelector(page);

        if (this.autoHeader) this.renderHeaderAndSelector();
        if (this.pageSizeSelector) this.initPageSizeSelector();
    }

    renderHeaderAndSelector() {
        const wrapper = document.createElement('div');
        wrapper.className = this.headerLink;

        const selectorWrapper = document.createElement('div');
        selectorWrapper.className = 'pagination-page-size-control';
        selectorWrapper.innerHTML = `
            <select id="pagination-page-size-selector">
                <option value="10">10개씩 보기</option>
                <option value="20">20개씩 보기</option>
                <option value="30">30개씩 보기</option>
                <option value="50">50개씩 보기</option>
            </select>
        `;
        selectorWrapper.style.display = 'flex';
        selectorWrapper.style.justifyContent = 'flex-end';
        wrapper.appendChild(selectorWrapper);
        this.page.appendChild(wrapper);
        this.pageSizeSelector = '#pagination-page-size-selector';

        if (this.headerTitles.length) {
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            const tr = document.createElement('tr');
            this.headerTitles.forEach(title => {
                const th = document.createElement('th');
                th.textContent = title;
                tr.appendChild(th);
            });
            thead.appendChild(tr);
            table.appendChild(thead);
            wrapper.appendChild(table);
        }
    }

    initPageSizeSelector() {
        const selector = document.querySelector(this.pageSizeSelector);
        selector.value = this.pageSize;
        selector.addEventListener('change', () => {
            const newSize = parseInt(selector.value);
            if (!isNaN(newSize) && newSize > 0) {
                this.pageSize = newSize;
                this.currentPage = 1;
                this.init();
            }
        });
    }

    renderPage(page) {
        this.currentPage = page;
        const start = (page - 1) * this.pageSize;
        const pageItems = this.data.slice(start, start + this.pageSize);
        const table = document.querySelector(`.${this.headerLink} table`);
        if(typeof this.listContainer == 'string'){
            const list_class = this.listContainer;
            this.listContainer = document.createElement('tbody');
            this.listContainer.className = list_class;
        }
        this.listContainer.innerHTML = '';
        pageItems.forEach((item, index) => {
            this.renderItem(item, start + index, this.listContainer);
        });
        table.appendChild(this.listContainer);
    }

    renderPagination(startPage = 1) {
        const totalPages = Math.ceil(this.data.length / this.pageSize);
        if(typeof this.paginationContainer == 'string'){
            const pagination_class = this.paginationContainer;
            this.paginationContainer = document.createElement('div');
            this.paginationContainer.className = pagination_class;
        }
        this.paginationContainer.innerHTML = '';

        const endPage = Math.min(startPage + this.pageGroupSize - 1, totalPages);

        const createLink = (label, page) => {
            const a = document.createElement('a');
            a.href = 'javascript:void(0)';
            a.className = this.paginationLink;
            a.dataset.page = page;
            a.textContent = label;
            return a;
        };

        if (startPage > 1) {
            this.paginationContainer.appendChild(createLink('<<', 1));
            this.paginationContainer.appendChild(createLink('<', Math.max(1, startPage - this.pageGroupSize)));
        }

        for (let i = startPage; i <= endPage; i++) {
            const a = createLink(i, i);
            if (i === this.currentPage) a.classList.add('active');
            this.paginationContainer.appendChild(a);
        }

        if (endPage < totalPages) {
            this.paginationContainer.appendChild(createLink('>', startPage + this.pageGroupSize));
            this.paginationContainer.appendChild(createLink('>>', totalPages));
        }
        document.querySelector(`.${this.headerLink}`).appendChild(this.paginationContainer);

        this.paginationContainer.querySelectorAll(`.${this.paginationLink}`).forEach(link => {
            link.addEventListener('click', (e) => {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && page !== this.currentPage) {
                    const newStartPage = Math.floor((page - 1) / this.pageGroupSize) * this.pageGroupSize + 1;
                    this.renderPage(page);
                    this.renderPagination(newStartPage);
                }
            });
        });
    }
    adjustPaginationPosition() {
        const header = document.querySelector(`.${this.headerLink}`);
        const pagination = this.paginationContainer;

        if (header && pagination) {
            const targetHref = this.cssPath;  // 정확한 파일 이름/경로
            const targetSheet = Array.from(document.styleSheets).find(sheet =>
                sheet.href?.includes(targetHref)
            );
            if (targetSheet) {
                for (const rule of targetSheet.cssRules) {
                    if (rule.selectorText === '.'+this.paginationContainer.className) {
                        rule.style.top = `${header.offsetHeight}px`;
                    }
                }
            }
        }
    }
    init() {
        this.renderPage(this.currentPage);
        this.renderPagination();
        this.adjustPaginationPosition();
    }
}