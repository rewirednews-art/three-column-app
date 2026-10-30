const express = require('express');
const path = require('path');
const Parser = require('rss-parser');
const axios = require('axios');
const fs = require('fs');
const cheerio = require('cheerio');
const app = express();
const parser = new Parser();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_PATH = path.join(__dirname, 'public', 'data.json');

app.get('/rss', async (req, res) => {
    const feedUrl = req.query.url;
    if (!feedUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    if (!feedUrl.startsWith('http://') && !feedUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'The provided link is not a valid URL.' });
    }

    try {
        const response = await axios.get(feedUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 5000
        });
        const feed = await parser.parseString(response.data);
        const articles = feed.items.map(item => ({
            id: item.guid || item.link,
            title: item.title,
            content: item.contentSnippet || item.content || 'No summary available.',
            link: item.link,
            isExternal: true
        }));
        res.json(articles);
    } catch (error) {
        console.error(`RSS error for ${feedUrl}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch RSS feed' });
    }
});

app.post('/add-feed', (req, res) => {
    const { categoryId, url } = req.body;
    if (!categoryId || !url) {
        return res.status(400).json({ error: 'categoryId and url are required' });
    }

    try {
        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        const category = data.categories.find(c => c.id === categoryId);
        
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        if (!category.feeds) {
            category.feeds = [];
        }

        if (!category.feeds.includes(url)) {
            category.feeds.push(url);
        }

        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({ error: 'Failed to save feed' });
    }
});

app.get('/full-content', async (req, res) => {
    const articleUrl = req.query.url;
    if (!articleUrl) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    // Validate that the URL is actually a URL and starts with http/https
    if (!articleUrl.startsWith('http://') && !articleUrl.startsWith('https://')) {
        return res.status(400).json({ error: 'The provided link is not a valid URL.' });
    }

    try {
        const response = await axios.get(articleUrl, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            timeout: 5000 // Set a 5-second timeout so the server doesn't hang on broken links
        });
        const $ = cheerio.load(response.data);

        // Common selectors for the main content of an article
        const selectors = [
            'article', 
            '.post-content', 
            '.entry-content', 
            '.article-body', 
            'main', 
            '#content',
            '.main-content'
        ];

        let content = '';
        for (const selector of selectors) {
            const element = $(selector).first();
            if (element.length) {
                const clone = element.clone();
                clone.find('script, style, iframe, nav, footer, header, aside, ins, form, .ads, .advertisement, .social-share, .newsletter-signup').remove();
                
                clone.find('*').each((i, el) => {
                    const className = $(el).attr('class') || '';
                    const id = $(el).attr('id') || '';
                    const noiseKeywords = ['nav', 'sidebar', 'footer', 'header', 'menu', 'social', 'share', 'ad-box', 'widget'];
                    if (noiseKeywords.some(keyword => className.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword))) {
                        $(el).remove();
                    }
                });

                content = clone.html();
                break;
            }
        }

        if (!content || content.trim().length < 100) {
            content = $('body').text().substring(0, 5000);
        }

        res.json({ content: content });
    } catch (error) {
        console.error(`Scraping error for ${articleUrl}:`, error.message);
        res.status(500).json({ error: 'Failed to extract full content from the page. The site may be blocking access or the link is broken.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
