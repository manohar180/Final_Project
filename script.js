class LibraryManager {
    constructor() {
        this.books = this.loadBooks();
        this.setupEventListeners();
    }
    loadBooks() {
        return JSON.parse(localStorage.getItem('library')) || {
            currentlyReading: [],
            readLater: [],
            finished: []
        };
    }
    saveBooks() {
        localStorage.setItem('library', JSON.stringify(this.books));
    }
    async searchBooks(query) {
        try {
            const googleResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&fields=items(id,volumeInfo(title,authors,description,imageLinks,previewLink),accessInfo)`);
            const googleData = await googleResponse.json();
            return googleData.items?.map(book => ({
                id: book.id,
                title: book.volumeInfo.title,
                author: book.volumeInfo.authors ? book.volumeInfo.authors[0] : 'Unknown',
                cover: book.volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/150?text=No+Cover',
                description: book.volumeInfo.description || 'No description available',
                previewLink: book.volumeInfo.previewLink,
                source: 'google'
            })) || [];
        } catch (error) {
            console.error('Error searching books:', error);
            return [];
        }
    }
    mergeSearchResults(googleBooks, openLibraryBooks) {
        const merged = [];
        if (googleBooks) {
            googleBooks.forEach(book => {
                merged.push({
                    id: book.id,
                    title: book.volumeInfo.title,
                    author: book.volumeInfo.authors ? book.volumeInfo.authors[0] : 'Unknown',
                    cover: book.volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/150?text=No+Cover',
                    description: book.volumeInfo.description || 'No description available',
                    source: 'google',
                    accessInfo: book.accessInfo
                });
            });
        }
        if (openLibraryBooks) {
            openLibraryBooks.slice(0, 5).forEach(book => {
                merged.push({
                    id: book.key,
                    title: book.title,
                    author: book.author_name ? book.author_name[0] : 'Unknown',
                    cover: `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`,
                    description: book.first_sentence || 'No description available',
                    source: 'openLibrary'
                });
            });
        }
        return merged;
    }
    addToReadLater(book) {
        if(!this.books.readLater.some(b => b.id === book.id)){
            this.books.readLater.push(book);
            this.saveBooks();
            this.renderShelves();
            alert('Book added to Read Later!');
        } else{
            alert('This book is already in your Read Later list!');
        }
    }
    addBook(book, shelf) {
        if(!this.books[shelf].some(b => b.id === book.id)){
            this.books[shelf].push(book);
            this.saveBooks();
            this.renderShelves();
        }
    }
    removeBook(bookId, shelf) {
        this.books[shelf] = this.books[shelf].filter(book => book.id !== bookId);
        this.saveBooks();
        this.renderShelves();
    }
    moveBook(bookId, fromShelf, toShelf) {
        const book = this.books[fromShelf].find(book => book.id === bookId);
        if(book){
            this.books[fromShelf] = this.books[fromShelf].filter(b => b.id !== bookId);
            this.books[toShelf].push(book);
            this.saveBooks();
            this.renderShelves();
            document.getElementById('bookModal').style.display = 'none';
        }
    }
    updateProgress(bookId, progress) {
        Object.keys(this.books).forEach(shelf => {
            this.books[shelf] = this.books[shelf].map(book => {
                if(book.id === bookId){
                    return { ...book, progress };
                }
                return book;
            });
        });
        this.saveBooks();
        this.renderShelves();
    }
    renderShelves() {
        Object.keys(this.books).forEach(shelf => {
            const container = document.querySelector(`#${shelf} .books-grid`);
            const bookCount = document.querySelector(`#${shelf} .book-count`);
            container.innerHTML = '';
            bookCount.textContent = `${this.books[shelf].length} books`;
            if(shelf === 'currentlyReading'){
                const avgProgress = document.querySelector(`#${shelf} .average-progress`);
                const totalProgress = this.books[shelf].reduce((sum, book) => sum + (book.progress || 0), 0);
                const averageProgress = this.books[shelf].length ? Math.round(totalProgress / this.books[shelf].length) : 0;
                avgProgress.textContent = `${averageProgress}% avg. progress`;
            }
            if(shelf === 'finished' && this.books[shelf].length > 0){
                const completionDate = document.querySelector(`#${shelf} .completion-date`);
                completionDate.textContent = `Last completed: ${new Date().toLocaleDateString()}`;
            }
            this.books[shelf].forEach(book => {
                const bookElement = this.createBookElement(book, shelf);
                container.appendChild(bookElement);
            });
        });
    }
    createBookElement(book, shelf) {
        const div = document.createElement('div');
        div.className = 'book-card';
        div.innerHTML = `
            <img src="${book.cover}" alt="${book.title}" class="book-cover">
            <div class="book-info">
                <div class="book-title">${book.title}</div>
                <div class="book-author">${book.author}</div>
                ${book.progress ? `
                    <div class="progress-bar">
                        <div class="progress" style="width: ${book.progress}%"></div>
                    </div>
                ` : ''}
            </div>
        `;
        div.addEventListener('click', () => this.showBookDetails(book, shelf));
        return div;
    }
    showBookDetails(book, shelf) {
        const modal = document.getElementById('bookModal');
        const details = document.getElementById('bookDetails');
        details.innerHTML = `
            <h2>${book.title}</h2>
            <h3>by ${book.author}</h3>
            <img src="${book.cover}" alt="${book.title}" style="max-width: 200px;">
            <p>${book.description}</p>
            <div class="progress-controls">
                <input type="range" min="0" max="100" value="${book.progress || 0}"
                    onchange="library.updateProgress('${book.id}', this.value)">
                <span>${book.progress || 0}% Complete</span>
            </div>
            <div class="book-management">
                ${shelf === 'readLater' ? 
                    `<button onclick="library.moveBook('${book.id}', 'readLater', 'finished')" class="complete-btn">
                        Mark as Completed
                    </button>` : ''}
                <button onclick="library.removeBook('${book.id}', '${shelf}')" class="remove-btn">
                    Remove Book
                </button>
            </div>
        `;
        modal.style.display = 'block';
    }
    setupEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        const modal = document.getElementById('bookModal');
        const closeBtn = document.querySelector('.close');
        searchBtn.addEventListener('click', async () => {
            const query = searchInput.value.trim();
            if(query){
                const results = await this.searchBooks(query);
                this.displaySearchResults(results);
            }
        });
        searchInput.addEventListener('keypress', async (e) => {
            if(e.key === 'Enter'){
                const query = searchInput.value.trim();
                if(query){
                    const results = await this.searchBooks(query);
                    this.displaySearchResults(results);
                }
            }
        });
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        window.addEventListener('click', (e) => {
            if(e.target === modal){
                modal.style.display = 'none';
            }
        });
    }
    displaySearchResults(results) {
        const container = document.querySelector('#searchResults .books-grid');
        container.innerHTML = '';
        results.forEach(book => {
            const div = document.createElement('div');
            div.className = 'book-card';
            const bookStr = JSON.stringify(book).replace(/"/g, '&quot;');
            div.innerHTML = `
                <img src="${book.cover}" alt="${book.title}" class="book-cover">
                <div class="book-info">
                    <div class="book-title">${book.title}</div>
                    <div class="book-author">${book.author}</div>
                    <div class="book-actions">
                        <button onclick="event.stopPropagation(); library.addToReadLater(${bookStr})" class="add-btn">
                            Add to Read Later
                        </button>
                        ${book.previewLink ? `
                            <button onclick="event.stopPropagation(); window.open('${book.previewLink}', '_blank')" class="preview-btn">
                                Read Book
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            container.appendChild(div);
        });
        document.getElementById('searchResults').style.display = 'block';
    }
}
const library = new LibraryManager();
library.renderShelves();
