async function init() {
    const response = await fetch('data.json');
    window.appData = await response.json();

    const categoriesList = document.getElementById('categories-list');
    const articlesList = document.getElementById('articles-list');
    const articleContent = document.getElementById('article-content');

    function getLatestData() {
        return window.appData;
    }

    function renderCategories() {
        const data = getLatestData();
        categoriesList.innerHTML = '';
        data.categories.forEach(cat => {
            const li = document.createElement('li');
            li.textContent = cat.name;
            li.dataset.id = cat.id;
            li.onclick = () => {
                document.querySelectorAll('#categories-list li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                renderArticles(cat);
            };
            categoriesList.appendChild(li);
        });

        const addBtn = document.createElement('li');
        addBtn.textContent = '+ Add RSS Feed';
        addBtn.className = 'add-feed-btn';
        addBtn.onclick = () => {
            const activeCat = document.querySelector('#categories-list li.active');
            if (!activeCat) {
                alert('Please select a category first');
                return;
            }
            const url = prompt(`Add RSS feed to ${activeCat.textContent}:`);
            if (url) {
                addFeed(activeCat.dataset.id, url);
            }
        };
        categoriesList.appendChild(addBtn);
    }

    async function addFeed(categoryId, url) {
        try {
            const response = await fetch('/add-feed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoryId, url })
            });
            const result = await response.json();
            if (result.success) {
                alert('Feed added successfully!');
                const dataResponse = await fetch('data.json');
                window.appData = await dataResponse.json();
                renderCategories();
                const activeCat = document.querySelector('#categories-list li.active');
                if (activeCat) {
                    const cat = window.appData.categories.find(c => c.id === activeCat.dataset.id);
                    renderArticles(cat);
                }
            } else {
                alert('Error: ' + result.error);
            }
        } catch (e) {
            alert('Failed to add feed');
        }
    }

    async function renderArticles(category) {
        const data = getLatestData();
        articlesList.innerHTML = '<li class="loading">Loading articles...</li>';
        
        let allArticles = [];

        // 1. Get internal articles
        const internal = data.articles.filter(art => art.categoryId === category.id);
        allArticles = [...internal];

        // 2. Get RSS articles (check for .feeds array or .url)
        const feeds = category.feeds || (category.type === 'rss' ? [category.url] : []);
        
        if (feeds.length > 0) {
            const feedPromises = feeds.map(async (url) => {
                try {
                    const res = await fetch(`/rss?url=${encodeURIComponent(url)}`);
                    const feedData = await res.json();
                    return Array.isArray(feedData) ? feedData : [];
                } catch (e) {
                    return [];
                }
            });
            
            const results = await Promise.all(feedPromises);
            allArticles = [...allArticles, ...results.flat()];
        }
        
        articlesList.innerHTML = '';
        if (allArticles.length === 0) {
            articlesList.innerHTML = '<li style="color: #666;">No articles found.</li>';
            return;
        }

        allArticles.forEach(art => {
            const li = document.createElement('li');
            li.textContent = art.title;
            li.onclick = () => {
                document.querySelectorAll('#articles-list li').forEach(el => el.classList.remove('active'));
                li.classList.add('active');
                renderContent(art);
            };
            articlesList.appendChild(li);
        });
    }

    async function renderContent(article) {
        if (article.isExternal) {
            articleContent.innerHTML = `
                <h1>${article.title}</h1>
                <p><em>Loading full article...</em></p>
            `;
            
            try {
                const response = await fetch(`/full-content?url=${encodeURIComponent(article.link)}`);
                const data = await response.json();
                
                if (data.error) {
                    articleContent.innerHTML = `
                        <h1>${article.title}</h1>
                        <p style="color: red;">${data.error}</p>
                        <p>${article.content}</p>
                        <br><a href="${article.link}" target="_blank">Read original article on source website</a>
                    `;
                } else {
                    articleContent.innerHTML = `
                        <h1>${article.title}</h1>
                        <div class="full-article-body">${data.content}</div>
                        <hr>
                        <p><small>Source: <a href="${article.link}" target="_blank">${article.link}</a></small></p>
                    `;
                }
            } catch (e) {
                articleContent.innerHTML = `
                    <h1>${article.title}</h1>
                    <p style="color: red;">An error occurred while loading the full content.</p>
                    <p>${article.content}</p>
                    <br><a href="${article.link}" target="_blank">Read original article on source website</a>
                `;
            }
        } else {
            articleContent.innerHTML = `
                <h1>${article.title}</h1>
                <p>${article.content}</p>
            `;
        }
    }

    renderCategories();
}

init();
