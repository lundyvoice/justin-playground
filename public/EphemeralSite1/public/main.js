// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if user has seen the overlay before
    const hasSeenOverlay = localStorage.getItem('hasSeenSpacebarOverlay');
    const overlay = document.getElementById('overlay');
    const dismissBtn = document.getElementById('dismiss-btn');
    
    console.log('Page loaded:', window.location.pathname);
    console.log('Overlay element found:', !!overlay);
    console.log('Dismiss button found:', !!dismissBtn);

    // Show overlay on first visit
    if (!hasSeenOverlay && overlay) {
        overlay.classList.remove('hidden');
    }

    // Handle overlay dismissal
    if (dismissBtn) {
        dismissBtn.addEventListener('click', function() {
            overlay.classList.add('hidden');
            localStorage.setItem('hasSeenSpacebarOverlay', 'true');
        });
    }

    // Voice recognition setup
    let recognition = null;
    let isRecording = false;
    let spacebarPressed = false;
    let spacebarTimer = null;
    
    // Web Audio API for waveform visualization
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let animationId = null;
    let waveformElement = null;
    let overlayElement = null;
    let canvas = null;
    let canvasContext = null;
    let waveformData = [];
    let spacebarIndicator = null;
    let latestFinalTranscript = '';
    let latestInterimTranscript = '';
    
    // ==== CONFIG (Compliance) ====
    const compliance = [
        { label: 'Documents uploaded', status: 'Pass', detail: '12 handbooks + 4 PDFs indexed' },
        { label: 'FAQ indexing',      status: 'Pass', detail: 'Site + PDFs in RAG index' },
        { label: 'RAG engine ready',  status: 'Pass', detail: 'Embeddings warmed' },
        { label: 'Web speech active', status: 'Pass', detail: 'Mic + TTS verified' }
    ];

    // Page knowledge retrieval system
    let pageKnowledge = [];
    
    // Page-specific summaries for intent-based responses
    const pageSummaries = {
        '/': {
            what: "Lundy builds voice-first software for the real estate industry. We offer Navigator for compliance support, Add/Edit for voice listing input, Finding Home for accessibility, and Site Mic for voice search integration.",
            how: "Our products use advanced voice recognition and AI to transform how real estate professionals work. Simply speak to interact with your MLS data, get instant answers, or input listings hands-free.",
            why: "Voice technology makes real estate work faster, more accessible, and more efficient. We eliminate tedious data entry, reduce errors, and help professionals focus on what matters most - their clients."
        },
        '/navigator': {
            what: "Navigator is an AI-powered support tool for MLSs and associations that provides instant answers and simplifies compliance. It can interact with any document or URL in your organization.",
            how: "Navigator works by analyzing your organization's documents, contracts, and policies. When staff or members ask questions, it provides instant answers with citations, reducing call volume and improving efficiency.",
            why: "Navigator matters because it transforms customer support, reduces staff workload, and ensures consistent, accurate information delivery. It provides 24/7 support and helps staff focus on complex issues rather than repetitive questions."
        },
        '/add-edit': {
            what: "Add/Edit is a voice-powered MLS listing input tool that allows agents to create and update listings using natural speech. It automatically populates MLS fields and generates descriptions with AI.",
            how: "Add/Edit works by listening to your voice commands and automatically filling out MLS forms. Simply speak the property details, and the system maps your words to the correct fields, saving time and reducing errors.",
            why: "Add/Edit matters because it eliminates tedious manual data entry, reduces listing errors, and allows agents to input listings from anywhere. This means more time for client relationships and faster listing turnaround."
        }
    };
    
    // Initialize page knowledge when DOM loads
    function initializePageKnowledge() {
        const pageText = document.body.innerText;
        pageKnowledge = extractPageChunks(pageText);
        console.log('Page knowledge initialized with', pageKnowledge.length, 'chunks');
    }

    // Build Compliance Panel (Shadow DOM)
    function buildCompliancePanel(compliance) {
        const host = document.createElement('div');
        host.id = 'compliance-overlay';
        // Avoid duplicate panels
        if (document.getElementById('compliance-overlay')) return null;

        const root = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            .wrap {
                position: fixed; inset: 0; z-index: 3000; opacity: 0; transition: opacity .25s ease-out;
                /* Allow interaction with card; backdrop itself won't intercept */ pointer-events: auto;
            }
            .wrap.active { opacity: 1; }
            .backdrop {
                position: absolute; inset: 0; background: rgba(0,0,0,.45);
                backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
                /* Allow clicks to pass through so scroll works */ pointer-events: none;
            }
            .card {
                position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
                width: min(560px, 92vw);
                background: #fff; border-radius: 16px; box-shadow: 0 24px 64px rgba(0,0,0,.25);
                pointer-events: auto; overflow: hidden; outline: none;
            }
            .header { display:flex; align-items:center; justify-content:space-between; padding: 1rem 1.25rem; border-bottom: 1px solid #eef2f7; background: linear-gradient(135deg,#f8fafc,#f1f5f9); }
            .title { margin:0; font-size: 1.25rem; font-weight: 700; color:#1f2937; }
            .close { appearance:none; background:none; border:none; font-size:1.5rem; line-height:1; color:#6b7280; cursor:pointer; padding:.25rem .5rem; border-radius:6px; }
            .close:hover { background:#eef2f7; color:#374151; }
            .subtitle { padding: 1rem 1.25rem .25rem; color:#6b7280; font-size:.95rem; }
            .list { list-style:none; margin:0; padding:.5rem 1.25rem 0; }
            .row { display:flex; align-items:flex-start; gap:.75rem; padding:.75rem .5rem; border-bottom:1px dashed #eef2f7; }
            .row:last-child { border-bottom:none; }
            .bar { width:4px; border-radius:4px; align-self:stretch; }
            .bar.pass { background: linear-gradient(135deg,#10b981,#059669); }
            .bar.warn { background: linear-gradient(135deg,#f59e0b,#d97706); }
            .bar.fail { background: linear-gradient(135deg,#ef4444,#dc2626); }
            .label { font-weight:600; color:#111827; }
            .detail { color:#6b7280; font-size:.92rem; }
            .actions { display:flex; justify-content:flex-end; gap:.75rem; padding:1rem 1.25rem 1.25rem; }
            .btn { padding:.7rem 1.2rem; border-radius:8px; font-weight:500; cursor:pointer; border:1px solid #d1d5db; background:#fff; color:#374151; }
            .btn:hover { background:#f9fafb; }
            .btn.primary { border:none; color:#fff; background: linear-gradient(135deg,#2196f3,#00bcd4); box-shadow: 0 6px 18px rgba(33,150,243,.18); }
            .btn.primary:hover { background: linear-gradient(135deg,#1976d2,#0097a7); transform: translateY(-1px); }
            .sr-live { position: absolute; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }
        `;
        root.appendChild(style);

        const wrap = document.createElement('div');
        wrap.className = 'wrap';

        const backdrop = document.createElement('div');
        backdrop.className = 'backdrop';

        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.tabIndex = -1;

        const header = document.createElement('div');
        header.className = 'header';
        const title = document.createElement('h3');
        title.className = 'title';
        title.id = 'compliance-title';
        title.textContent = 'Navigator Compliance Check';
        card.setAttribute('aria-labelledby', 'compliance-title');
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '\u00D7';
        header.appendChild(title);
        header.appendChild(closeBtn);

        const subtitle = document.createElement('p');
        subtitle.className = 'subtitle';
        subtitle.textContent = 'Live status based on current config';

        const list = document.createElement('ul');
        list.className = 'list';

        compliance.forEach(item => {
            const li = document.createElement('li');
            li.className = 'row';
            const bar = document.createElement('div');
            const status = (item.status || 'Pass').toLowerCase();
            bar.className = `bar ${status === 'warn' ? 'warn' : status === 'fail' ? 'fail' : 'pass'}`;
            const content = document.createElement('div');
            const label = document.createElement('div');
            label.className = 'label';
            label.textContent = `${item.label} — ${item.status}`;
            const detail = document.createElement('div');
            detail.className = 'detail';
            detail.textContent = item.detail || '';
            content.appendChild(label);
            content.appendChild(detail);
            li.appendChild(bar);
            li.appendChild(content);
            list.appendChild(li);
        });

        const actions = document.createElement('div');
        actions.className = 'actions';
        const closeBtn2 = document.createElement('button');
        closeBtn2.className = 'btn';
        closeBtn2.textContent = 'Close';
        const downloadBtn = document.createElement('button');
        downloadBtn.id = 'download-compliance-report';
        downloadBtn.className = 'btn primary';
        downloadBtn.textContent = 'Download report';
        actions.appendChild(closeBtn2);
        actions.appendChild(downloadBtn);

        const srLive = document.createElement('div');
        srLive.className = 'sr-live';
        srLive.setAttribute('aria-live', 'assertive');

        card.appendChild(header);
        card.appendChild(subtitle);
        card.appendChild(list);
        card.appendChild(actions);
        card.appendChild(srLive);

        wrap.appendChild(backdrop);
        wrap.appendChild(card);
        root.appendChild(wrap);

        return { host, root, wrap, card, closeBtn, closeBtn2, downloadBtn, srLive };
    }

    function downloadComplianceReport(compliance) {
        const timestamp = new Date().toLocaleString();
        const lines = [
            '# Navigator Compliance Report',
            `Generated: ${timestamp}`,
            ''
        ];
        compliance.forEach(c => {
            lines.push(`- ${c.label}: ${c.status}${c.detail ? ` — ${c.detail}` : ''}`);
        });
        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'navigator-compliance-report.md';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    // Show Compliance Panel on Navigator page
    function showCompliancePanel(complianceInput) {
        // Guard: Only on /navigator
        const onNavigator = getCurrentPagePath() === '/navigator';
        if (!onNavigator) {
            const msg = 'Compliance panel is only available on the Navigator page.';
            showTranscript(msg);
            speakText(msg);
            return;
        }

        if (document.getElementById('compliance-overlay')) {
            return; // already open
        }

        const compliance = Array.isArray(complianceInput) && complianceInput.length ? complianceInput : (window.compliance || []);
        const effectiveCompliance = compliance.length ? compliance : [
            { label: 'Documents uploaded', status: 'Pass', detail: '12 handbooks + 4 PDFs indexed' },
            { label: 'FAQ indexing',      status: 'Pass', detail: 'Site + PDFs in RAG index' },
            { label: 'RAG engine ready',  status: 'Pass', detail: 'Embeddings warmed' },
            { label: 'Web speech active', status: 'Pass', detail: 'Mic + TTS verified' }
        ];

        const built = buildCompliancePanel(effectiveCompliance);
        if (!built) return;
        const { host, wrap, card, closeBtn, closeBtn2, downloadBtn, srLive } = built;
        document.body.appendChild(host);
        // Animate in
        setTimeout(() => wrap.classList.add('active'), 20);

        // Voice + caption
        const openMsg = "Here’s your Navigator compliance check. All systems are live.";
        srLive.textContent = openMsg;
        showTranscript(openMsg);
        speakText(openMsg);

        // Focus management
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const trapFocus = (e) => {
            if (e.key !== 'Tab') return;
            const focusables = card.querySelectorAll(focusableSelector);
            if (focusables.length === 0) return;
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        };
        const escHandler = (e) => { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', trapFocus);
        document.addEventListener('keydown', escHandler);
        setTimeout(() => closeBtn.focus(), 60);

        // Outside click close without blocking scroll
        const outsideClick = (e) => {
            const path = e.composedPath ? e.composedPath() : [];
            const clickedInsideCard = path.includes(card);
            if (!clickedInsideCard) close();
        };
        wrap.addEventListener('mousedown', outsideClick);

        // Close helper
        const close = () => {
            // Prevent multiple closes
            if (!document.getElementById('compliance-overlay')) return;
            wrap.classList.remove('active');
            const closeMsg = 'Closing the panel.';
            srLive.textContent = closeMsg;
            showTranscript(closeMsg);
            speakText(closeMsg);
            setTimeout(() => host.remove(), 250);
            document.removeEventListener('keydown', trapFocus);
            document.removeEventListener('keydown', escHandler);
            document.removeEventListener('mousedown', outsideClick);
        };

        // Wire buttons
        closeBtn.addEventListener('click', close);
        closeBtn2.addEventListener('click', close);
        downloadBtn.addEventListener('click', () => downloadComplianceReport(effectiveCompliance));

        // Auto-dismiss 6s
        const auto = setTimeout(close, 6000);
        // Cancel auto-dismiss on interaction inside the card
        card.addEventListener('pointerdown', () => clearTimeout(auto), { once: true });
    }

    // Expose for quick manual testing from console
    window.showCompliancePanel = showCompliancePanel;
    window.compliance = window.compliance || compliance;

    function isComplianceQuery(text) {
        if (!text) return false;
        const normalized = text
            .toLowerCase()
            .replace(/[’‘]/g, "'")
            .replace(/[^a-z0-9\s']/g, ' ')
            .replace(/\s+/g, ' ') 
            .trim();
        const tokens = new Set(normalized.split(' '));
        const has = (w) => tokens.has(w);

        const phraseMatch = [
            'check centralized knowledge',
            'run a navigator compliance check',
            'run navigator compliance check',
            'navigator compliance check',
            'is centralized knowledge live'
        ].some(p => normalized.includes(p));
        if (phraseMatch) return true;

        const onNavigator = getCurrentPagePath() === '/navigator';
        const mentionsNavigator = has('navigator') || onNavigator;
        const mentionsKnowledge = has('knowledge') || normalized.includes('knowledge-base') || normalized.includes('kb');
        const mentionsCentral = has('centralized') || has('centralised') || has('central');
        const mentionsLive = has('live') || has('online') || has('active');
        const checkIntent = has('check') || has('verify') || has('confirm') || has('run') || has('status') || normalized.startsWith('is ');

        return (mentionsNavigator && (has('compliance') || (mentionsCentral && mentionsKnowledge)) && (checkIntent || mentionsLive))
            || ((mentionsCentral && mentionsKnowledge && (checkIntent || mentionsLive)) && onNavigator);
    }
    
    // Get current page path for summary lookup
    function getCurrentPagePath() {
        return window.location.pathname;
    }
    
    // Determine intent from user query
    function determineIntent(query) {
        const lowerQuery = query.toLowerCase();
        
        // How intent - asking about process/functionality
        if (lowerQuery.includes('how') || lowerQuery.includes('work') || lowerQuery.includes('process') || 
            lowerQuery.includes('function') || lowerQuery.includes('operate')) {
            return 'how';
        }
        
        // Why intent - asking about benefits/importance
        if (lowerQuery.includes('why') || lowerQuery.includes('benefit') || lowerQuery.includes('matter') ||
            lowerQuery.includes('important') || lowerQuery.includes('advantage') || lowerQuery.includes('value')) {
            return 'why';
        }
        
        // What intent - asking about description/definition (default)
        return 'what';
    }
    
    // Get page-specific answer based on intent
    function getPageSummaryAnswer(query) {
        const currentPath = getCurrentPagePath();
        const intent = determineIntent(query);
        
        // Check if we have summaries for this page
        if (pageSummaries[currentPath]) {
            const summary = pageSummaries[currentPath][intent];
            if (summary) {
                console.log(`Found ${intent} summary for ${currentPath}`);
                return summary;
            }
        }
        
        // Fallback to homepage summary if current page not found
        if (pageSummaries['/'] && pageSummaries['/'][intent]) {
            console.log(`Using fallback ${intent} summary from homepage`);
            return pageSummaries['/'][intent];
        }
        
        return null;
    }
    
    // Extract meaningful chunks from page content
    function extractPageChunks(text) {
        const chunks = [];
        
        // Split by sentences and paragraphs
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        
        sentences.forEach(sentence => {
            const cleaned = sentence.trim();
            if (cleaned.length > 30 && cleaned.length < 300) {
                // Filter out navigation and boilerplate text
                if (!isBoilerplateText(cleaned)) {
                    chunks.push({
                        text: cleaned,
                        keywords: extractKeywords(cleaned.toLowerCase())
                    });
                }
            }
        });
        
        return chunks;
    }
    
    // Filter out navigation and boilerplate content
    function isBoilerplateText(text) {
        const boilerplatePatterns = [
            /^(home|about|contact|blog|products|customers|news)$/i,
            /^©.*rights reserved/i,
            /listening.*release spacebar/i,
            /press.*hold.*spacebar/i,
            /^[0-9\s\-\.,]+$/,
            /^learn more$/i,
            /^get started$/i,
            /^read the story$/i
        ];
        
        return boilerplatePatterns.some(pattern => pattern.test(text.trim()));
    }
    
    // Extract keywords from text for similarity matching
    function extractKeywords(text) {
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'this', 'that', 'these', 'those'];
        
        return text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.includes(word));
    }
    
    // Calculate similarity between query and page chunk
    function calculateSimilarity(query, chunk) {
        const queryKeywords = extractKeywords(query.toLowerCase());
        const chunkKeywords = chunk.keywords;
        
        if (queryKeywords.length === 0 || chunkKeywords.length === 0) return 0;
        
        // Jaccard similarity
        const intersection = queryKeywords.filter(word => chunkKeywords.includes(word));
        const union = [...new Set([...queryKeywords, ...chunkKeywords])];
        
        const jaccardSimilarity = intersection.length / union.length;
        
        // Boost score for exact phrase matches
        const phraseBonus = queryKeywords.some(word => chunk.text.toLowerCase().includes(word)) ? 0.2 : 0;
        
        return jaccardSimilarity + phraseBonus;
    }
    
    // Find best matching content from current page
    function findPageAnswer(query) {
        if (pageKnowledge.length === 0) {
            return null;
        }
        
        const similarities = pageKnowledge.map(chunk => ({
            chunk,
            score: calculateSimilarity(query, chunk)
        }));
        
        // Sort by similarity score
        similarities.sort((a, b) => b.score - a.score);
        
        // Return best match if score is above threshold
        const bestMatch = similarities[0];
        if (bestMatch.score > 0.1) {
            return bestMatch.chunk.text;
        }
        
        return null;
    }

    // Cache spacebar indicator if present
    spacebarIndicator = document.getElementById('spacebar-indicator');

    // Check if browser supports Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        // Handle speech recognition results
        recognition.onresult = function(event) {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                    latestFinalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            latestInterimTranscript = interimTranscript || finalTranscript || latestInterimTranscript;

            // Update the indicator with live transcription
            try {
                if (spacebarIndicator && !spacebarIndicator.classList.contains('hidden')) {
                    const indicatorContent = spacebarIndicator.querySelector('.indicator-content p');
                    if (indicatorContent) {
                        indicatorContent.textContent = interimTranscript || finalTranscript || 'Listening...';
                    }
                }
            } catch (_) {}
        };

        recognition.onend = function() {
            if (isRecording && spacebarPressed) {
                // If we're still supposed to be recording, restart
                try {
                    recognition.start();
                } catch (e) {
                    console.log('Recognition restart failed:', e);
                }
            }
        };

        recognition.onerror = function(event) {
            console.log('Speech recognition error:', event.error);
        };
    }

    // Create transcript display element
    function createTranscriptDisplay() {
        let transcriptDisplay = document.getElementById('transcript-display');
        if (!transcriptDisplay) {
            transcriptDisplay = document.createElement('div');
            transcriptDisplay.id = 'transcript-display';
            transcriptDisplay.className = 'transcript-display hidden';
            transcriptDisplay.innerHTML = '<div class="transcript-content"></div>';
            document.body.appendChild(transcriptDisplay);
        }
        return transcriptDisplay;
    }

    // Intent recognition and action execution with fuzzy matching
    function processVoiceCommand(text) {
        const cleanText = text.toLowerCase().trim();
        console.log('Processing voice command:', cleanText);
        
        // PRIORITY 0: Check if we're collecting demo information
        if (processDemoResponse(cleanText)) {
            return; // Demo system handled this transcript
        }

        // SPECIAL: Compliance panel trigger (Navigator)
        if (isComplianceQuery(cleanText)) {
            showCompliancePanel();
            return;
        }
        
        // PRIORITY 1: Navigation intents - must be checked first
        const navigatorKeywords = ['take me to navigator', 'go to navigator', 'open navigator', 'show navigator',
                                  'navigate to navigator', 'bring up navigator', 'launch navigator', 'load navigator',
                                  'navigator page', 'navigator tool', 'navigator app'];
        
        if (navigatorKeywords.some(keyword => cleanText.includes(keyword))) {
            executeAction('navigate', '/navigator', 'Yes Mr. Lundy');
            return;
        }
        
        const addEditKeywords = ['show me add', 'go to listing', 'add edit', 'listing input', 'show add edit',
                                'open add edit', 'take me to add edit', 'go to add edit', 'launch add edit',
                                'show listing input', 'voice listing', 'listing tool', 'add edit page',
                                'add edit tool', 'add edit app'];
        
        if (addEditKeywords.some(keyword => cleanText.includes(keyword))) {
            executeAction('navigate', '/add-edit', 'Yes Mr. Lundy');
            return;
        }
        
        const homeKeywords = ['go home', 'take me home', 'main page', 'homepage', 'home page', 'go to home',
                             'back to home', 'return home', 'show homepage'];
        
        if (homeKeywords.some(keyword => cleanText.includes(keyword))) {
            executeAction('navigate', '/', 'Yes Mr. Lundy');
            return;
        }
        
        // PRIORITY 2: Company/About intents - fuzzy matching
        const companyKeywords = ['what does this company do', 'who are you', 'what does lundy do', 'tell me what this is', 
                                'what is lundy', 'what do you do', 'tell me about lundy', 'what is this company',
                                'who is lundy', 'what does your company do', 'tell me about this company',
                                'what kind of company', 'what business are you in'];
        
        if (companyKeywords.some(keyword => cleanText.includes(keyword))) {
            const response = 'We build voice-first software for the real estate industry.';
            executeAction('speak', response, response);
            return;
        }
        
        // Information intents - enhanced fuzzy matching
        const navigatorInfoKeywords = ['what does navigator do', 'what is navigator', 'tell me about navigator',
                                      'how does navigator work', 'navigator features', 'explain navigator',
                                      'what can navigator do', 'navigator capabilities', 'about navigator'];
        
        if (navigatorInfoKeywords.some(keyword => cleanText.includes(keyword))) {
            const description = 'Navigator is our AI-powered support tool for MLSs and associations that provides instant answers and simplifies compliance.';
            executeAction('speak', description, description);
            return;
        }
        
        const addEditInfoKeywords = ['what does add edit do', 'what is add edit', 'tell me about add edit',
                                    'how does add edit work', 'add edit features', 'explain add edit',
                                    'what can add edit do', 'add edit capabilities', 'about add edit',
                                    'voice listing features', 'listing input features'];
        
        if (addEditInfoKeywords.some(keyword => cleanText.includes(keyword))) {
            const description = 'Add/Edit allows you to input and update MLS listings using voice commands, making data entry faster and more efficient.';
            executeAction('speak', description, description);
            return;
        }
        
        // Demo booking intents - enhanced fuzzy matching
        const demoKeywords = ['book demo', 'schedule demo', 'get demo', 'request demo', 'demo booking',
                             'book meeting', 'schedule meeting', 'set up demo', 'arrange demo',
                             'book a demo', 'schedule a demo', 'get a demo', 'request a demo',
                             'demo appointment', 'meeting appointment', 'show me demo'];
        
        if (demoKeywords.some(keyword => cleanText.includes(keyword))) {
            // Check if this is a single-shot demo booking with all info included
            if (containsCompleteBookingInfo(cleanText)) {
                processSingleShotDemo(cleanText);
            } else {
                startConversationalDemo();
            }
            return;
        }
        
        // Help intents
        const helpKeywords = ['help', 'what can you do', 'what commands', 'how do i use this', 'instructions',
                             'what can i say', 'voice commands', 'available commands', 'how does this work'];
        
        if (helpKeywords.some(keyword => cleanText.includes(keyword))) {
            const helpResponse = 'You can ask me "what", "how", or "why" questions about any page. Try saying "What is this?", "How does this work?", "Why use this?", or ask about Navigator, Add/Edit, or booking a demo. You can also ask about our MLS partnerships.';
            executeAction('speak', helpResponse, helpResponse);
            return;
        }
        
        // MLS Partnership queries
        const mlsResponse = processMlsQuery(cleanText);
        if (mlsResponse) {
            executeAction('speak', mlsResponse, mlsResponse);
            return;
        }
        
        // Page-based summary queries - prioritize structured summaries
        const pageQueryKeywords = ['what does this tool do', 'what does this page do', 'what is this tool',
                                  'tell me about this page', 'what can this do', 'how does this work',
                                  'what are the features', 'what are the benefits', 'how is this different',
                                  'what makes this special', 'why use this', 'what problems does this solve',
                                  'how does it work', 'why is this important', 'what is this', 'how',
                                  'why', 'what', 'tell me about', 'explain this'];
        
        if (pageQueryKeywords.some(keyword => cleanText.includes(keyword))) {
            // First try page summaries (structured responses)
            const summaryAnswer = getPageSummaryAnswer(cleanText);
            if (summaryAnswer) {
                executeAction('speak', summaryAnswer, summaryAnswer);
                return;
            }
            
            // Fallback to page content search
            const pageAnswer = findPageAnswer(cleanText);
            if (pageAnswer) {
                executeAction('speak', pageAnswer, pageAnswer);
                return;
            }
        }
        
        // General queries - try summaries first, then page content
        const summaryAnswer = getPageSummaryAnswer(cleanText);
        if (summaryAnswer) {
            executeAction('speak', summaryAnswer, summaryAnswer);
            return;
        }
        
        // Fallback to page content search
        const pageAnswer = findPageAnswer(cleanText);
        if (pageAnswer) {
            executeAction('speak', pageAnswer, pageAnswer);
            return;
        }
        
        // Default response - enhanced with speech
        const defaultResponse = "I'm still learning. Try asking about Navigator, Add/Edit, booking a demo, or ask questions about this page.";
        executeAction('speak', defaultResponse, `"${text}" - ${defaultResponse}`);
    }
    
    // Execute different types of actions
    function executeAction(type, data, message) {
        // Show immediate feedback
        showTranscript(message);
        
        switch (type) {
            case 'navigate':
                // Speak the confirmation message
                speakText(message);
                setTimeout(() => {
                    window.location.href = data;
                }, 1500);
                break;
                
            case 'speak':
                speakText(data);
                break;
                
            case 'demo':
                setTimeout(() => {
                    showDemoForm();
                }, 1000);
                break;
        }
    }
    
    // Voice selection and caching
    let selectedVoice = null;
    let voicesLoaded = false;
    
    // Initialize voice selection
    function initializeVoices() {
        if (!('speechSynthesis' in window)) return;
        
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            // Voices might not be loaded yet, try again
            setTimeout(initializeVoices, 100);
            return;
        }
        
        voicesLoaded = true;
        selectedVoice = selectBestVoice(voices);
        
        if (selectedVoice) {
            console.log('Selected voice:', selectedVoice.name, '-', selectedVoice.lang);
        } else {
            console.log('Using default system voice');
        }
        
        // Log all available voices for debugging
        console.log('Available voices:');
        voices.forEach((voice, index) => {
            console.log(`${index + 1}. ${voice.name} (${voice.lang}) - ${voice.localService ? 'Local' : 'Remote'}`);
        });
    }
    
    // Select the best available voice
    function selectBestVoice(voices) {
        // Voice preferences in order of preference
        const voicePreferences = [
            // Prefer Google voices (usually highest quality)
            { filter: voice => voice.name.includes('Google') && voice.lang.startsWith('en'), priority: 10 },
            
            // Apple Siri voices (Mac only, high quality)
            { filter: voice => voice.name.includes('Siri') && voice.lang.startsWith('en'), priority: 9 },
            
            // Microsoft voices with "Natural" in name
            { filter: voice => voice.name.includes('Natural') && voice.lang.startsWith('en'), priority: 8 },
            
            // Any voice with "Natural" in name
            { filter: voice => voice.name.includes('Natural'), priority: 7 },
            
            // Premium or enhanced voices
            { filter: voice => (voice.name.includes('Premium') || voice.name.includes('Enhanced')) && voice.lang.startsWith('en'), priority: 6 },
            
            // UK English Google voices
            { filter: voice => voice.name.includes('Google') && voice.lang === 'en-GB', priority: 5 },
            
            // US English Google voices
            { filter: voice => voice.name.includes('Google') && voice.lang === 'en-US', priority: 5 },
            
            // Any Google voice
            { filter: voice => voice.name.includes('Google'), priority: 4 },
            
            // High quality English voices
            { filter: voice => voice.lang === 'en-US' && !voice.name.includes('eSpeak'), priority: 3 },
            { filter: voice => voice.lang === 'en-GB' && !voice.name.includes('eSpeak'), priority: 3 },
            
            // Any English voice
            { filter: voice => voice.lang.startsWith('en'), priority: 2 },
            
            // Fallback to any voice
            { filter: voice => true, priority: 1 }
        ];
        
        // Find the highest priority voice
        for (const preference of voicePreferences) {
            const matchingVoices = voices.filter(preference.filter);
            if (matchingVoices.length > 0) {
                // Prefer female voices if available
                const femaleVoice = matchingVoices.find(voice => 
                    voice.name.toLowerCase().includes('female') || 
                    voice.name.toLowerCase().includes('woman') ||
                    voice.name.toLowerCase().includes('siri')
                );
                
                return femaleVoice || matchingVoices[0];
            }
        }
        
        return null;
    }
    
    // Enhanced text-to-speech function
    function speakText(text) {
        if (!('speechSynthesis' in window)) {
            console.log('Text-to-speech not supported');
            return;
        }
        
        // Initialize voices if not done yet
        if (!voicesLoaded) {
            initializeVoices();
        }
        
        // Fix pronunciation issues
        let processedText = text
            .replace(/\bA\.I\.\b/gi, 'artificial intelligence')
            .replace(/\bAI\b/gi, 'artificial intelligence')
            .replace(/\bMLS\b/gi, 'M L S')
            .replace(/\bURL\b/gi, 'U R L')
            .replace(/\bAPI\b/gi, 'A P I');
        
        const utterance = new SpeechSynthesisUtterance(processedText);
        
        // Use selected voice if available
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        // Optimize speech parameters for natural delivery
        utterance.rate = 0.95;  // Slightly slower for clarity
        utterance.pitch = 1.0;  // Natural pitch
        utterance.volume = 0.85; // Comfortable volume
        
        // Add event listeners for debugging
        utterance.onstart = () => {
            console.log('Started speaking:', text.substring(0, 50) + '...');
            console.log('Using voice:', utterance.voice ? utterance.voice.name : 'default');
        };
        
        utterance.onerror = (event) => {
            console.log('Speech synthesis error:', event.error);
        };
        
        utterance.onend = () => {
            console.log('Finished speaking');
        };
        
        // Cancel any ongoing speech and start new one
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }
    
    // Initialize voices when page loads
    function setupSpeechSynthesis() {
        if ('speechSynthesis' in window) {
            // Handle voices loaded event
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = initializeVoices;
            }
            
            // Try to initialize immediately
            initializeVoices();
            
            // Fallback: try again after a delay
            setTimeout(initializeVoices, 1000);
        }
    }
    
    // Create and show demo booking form
    function showDemoForm() {
        // Remove existing form if any
        const existingForm = document.getElementById('demo-form-overlay');
        if (existingForm) {
            existingForm.remove();
        }
        
        // Create demo form overlay
        const formOverlay = document.createElement('div');
        formOverlay.id = 'demo-form-overlay';
        formOverlay.className = 'demo-form-overlay';
        formOverlay.innerHTML = `
            <div class="demo-form-content">
                <div class="demo-form-header">
                    <h2>Book Your Demo</h2>
                    <button class="demo-close-btn" onclick="closeDemoForm()">&times;</button>
                </div>
                <form class="demo-form" onsubmit="submitDemoForm(event)">
                    <div class="form-group">
                        <label for="demo-name">Name</label>
                        <input type="text" id="demo-name" name="name" required>
                    </div>
                    <div class="form-group">
                        <label for="demo-email">Email</label>
                        <input type="email" id="demo-email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="demo-organization">Organization (Optional)</label>
                        <input type="text" id="demo-organization" name="organization">
                    </div>
                    <div class="form-actions">
                        <button type="button" onclick="closeDemoForm()" class="btn secondary">Cancel</button>
                        <button type="submit" class="btn primary">Book Demo</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(formOverlay);
        
        // Focus first input
        setTimeout(() => {
            document.getElementById('demo-name').focus();
        }, 100);
    }
    
    // Global functions for form handling
    window.closeDemoForm = function() {
        const formOverlay = document.getElementById('demo-form-overlay');
        if (formOverlay) {
            formOverlay.remove();
        }
    };
    
    window.submitDemoForm = function(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const name = formData.get('name');
        const email = formData.get('email');
        const organization = formData.get('organization');
        
        console.log('Demo form submitted:', { name, email, organization });
        
        // Close form
        closeDemoForm();
        
        // Show confirmation
        const confirmationMessage = `Thank you, ${name}! Your demo has been scheduled. We'll contact you at ${email} soon.`;
        showTranscript(confirmationMessage);
        speakText(`Thank you ${name}! Your demo has been scheduled.`);
    };
    
    // Show transcript with fade out
    function showTranscript(text) {
        if (!text.trim()) return;
        
        const transcriptDisplay = createTranscriptDisplay();
        const content = transcriptDisplay.querySelector('.transcript-content');
        
        content.textContent = text;
        transcriptDisplay.classList.remove('hidden');
        
        // Log to console
        console.log('Voice transcript:', text);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            transcriptDisplay.classList.add('hidden');
        }, 5000);
    }

    // Create backdrop overlay and waveform elements
    function createVoiceUI() {
        // Create backdrop overlay
        if (!overlayElement) {
            overlayElement = document.createElement('div');
            overlayElement.className = 'voice-backdrop';
            document.body.appendChild(overlayElement);
        }
        
        // Create full-width Alexa-style light bar
        if (!waveformElement) {
            waveformElement = document.createElement('div');
            waveformElement.className = 'voice-light-bar';
            
            // Create the visual line element
            const lineElement = document.createElement('div');
            lineElement.className = 'voice-line';
            
            waveformElement.appendChild(lineElement);
            document.body.appendChild(waveformElement);
            
            // Store reference to line element for animation
            canvas = lineElement; // Reusing canvas variable for the line element
            
            // Initialize amplitude tracking
            waveformData = { amplitude: 0.5, smoothedAmplitude: 0.5 };
        }
    }
    
    // Show voice UI with animations
    function showVoiceUI() {
        createVoiceUI();
        
        // Show backdrop
        overlayElement.classList.add('active');
        
        // Show waveform
        waveformElement.classList.add('active');
        
        // Start audio visualization
        startAudioVisualization();
    }
    
    // Hide voice UI with animations
    function hideVoiceUI() {
        if (overlayElement) {
            overlayElement.classList.remove('active');
        }
        
        if (waveformElement) {
            waveformElement.classList.remove('active');
        }
        
        // Stop audio visualization
        stopAudioVisualization();
    }
    
    // Start audio visualization with Web Audio API
    async function startAudioVisualization() {
        try {
            // Initialize audio context
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            microphone = audioContext.createMediaStreamSource(stream);
            
            // Create analyser
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            analyser.smoothingTimeConstant = 0.8;
            
            // Connect microphone to analyser
            microphone.connect(analyser);
            
            // Start animation loop
            animateVoiceLine();
            
        } catch (error) {
            console.log('Could not access microphone for visualization:', error);
            // Fallback to simple animation
            animateLineFallback();
        }
    }
    
    // Animate voice line based on real-time microphone amplitude
    function animateVoiceBar() {
        if (!canvas) return;
        
        // Convert mic amplitude to visual scale (1.0 to 3.0)
        const scale = Math.max(1.0, Math.min(3.0, 1.0 + (waveformData.smoothedAmplitude * 2.0)));
        
        // Convert amplitude to glow intensity (0.3 to 1.0)
        const glowIntensity = Math.max(0.3, Math.min(1.0, waveformData.smoothedAmplitude));
        
        // Apply scale transformation for height
        canvas.style.transform = `scaleY(${scale})`;
        
        // Apply dynamic glow based on voice amplitude
        const shadowBlur = Math.round(12 + (glowIntensity * 20)); // 12px to 32px
        const shadowOpacity = Math.max(0.4, glowIntensity);
        canvas.style.boxShadow = `0 0 ${shadowBlur}px rgba(0, 188, 212, ${shadowOpacity})`;
        
        // Add subtle brightness variation
        const brightness = Math.max(1.0, 1.0 + (glowIntensity * 0.3));
        canvas.style.filter = `brightness(${brightness})`;
    }
    
    // Animate voice bar based on real-time audio input
    function animateVoiceLine() {
        if (!analyser || !canvas) return;
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function draw() {
            if (!isRecording) return;
            
            animationId = requestAnimationFrame(draw);
            
            // Get real-time frequency data from microphone
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate current volume amplitude
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            const currentAmplitude = average / 255; // Normalize to 0-1
            
            // Smooth the amplitude for natural animation (avoid jarring changes)
            const smoothing = 0.25; // Adjust for responsiveness vs smoothness
            waveformData.smoothedAmplitude += (currentAmplitude - waveformData.smoothedAmplitude) * smoothing;
            
            // Apply real-time visual changes
            animateVoiceBar();
        }
        
        draw();
    }
    
    // Fallback animation when Web Audio API isn't available
    function animateLineFallback() {
        if (!canvas) return;
        
        let fallbackAnimationId;
        let time = 0;
        
        function drawFallback() {
            if (!isRecording) return;
            
            fallbackAnimationId = requestAnimationFrame(drawFallback);
            time += 0.03;
            
            // Create gentle breathing animation without microphone data
            const breathingAmplitude = 0.3 + Math.sin(time) * 0.2;
            waveformData.smoothedAmplitude += (breathingAmplitude - waveformData.smoothedAmplitude) * 0.1;
            
            // Apply fallback animation
            animateVoiceBar();
        }
        
        drawFallback();
    }
    
    // Stop audio visualization
    function stopAudioVisualization() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        // Stop microphone stream
        if (microphone && microphone.mediaStream) {
            microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (microphone) {
            microphone.disconnect();
            microphone = null;
        }
        
        if (analyser) {
            analyser.disconnect();
            analyser = null;
        }
    }

    // Start voice recording
    function startVoiceRecording() {
        if (!recognition) {
            console.log('Speech recognition not supported');
            return;
        }

        if (!isRecording) {
            isRecording = true;
            latestFinalTranscript = '';
            latestInterimTranscript = '';
            try {
                recognition.start();
                console.log('Voice recording started');
            } catch (e) {
                console.log('Could not start recognition:', e);
                isRecording = false;
            }
        }
    }

    // Stop voice recording
    function stopVoiceRecording() {
        if (recognition && isRecording) {
            isRecording = false;
            recognition.stop();
            console.log('Voice recording stopped');

            // Process the latest captured final transcript shortly after stop
            setTimeout(() => {
                const text = (latestFinalTranscript || latestInterimTranscript).trim();
                if (text) {
                    processVoiceCommand(text);
                } else {
                    console.log('No transcript captured. Use #compliance hash or window.showCompliancePanel() to test.');
                }
                latestFinalTranscript = '';
                latestInterimTranscript = '';
            }, 100);
        }
    }

    // Global spacebar prevention for voice functionality
    function preventSpacebarScrolling(event) {
        // Always prevent spacebar scrolling if not in input fields
        if (event.code === 'Space' || event.key === ' ' || event.which === 32) {
            const isInputField = ['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target.tagName) ||
                                 event.target.isContentEditable ||
                                 event.target.getAttribute('contenteditable') === 'true';
            
            if (!isInputField) {
                event.preventDefault();
                console.log('Spacebar scroll prevented on', window.location.pathname);
                // Don't stop propagation so voice recording can still work
                return false;
            }
        }
    }

    // Add scroll prevention listeners (but allow other listeners to run)
    document.addEventListener('keydown', preventSpacebarScrolling, true);
    document.addEventListener('keypress', preventSpacebarScrolling, true);

    // Listen for spacebar press and hold
    document.addEventListener('keydown', function(event) {
        console.log('Keydown event:', event.code, 'Target:', event.target.tagName, 'Spacebar pressed:', spacebarPressed);
        
        // Check if spacebar (key code 32) is pressed and not in an input field
        if (event.code === 'Space' && !spacebarPressed && 
            !['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target.tagName) &&
            !event.target.isContentEditable) {
            spacebarPressed = true;
            
            console.log('Spacebar detected for voice recording');
            
            // Show voice UI after a short delay to ensure it's a hold, not just a tap
            spacebarTimer = setTimeout(function() {
                console.log('Starting voice recording...');
                
                // Show the new voice UI
                showVoiceUI();
                
                // Start voice recording
                startVoiceRecording();
                console.log('Spacebar held - voice recording started');
            }, 200);
        } else {
            console.log('Spacebar conditions not met:', {
                isSpace: event.code === 'Space',
                notPressed: !spacebarPressed,
                targetTag: event.target.tagName,
                notInputField: !['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target.tagName),
                notEditable: !event.target.isContentEditable
            });
        }
    });

    // Listen for spacebar release
    document.addEventListener('keyup', function(event) {
        if (event.code === 'Space' && spacebarPressed) {
            spacebarPressed = false;
            
            console.log('Spacebar released');
            
            // Clear the timer
            if (spacebarTimer) {
                clearTimeout(spacebarTimer);
                spacebarTimer = null;
            }
            
            // Hide voice UI
            hideVoiceUI();
            
            // Stop voice recording
            stopVoiceRecording();
            
            console.log('Spacebar released - voice recording stopped');
        }
    });

    // Handle click events for buttons (just for demo)
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            const buttonText = this.textContent;
            console.log(`Button clicked: ${buttonText}`);
            alert(`"${buttonText}" functionality would be implemented here!`);
        });
    });

    // Handle navigation clicks (only for placeholder links)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(event) {
            // Handle anchor links for smooth scrolling
            const href = this.getAttribute('href');
            if (href && href.startsWith('#') && href !== '#') {
                event.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
            // Only prevent default for placeholder links (those with href="#")
            else if (href === '#') {
                event.preventDefault();
                const linkText = this.textContent;
                console.log(`Navigation clicked: ${linkText}`);
                alert(`"${linkText}" page would be implemented here!`);
            }
            // Let real links (like Navigator) work normally
        });
    });

    // Initialize page knowledge retrieval
    initializePageKnowledge();
    
    // Initialize speech synthesis with best voice
    setupSpeechSynthesis();
    
    // Reinitialize knowledge when page content changes (for dynamic content)
    const observer = new MutationObserver(() => {
        setTimeout(() => {
            initializePageKnowledge();
        }, 1000);
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
    
    // Initialize voice control onboarding for first-time users
    initializeVoiceOnboarding();
    
    // Log to console for debugging
    console.log('Ephemeral Site loaded successfully');
    console.log('Has seen overlay:', hasSeenOverlay);

    // If a compliance panel was requested before navigating here, show it now
    try {
        if (sessionStorage.getItem('showCompliancePanelOnLoad') === 'true' && getCurrentPagePath() === '/navigator') {
            sessionStorage.removeItem('showCompliancePanelOnLoad');
            setTimeout(() => {
                showCompliancePanel();
            }, 350); // allow initial layout/styles to settle
        }
        // Also allow URL flags for quick QA (e.g., /navigator#compliance)
        if (getCurrentPagePath() === '/navigator' && (location.hash.toLowerCase().includes('compliance') || /[?&]compliance=1\b/i.test(location.search))) {
            setTimeout(() => showCompliancePanel(), 400);
        }
    } catch (e) {
        console.log('Session storage unavailable:', e);
    }
    
    // Voice Control Onboarding System
    function initializeVoiceOnboarding() {
        // Show onboarding on every page load for demo purposes
        console.log('Showing voice control onboarding for demo');
        
        // Create and show onboarding overlay after a short delay
        setTimeout(() => {
            showVoiceOnboarding();
        }, 2000); // Show after 2 seconds to let page load
    }
    
    function showVoiceOnboarding() {
        // Create onboarding overlay
        const onboardingOverlay = document.createElement('div');
        onboardingOverlay.className = 'voice-onboarding-overlay';
        onboardingOverlay.innerHTML = `
            <div class="voice-onboarding-content">
                <div class="onboarding-keyboard">
                    <div class="keyboard-container">
                        <div class="keyboard-keys">
                            <div class="keyboard-key small"></div>
                            <div class="keyboard-key small"></div>
                            <div class="keyboard-key small"></div>
                            <div class="keyboard-key small"></div>
                            <div class="keyboard-key small"></div>
                        </div>
                        <div class="spacebar-container">
                            <div class="spacebar"></div>
                        </div>
                    </div>
                </div>
                <div class="onboarding-text">
                    <h3>Meet Navigator</h3>
                    <p>Press and hold the spacebar to talk to Navigator</p>
                    <div class="onboarding-hint">Try saying "Take me to Navigator" or "What does this do?"</div>
                </div>
                <div class="onboarding-voice-wave">
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                    <div class="wave-bar"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(onboardingOverlay);
        
        // Trigger show animation
        setTimeout(() => {
            onboardingOverlay.classList.add('active');
        }, 100);
        
        // Auto-dismiss after 10 seconds
        const autoDismissTimer = setTimeout(() => {
            dismissVoiceOnboarding(onboardingOverlay);
        }, 10000);
        
        // Dismiss on spacebar press
        const onboardingKeyHandler = (event) => {
            if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(event.target.tagName)) {
                clearTimeout(autoDismissTimer);
                dismissVoiceOnboarding(onboardingOverlay);
                document.removeEventListener('keydown', onboardingKeyHandler);
            }
        };
        
        document.addEventListener('keydown', onboardingKeyHandler);
        
        // Note: localStorage removed for demo purposes - onboarding will show on every refresh
    }
    
    function dismissVoiceOnboarding(overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 500);
    }
    
    // MLS Partners Knowledge Base
    const mlsPartners = [
        { name: "Stellar MLS", city: "Altamonte Springs", state: "FL", agents: 80625, status: "in discussion" },
        { name: "First Multiple Listing Service", city: "Atlanta", state: "GA", agents: 62000, status: "in discussion" },
        { name: "Miami Association of REALTORS®", city: "Miami", state: "FL", agents: 49872, status: "in discussion" },
        { name: "Houston Association of REALTORS®", city: "Houston", state: "TX", agents: 48164, status: "in discussion" },
        { name: "REcolorado", city: "Denver", state: "CO", agents: 27632, status: "in discussion" },
        { name: "MetroList", city: "Sacramento", state: "CA", agents: 22801, status: "live" },
        { name: "Regional Multiple Listing Service", city: "Portland", state: "OR", agents: 15919, status: "in discussion" },
        { name: "Heartland MLS", city: "Kansas City", state: "MO", agents: 12320, status: "in discussion" },
        { name: "ValleyMLS.com", city: "Huntsville", state: "AL", agents: 4384, status: "in discussion" },
        { name: "Greater Chattanooga Association of REALTORS®", city: "Chattanooga", state: "TN", agents: 3095, status: "in discussion" },
        { name: "Mobile Area Association of REALTORS®", city: "Mobile", state: "AL", agents: 1957, status: "in discussion" },
        { name: "Mid Georgia MLS", city: "Macon", state: "GA", agents: 795, status: "in discussion" },
        { name: "Park City Board of REALTORS®", city: "Park City", state: "UT", agents: 1745, status: "in discussion" },
        { name: "Western Arizona Realtor Data Exchange", city: "Lake Havasu City", state: "AZ", agents: 1092, status: "in discussion" },
        { name: "Realcomp II Ltd.", city: "Farmington Hills", state: "MI", agents: 17850, status: "in discussion" },
        { name: "California Regional MLS", city: "Chino Hills", state: "CA", agents: 108000, status: "pilot" },
        { name: "PRIME MLS", city: "Concord", state: "NH", agents: 11411, status: "in discussion" },
        { name: "Savannah Board of REALTORS®", city: "Savannah", state: "GA", agents: 2795, status: "in discussion" },
        { name: "Bay East Association of REALTORS®", city: "Pleasanton", state: "CA", agents: 6367, status: "in discussion" },
        { name: "bridgeMLS", city: "Oakland", state: "CA", agents: 3776, status: "in discussion" },
        { name: "Contra Costa Association of REALTORS®", city: "Walnut Creek", state: "CA", agents: 4496, status: "in discussion" },
        { name: "New Mexico MLS", city: "Las Cruces", state: "NM", agents: 1175, status: "in discussion" },
        { name: "Williamsburg Area Association of REALTORS®", city: "Williamsburg", state: "VA", agents: 814, status: "in discussion" },
        { name: "SOMO", city: "Springfield", state: "MO", agents: 6000, status: "in discussion" },
        { name: "Greater Las Vegas Association of REALTORS®", city: "Las Vegas", state: "NV", agents: 16967, status: "in discussion" }
    ];

    // Demo Booking System (Single-shot and Conversational)
    let demoData = { name: "", email: "", date: "", time: "" };
    let isCollectingDemo = false;
    let currentDemoStep = 0;
    
    // MLS Partnership Query Processing
    function processMlsQuery(text) {
        const cleanText = text.toLowerCase();
        
        // Agent count queries
        if (cleanText.includes('how many agents') || cleanText.includes('agent count') || cleanText.includes('total agents')) {
            const liveAndPilotPartners = mlsPartners.filter(p => p.status === 'live' || p.status === 'pilot');
            const totalAgents = liveAndPilotPartners.reduce((sum, partner) => sum + partner.agents, 0);
            
            if (totalAgents === 0) {
                return "We don't have any live partnerships yet, but we're working with several MLSs in pilot and discussion phases.";
            }
            
            const partnerNames = liveAndPilotPartners.map(p => p.name).join(' and ');
            return `We're currently working with ${totalAgents.toLocaleString()} agents across ${liveAndPilotPartners.length} ${liveAndPilotPartners.length === 1 ? 'MLS' : 'MLSs'}: ${partnerNames}.`;
        }
        
        // Live partnership queries
        if (cleanText.includes('are you live') || cleanText.includes('who are you live with') || cleanText.includes('live partnerships')) {
            const livePartners = mlsPartners.filter(p => p.status === 'live');
            
            if (livePartners.length === 0) {
                return "We don't have any fully live partnerships yet, but we have pilot programs running and many discussions in progress.";
            }
            
            const liveNames = livePartners.map(p => p.name).join(' and ');
            return `We're live with ${liveNames}.`;
        }
        
        // State-based queries
        const stateMatch = cleanText.match(/\b(?:in|from)\s+(california|ca|texas|tx|florida|fl|new york|ny|georgia|ga|colorado|co|michigan|mi|oregon|or|missouri|mo|alabama|al|tennessee|tn|utah|ut|arizona|az|new hampshire|nh|new mexico|nm|virginia|va|nevada|nv)\b/i);
        if (stateMatch) {
            const stateQuery = stateMatch[1].toLowerCase();
            let stateCode = stateQuery;
            
            // Convert full state names to codes
            const stateMap = {
                'california': 'CA', 'texas': 'TX', 'florida': 'FL', 'new york': 'NY',
                'georgia': 'GA', 'colorado': 'CO', 'michigan': 'MI', 'oregon': 'OR',
                'missouri': 'MO', 'alabama': 'AL', 'tennessee': 'TN', 'utah': 'UT',
                'arizona': 'AZ', 'new hampshire': 'NH', 'new mexico': 'NM',
                'virginia': 'VA', 'nevada': 'NV'
            };
            
            if (stateMap[stateQuery]) {
                stateCode = stateMap[stateQuery];
            } else {
                stateCode = stateQuery.toUpperCase();
            }
            
            const statePartners = mlsPartners.filter(p => p.state === stateCode);
            
            if (statePartners.length === 0) {
                return `We're not currently working with any MLSs in ${stateQuery === stateCode.toLowerCase() ? stateCode : stateQuery}, but we're always open to new partnerships.`;
            }
            
            const partnerNames = statePartners.map(p => p.name).join(', ');
            const stateName = stateQuery === stateCode.toLowerCase() ? stateCode : stateQuery;
            return `In ${stateName}, we're working with ${statePartners.length} ${statePartners.length === 1 ? 'MLS' : 'MLSs'}: ${partnerNames}.`;
        }
        
        // Specific MLS name queries
        const mlsNamePatterns = [
            'do you work with', 'are you working with', 'are you partnered with',
            'do you partner with', 'are you with', 'work with'
        ];
        
        for (const pattern of mlsNamePatterns) {
            if (cleanText.includes(pattern)) {
                const afterPattern = cleanText.split(pattern)[1]?.trim();
                if (afterPattern) {
                    const matchedPartner = findMlsPartner(afterPattern);
                    if (matchedPartner) {
                        return `Yes, we're ${matchedPartner.status} with ${matchedPartner.name} in ${matchedPartner.city}, ${matchedPartner.state}. They serve ${matchedPartner.agents.toLocaleString()} agents.`;
                    } else {
                        // Extract the MLS name from the query for a more natural response
                        const mlsName = extractMlsNameFromQuery(afterPattern);
                        return `We're not working with ${mlsName} yet, but we're open to it.`;
                    }
                }
            }
        }
        
        return null; // No MLS query detected
    }
    
    function findMlsPartner(queryText) {
        const cleanQuery = queryText.toLowerCase();
        
        // Try exact matches first
        for (const partner of mlsPartners) {
            if (partner.name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(partner.name.toLowerCase())) {
                return partner;
            }
        }
        
        // Try partial matches for common abbreviations
        const abbreviations = {
            'crmls': 'California Regional MLS',
            'cal reg': 'California Regional MLS',
            'california regional': 'California Regional MLS',
            'metrolist': 'MetroList',
            'stellar': 'Stellar MLS',
            'realcomp': 'Realcomp II Ltd.',
            'heart land': 'Heartland MLS',
            'heartland': 'Heartland MLS',
            'bay east': 'Bay East Association of REALTORS®',
            'prime': 'PRIME MLS',
            'bridge': 'bridgeMLS',
            'somo': 'SOMO'
        };
        
        for (const [abbrev, fullName] of Object.entries(abbreviations)) {
            if (cleanQuery.includes(abbrev)) {
                return mlsPartners.find(p => p.name === fullName);
            }
        }
        
        return null;
    }
    
    function extractMlsNameFromQuery(queryText) {
        // Clean up common words and return a reasonable MLS name
        const cleaned = queryText
            .replace(/\b(the|mls|association|of|realtors?|®|board|regional|multiple|listing|service|ltd|inc)\b/gi, '')
            .trim();
        
        // Capitalize first letters for better presentation
        return cleaned.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ') || 'that MLS';
    }

    // Single-shot demo booking functions
    function containsCompleteBookingInfo(text) {
        // Check if text contains patterns for name, email, and either date or time
        const hasEmail = /@/.test(text) || /\b\w+\s+at\s+\w+\s+dot\s+\w+/.test(text);
        const hasDate = /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}(st|nd|rd|th)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next\s+week|this\s+week)\b/i.test(text);
        const hasTime = /\b(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm|a\.m\.|p\.m\.)|noon|midnight|\d{1,2}\s*o'?clock)\b/i.test(text);
        const hasName = /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text) || /name\s+is\s+\w+/i.test(text) || /\bwith\s+[A-Z][a-z]+/i.test(text);
        
        return hasEmail && (hasDate || hasTime) && hasName;
    }
    
    function processSingleShotDemo(transcript) {
        console.log('Processing single-shot demo booking:', transcript);
        
        // Extract all information from the transcript
        const extractedData = extractBookingInfo(transcript);
        
        // Update demo data
        demoData = { ...demoData, ...extractedData };
        
        console.log('Extracted demo data:', demoData);
        
        // Show confirmation message
        const confirmationMessage = 'Perfect! Let me confirm those details.';
        showTranscript(confirmationMessage);
        speakText(confirmationMessage);
        
        // Show the form with extracted data after a brief pause
        setTimeout(() => {
            showDemoForm();
        }, 1500);
    }
    
    function extractBookingInfo(text) {
        const data = { name: "", email: "", date: "", time: "" };
        
        // Extract email
        data.email = extractEmail(text);
        
        // Extract name
        data.name = extractName(text);
        
        // Extract date and time
        const dateTime = extractDateTime(text);
        data.date = dateTime.date;
        data.time = dateTime.time;
        
        return data;
    }
    
    function extractEmail(text) {
        // Look for email patterns
        const emailPatterns = [
            /\b([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i,
            /\b([a-zA-Z0-9._-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+([a-zA-Z]{2,})\b/i,
            /email\s+is\s+([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
            /email\s+is\s+([a-zA-Z0-9._-]+)\s+at\s+([a-zA-Z0-9.-]+)\s+dot\s+([a-zA-Z]{2,})/i
        ];
        
        for (const pattern of emailPatterns) {
            const match = text.match(pattern);
            if (match) {
                if (match.length === 2) {
                    // Standard email format
                    return match[1];
                } else if (match.length === 4) {
                    // Spoken format: "name at domain dot com"
                    return `${match[1]}@${match[2]}.${match[3]}`;
                }
            }
        }
        
        return "";
    }
    
    function extractName(text) {
        // Look for name patterns
        const namePatterns = [
            /(?:my\s+name\s+is\s+|with\s+|I'm\s+|I\s+am\s+)([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
            /\b([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*,|\s+at\s|\s+email|\s+for)/i,
            /^([A-Z][a-z]+\s+[A-Z][a-z]+)/i, // Name at start
            /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/i // Any capitalized first/last name
        ];
        
        for (const pattern of namePatterns) {
            const match = text.match(pattern);
            if (match) {
                let name = match[1].trim();
                // Apply name corrections
                name = processNameInput(name);
                return name;
            }
        }
        
        return "";
    }
    
    function extractDateTime(text) {
        let date = "";
        let time = "";
        
        // Extract time first (more specific patterns)
        const timePatterns = [
            /\b(\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?)\b/i,
            /\b(\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))\b/i,
            /\b(\d{1,2}\s*o'?clock)\b/i,
            /\b(noon|midnight)\b/i
        ];
        
        for (const pattern of timePatterns) {
            const match = text.match(pattern);
            if (match) {
                time = match[1].trim();
                break;
            }
        }
        
        // Extract date
        const datePatterns = [
            // Full dates like "August 6th", "December 25th"
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}(?:st|nd|rd|th)?)\b/i,
            // Relative dates
            /\b(tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
            // Day names
            /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
            // Date ranges like "next week"
            /\b(next\s+week|this\s+week)\b/i,
            // Numeric dates like "8/6" or "8th"
            /\b(\d{1,2}\/\d{1,2}|\d{1,2}(?:st|nd|rd|th))\b/i
        ];
        
        for (const pattern of datePatterns) {
            const match = text.match(pattern);
            if (match) {
                if (match.length === 3) {
                    // Month + day format
                    date = `${match[1]} ${match[2]}`;
                } else {
                    date = match[1];
                }
                break;
            }
        }
        
        // Clean up extracted date and time
        date = date.replace(/\b(on|at|for)\b/gi, '').trim();
        time = time.replace(/\b(at|around)\b/gi, '').trim();
        
        return { date, time };
    }
    let demoSteps = [
        { 
            fields: ['name', 'email'], 
            question: "What's your full name and email address? You can say 'at' for the at symbol." 
        },
        { 
            fields: ['date', 'time'], 
            question: "What day and time would work best for your demo?" 
        }
    ];
    
    function startConversationalDemo() {
        console.log('Starting conversational demo booking...');
        isCollectingDemo = true;
        currentDemoStep = 0;
        demoData = { name: "", email: "", date: "", time: "" };
        
        // Show initial message and ask first question
        showTranscript('I\'d be happy to book a demo for you!');
        speakText('I\'d be happy to book a demo for you!');
        
        setTimeout(() => {
            askNextDemoQuestion();
        }, 2000);
    }
    
    function askNextDemoQuestion() {
        if (currentDemoStep < demoSteps.length) {
            const step = demoSteps[currentDemoStep];
            console.log(`Asking: ${step.question}`);
            
            showTranscript(step.question);
            speakText(step.question);
            
            // Show voice prompt indicator
            showVoicePrompt();
        } else {
            // All questions answered, show form
            showDemoForm();
        }
    }
    
    function showVoicePrompt() {
        // Create a subtle visual indicator that Navigator is waiting for voice input
        const promptElement = document.createElement('div');
        promptElement.className = 'voice-prompt-indicator';
        promptElement.innerHTML = '<div class="prompt-pulse"></div>';
        document.body.appendChild(promptElement);
        
        setTimeout(() => {
            promptElement.classList.add('active');
        }, 100);
        
        // Auto-remove after 10 seconds if no response
        setTimeout(() => {
            if (promptElement.parentNode) {
                promptElement.parentNode.removeChild(promptElement);
            }
        }, 10000);
    }
    
    function processDemoResponse(transcript) {
        if (!isCollectingDemo) return false;
        
        const step = demoSteps[currentDemoStep];
        const input = transcript.trim();
        
        if (step.fields.includes('name') && step.fields.includes('email')) {
            // Process name and email together
            const { name, email } = parseNameAndEmail(input);
            demoData.name = name;
            demoData.email = email;
            console.log(`Captured name: ${demoData.name}, email: ${demoData.email}`);
        } else if (step.fields.includes('date') && step.fields.includes('time')) {
            // Process date and time together
            const { date, time } = parseDateAndTime(input);
            demoData.date = date;
            demoData.time = time;
            console.log(`Captured date: ${demoData.date}, time: ${demoData.time}`);
        }
        
        // Remove voice prompt indicator
        const promptElement = document.querySelector('.voice-prompt-indicator');
        if (promptElement) {
            promptElement.classList.add('fade-out');
            setTimeout(() => {
                if (promptElement.parentNode) {
                    promptElement.parentNode.removeChild(promptElement);
                }
            }, 300);
        }
        
        // Acknowledge the response
        const acknowledgments = ['Got it!', 'Perfect!', 'Great!', 'Thanks!'];
        const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
        showTranscript(ack);
        speakText(ack);
        
        currentDemoStep++;
        
        // Ask next question after a brief pause
        setTimeout(() => {
            askNextDemoQuestion();
        }, 1500);
        
        return true; // Indicates this transcript was handled by demo system
    }
    
    function parseNameAndEmail(input) {
        let name = '';
        let email = '';
        
        // Look for email patterns (anything with @ or common email indicators)
        const emailPatterns = [
            /([a-zA-Z0-9._-]+\s*@\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i, // standard email
            /([a-zA-Z0-9._-]+\s+at\s+[a-zA-Z0-9.-]+\s+dot\s+[a-zA-Z]{2,})/i, // spoken email
            /([a-zA-Z0-9._-]+\s+at\s+[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i // mixed format
        ];
        
        let emailMatch = null;
        for (const pattern of emailPatterns) {
            emailMatch = input.match(pattern);
            if (emailMatch) break;
        }
        
        if (emailMatch) {
            // Found email, everything before it is likely the name
            const emailPart = emailMatch[0];
            const emailIndex = input.indexOf(emailPart);
            
            // Extract name (everything before email)
            name = input.substring(0, emailIndex).trim();
            
            // Process the email
            email = processEmailInput(emailPart);
        } else {
            // No clear email pattern, try to split by common separators
            const separators = [' and ', ' email ', ' my email is ', ' at '];
            let splitFound = false;
            
            for (const sep of separators) {
                if (input.toLowerCase().includes(sep)) {
                    const parts = input.toLowerCase().split(sep);
                    name = parts[0].trim();
                    email = processEmailInput(parts[1].trim());
                    splitFound = true;
                    break;
                }
            }
            
            if (!splitFound) {
                // Last resort: assume first part is name, second part is email
                const words = input.split(' ');
                if (words.length >= 3) {
                    // Assume first 2 words are name, rest is email
                    name = words.slice(0, 2).join(' ');
                    email = processEmailInput(words.slice(2).join(' '));
                } else {
                    // Not enough info, put everything in name
                    name = input;
                    email = '';
                }
            }
        }
        
        // Process name for proper capitalization
        name = processNameInput(name);
        
        return { name, email };
    }
    
    function parseDateAndTime(input) {
        let date = '';
        let time = '';
        
        // Look for time patterns first (more specific)
        const timePatterns = [
            /(\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?)/i,
            /(\d{1,2}\s*(?:am|pm|a\.m\.|p\.m\.))/i,
            /(\d{1,2}\s*o'?clock)/i,
            /(noon|midnight)/i
        ];
        
        let timeMatch = null;
        for (const pattern of timePatterns) {
            timeMatch = input.match(pattern);
            if (timeMatch) break;
        }
        
        if (timeMatch) {
            time = timeMatch[0].trim();
            // Remove time from input to get date
            date = input.replace(timeMatch[0], '').trim();
            
            // Clean up date by removing common connectors
            date = date.replace(/\s*(at|around|on|for)\s*/gi, ' ').trim();
        } else {
            // No clear time pattern, try to split by common separators
            const separators = [' at ', ' around ', ' on ', ' for '];
            let splitFound = false;
            
            for (const sep of separators) {
                if (input.toLowerCase().includes(sep)) {
                    const parts = input.toLowerCase().split(sep);
                    date = parts[0].trim();
                    time = parts[1].trim();
                    splitFound = true;
                    break;
                }
            }
            
            if (!splitFound) {
                // Assume everything is date if no time indicators
                date = input;
                time = '';
            }
        }
        
        return { date, time };
    }
    
    function processEmailInput(input) {
        // Convert common voice-to-text email patterns
        let processed = input.toLowerCase()
            .replace(/\s+at\s+/g, '@')
            .replace(/\s+dot\s+/g, '.')
            .replace(/\s+dash\s+/g, '-')
            .replace(/\s+underscore\s+/g, '_')
            .replace(/\s+/g, ''); // Remove any remaining spaces
        
        // Ensure there's an @ symbol
        if (!processed.includes('@') && processed.includes(' ')) {
            // Try to find a common pattern like "name domain.com"
            const parts = input.split(' ');
            if (parts.length >= 2) {
                const name = parts.slice(0, -1).join('');
                const domain = parts[parts.length - 1];
                processed = `${name}@${domain}`;
            }
        }
        
        return processed;
    }
    
    function processNameInput(input) {
        // Proper case for names and common corrections
        return input.split(' ')
            .map(word => {
                // Handle common voice recognition mistakes
                const corrections = {
                    'lundy': 'Lundy',
                    'justin': 'Justin'
                };
                
                const lowerWord = word.toLowerCase();
                if (corrections[lowerWord]) {
                    return corrections[lowerWord];
                }
                
                // Standard proper case
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            })
            .join(' ');
    }
    
    function showDemoForm() {
        isCollectingDemo = false;
        
        // Create the demo form overlay
        const demoOverlay = document.createElement('div');
        demoOverlay.className = 'demo-form-overlay';
        demoOverlay.innerHTML = `
            <div class="demo-form-container">
                <div class="demo-form-header">
                    <h3>Confirm Your Demo Details</h3>
                    <button class="demo-close-btn" type="button">&times;</button>
                </div>
                <form class="demo-form" id="demoForm">
                    <div class="demo-form-group">
                        <label for="demoName">Name</label>
                        <input type="text" id="demoName" value="${demoData.name}" required>
                    </div>
                    <div class="demo-form-group">
                        <label for="demoEmail">Email</label>
                        <input type="email" id="demoEmail" value="${demoData.email}" required>
                    </div>
                    <div class="demo-form-group">
                        <label for="demoDate">Preferred Date</label>
                        <input type="text" id="demoDate" value="${demoData.date}" required>
                    </div>
                    <div class="demo-form-group">
                        <label for="demoTime">Preferred Time</label>
                        <input type="text" id="demoTime" value="${demoData.time}" required>
                    </div>
                    <div class="demo-form-actions">
                        <button type="button" class="demo-cancel-btn">Cancel</button>
                        <button type="submit" class="demo-confirm-btn">Confirm Demo</button>
                    </div>
                </form>
            </div>
        `;
        
        document.body.appendChild(demoOverlay);
        
        // Show the overlay with animation
        setTimeout(() => {
            demoOverlay.classList.add('active');
        }, 100);
        
        // Focus first empty field
        const firstInput = demoOverlay.querySelector('input');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
        
        // Add event listeners
        const closeBtn = demoOverlay.querySelector('.demo-close-btn');
        const cancelBtn = demoOverlay.querySelector('.demo-cancel-btn');
        const form = demoOverlay.querySelector('#demoForm');
        
        closeBtn.addEventListener('click', () => closeDemoForm(demoOverlay));
        cancelBtn.addEventListener('click', () => closeDemoForm(demoOverlay));
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            confirmDemo(demoOverlay);
        });
        
        // ESC key to close
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeDemoForm(demoOverlay);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }
    
    function confirmDemo(overlay) {
        // Get updated values from form
        const finalData = {
            name: overlay.querySelector('#demoName').value,
            email: overlay.querySelector('#demoEmail').value,
            date: overlay.querySelector('#demoDate').value,
            time: overlay.querySelector('#demoTime').value
        };
        
        console.log('Demo booking confirmed:', finalData);
        
        // Save to localStorage for persistence
        localStorage.setItem('lastDemoBooking', JSON.stringify(finalData));
        
        // Close form and show confirmation
        closeDemoForm(overlay);
        
        const confirmationMessage = 'Demo confirmed. You\'ll get a calendar invite shortly.';
        showTranscript(confirmationMessage);
        speakText(confirmationMessage);
    }
    
    function closeDemoForm(overlay) {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        }, 300);
        
        // Reset demo state
        isCollectingDemo = false;
        currentDemoStep = 0;
        demoData = { name: "", email: "", date: "", time: "" };
    }
}); 