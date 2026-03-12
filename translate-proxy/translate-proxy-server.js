const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS - engedélyezzük a GitHub Pages-t
app.use(cors({
    origin: [
        'https://keresohirdetesek-afk.github.io',
        'http://localhost:3000',
        'http://localhost:8080'
    ],
    credentials: true
}));

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Translation Proxy',
        timestamp: new Date().toISOString() 
    });
});

// Translation endpoint
app.post('/translate', async (req, res) => {
    try {
        const { text, sourceLang, targetLang } = req.body;
        
        // Validáció
        if (!text || !targetLang) {
            return res.status(400).json({ 
                error: 'Missing required fields: text, targetLang' 
            });
        }
        
        // API key környezeti változóból
        const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
        
        if (!apiKey) {
            console.error('❌ GOOGLE_TRANSLATE_API_KEY not set!');
            return res.status(500).json({ 
                error: 'Server configuration error' 
            });
        }
        
        // Google Cloud Translation API hívás
        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: text,
                source: sourceLang || 'auto',
                target: targetLang,
                format: 'text'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Google API error:', errorText);
            return res.status(response.status).json({ 
                error: 'Translation API error',
                details: errorText 
            });
        }
        
        const data = await response.json();
        
        // Válasz
        const translatedText = data.data.translations[0].translatedText;
        const detectedSourceLang = data.data.translations[0].detectedSourceLanguage;
        
        console.log(`✅ Translated: "${text}" (${sourceLang || detectedSourceLang}) → "${translatedText}" (${targetLang})`);
        
        res.json({
            translatedText,
            sourceLang: sourceLang || detectedSourceLang,
            targetLang,
            originalText: text
        });
        
    } catch (error) {
        console.error('❌ Translation error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// Text-to-Speech endpoint (opcionális)
app.post('/speak', async (req, res) => {
    try {
        const { text, lang } = req.body;
        
        if (!text || !lang) {
            return res.status(400).json({ 
                error: 'Missing required fields: text, lang' 
            });
        }
        
        // Google Cloud Text-to-Speech API (ha kell később)
        // Egyelőre csak placeholder
        
        res.json({
            message: 'Text-to-Speech not implemented yet',
            text,
            lang
        });
        
    } catch (error) {
        console.error('❌ TTS error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    console.log(`🌍 Translation Proxy listening on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🔑 API Key set: ${process.env.GOOGLE_TRANSLATE_API_KEY ? '✅ YES' : '❌ NO'}`);
});
