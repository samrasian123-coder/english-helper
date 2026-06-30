// API Settings
const DEFAULT_API_KEY = "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";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL_NAME = "llama-3.3-70b-versatile";

// System Prompts for Teacher personas
const SYSTEM_PROMPTS = {
  sophia: `You are Miss Sophia, an elegant, encouraging, and experienced English Literature and Language Teacher. 
Your tone is intellectual, warm, and highly pedagogical. 
Guidelines:
1. Explain English grammar rules, vocabulary, literature, or pronunciation concepts requested by the student.
2. If the student makes grammatical mistakes or spelling errors in their query, gently point them out, explain why they are incorrect, and correct them.
3. Keep your answers structured, utilizing paragraphs or bullet points for readability. Keep explanations concise but thorough.
4. At the end of your response, ALWAYS provide a brief Urdu translation or explanation of your main points. Wrap this Urdu translation inside [URDU] and [/URDU] tags.
5. If you use advanced vocabulary, idioms, or grammatical structures, extract up to 3 of them and place them at the very end in the following format:
   [VOCAB]English Word | Urdu Word - Meaning/Context[/VOCAB]
   (Example: [VOCAB]Eloquence | فصاحت - The ability to speak or write eloquently[/VOCAB])
6. Never break character. You are a real female teacher speaking directly to your student.`,

  ayesha: `You are Miss Ayesha, a friendly, native bilingual Language Teacher fluent in both English and Urdu.
Your tone is engaging, highly supportive, and conversational.
Guidelines:
1. You teach both English and Urdu languages, literature, poetry (Shayari), and translation.
2. If the user writes in English, reply in English but explain the concept in Urdu as well.
3. If the user writes in Urdu, reply in English and translate/explain it into Urdu to help them learn.
4. Wrap all Urdu explanations or translations in [URDU] and [/URDU] tags.
5. Wrap all English explanations or translations in [ENGLISH] and [/ENGLISH] tags.
6. If you explain advanced concepts, translations, or vocabulary, extract up to 3 terms and place them at the very end in the format:
   [VOCAB]English Word | Urdu Word - Meaning/Context[/VOCAB]
7. Never break character. You are a real female teacher speaking directly to your student.`
};

// Application State
let state = {
  apiKey: localStorage.getItem('groq_api_key') || DEFAULT_API_KEY,
  activeTeacher: 'sophia',
  sttLanguage: 'en-US', // Default speech recognition language
  autoSpeak: true,
  chatHistory: [],
  vocabList: JSON.parse(localStorage.getItem('vocab_list')) || [],
  isRecording: false,
  isSpeaking: false,
  voices: [],
  ttsEngine: localStorage.getItem('tts_engine') || 'native',
  elevenLabsKey: localStorage.getItem('elevenlabs_api_key') || '',
  elevenLabsVoiceId: localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM'
};

// DOM Elements
const elements = {
  sidebar: document.querySelector('.sidebar'),
  mobileSidebarToggle: document.getElementById('mobile-sidebar-toggle'),
  teacherCards: document.querySelectorAll('.teacher-card'),
  ttsEngineSelect: document.getElementById('tts-engine-select'),
  nativeVoiceGroup: document.getElementById('native-voice-group'),
  nativePitchGroup: document.getElementById('native-pitch-group'),
  voiceSelect: document.getElementById('voice-select'),
  voiceRate: document.getElementById('voice-rate'),
  rateVal: document.getElementById('rate-val'),
  voicePitch: document.getElementById('voice-pitch'),
  pitchVal: document.getElementById('pitch-val'),
  autoSpeakToggle: document.getElementById('auto-speak-toggle'),
  vocabList: document.getElementById('vocab-list'),
  clearVocabBtn: document.getElementById('clear-vocab-btn'),
  apiStatusDot: document.getElementById('api-status-dot'),
  apiStatusText: document.getElementById('api-status-text'),
  apiKeyConfig: document.getElementById('api-key-config'),
  sttEnBtn: document.getElementById('stt-en-btn'),
  sttUrBtn: document.getElementById('stt-ur-btn'),
  clearChatBtn: document.getElementById('clear-chat-btn'),
  avatarContainer: document.querySelector('.avatar-container'),
  avatarStatusText: document.getElementById('avatar-status-text'),
  chatStream: document.getElementById('chat-stream'),
  suggestionContainer: document.getElementById('suggestion-container'),
  chatForm: document.getElementById('chat-form'),
  userInput: document.getElementById('user-input'),
  micBtn: document.getElementById('mic-btn'),
  sendBtn: document.getElementById('send-btn'),
  apiModal: document.getElementById('api-modal'),
  apiKeyInput: document.getElementById('api-key-input'),
  elevenLabsKeyInput: document.getElementById('elevenlabs-key-input'),
  elevenLabsVoiceInput: document.getElementById('elevenlabs-voice-input'),
  closeModalX: document.getElementById('close-modal-x'),
  cancelApiBtn: document.getElementById('cancel-api-btn'),
  saveApiBtn: document.getElementById('save-api-btn')
};

// Initialize Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = state.sttLanguage;
} else {
  console.warn("Speech Recognition API not supported in this browser.");
  elements.micBtn.style.display = 'none'; // Hide if not supported
}

// Initialize Speech Synthesis
const synth = window.speechSynthesis;
let speakQueue = [];

// App Startup
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // 1. Load API Key state
  updateApiStatus();
  
  // 2. Load Speech Synthesis Voices
  loadVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = loadVoices;
  }
  
  // 3. Initialize Voice Engine Select
  if (elements.ttsEngineSelect) {
    elements.ttsEngineSelect.value = state.ttsEngine;
    toggleTtsEngineUI(state.ttsEngine);
  }
  
  // 4. Bind UI Events
  bindEvents();
  
  // 5. Render initial vocabulary
  renderVocab();
  
  // 6. Restore chat history if exists
  const savedChat = localStorage.getItem(`chat_history_${state.activeTeacher}`);
  if (savedChat) {
    state.chatHistory = JSON.parse(savedChat);
    renderChatHistory();
  } else {
    // Reset to initial state
    resetChatHistory();
  }
}

// Toggle native voice settings visibility based on engine select
function toggleTtsEngineUI(engine) {
  if (engine === 'native') {
    elements.nativeVoiceGroup.style.display = 'block';
    elements.nativePitchGroup.style.display = 'block';
  } else {
    // For cloud engines, hide voice/pitch group but keep them accessible
    elements.nativeVoiceGroup.style.display = 'none';
    elements.nativePitchGroup.style.display = 'none';
  }
}

// Load and Filter Voices
function loadVoices() {
  state.voices = synth.getVoices();
  elements.voiceSelect.innerHTML = '';
  
  if (state.voices.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No system voices found';
    elements.voiceSelect.appendChild(opt);
    return;
  }
  
  // Sort and filter for female-like voices or default languages
  // Browsers have different voices, we prioritize English female and Urdu if available
  let filteredVoices = state.voices.filter(voice => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    
    // Check if voice is English or Urdu/Hindi (similar phonetics)
    const isTargetLang = lang.startsWith('en') || lang.startsWith('ur') || lang.startsWith('hi');
    return isTargetLang;
  });
  
  // If we filtered out too many, just display all
  if (filteredVoices.length === 0) {
    filteredVoices = state.voices;
  }

  // Sort: Natural/Online/Neural first, then Google, then typical recommended female voices
  filteredVoices.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    
    // 1. Natural / Online / Neural voices are highest priority
    const aIsNatural = aName.includes('natural') || aName.includes('online') || aName.includes('neural');
    const bIsNatural = bName.includes('natural') || bName.includes('online') || bName.includes('neural');
    if (aIsNatural && !bIsNatural) return -1;
    if (!aIsNatural && bIsNatural) return 1;
    
    // 2. Google voices are next priority
    const aIsGoogle = aName.includes('google');
    const bIsGoogle = bName.includes('google');
    if (aIsGoogle && !bIsGoogle) return -1;
    if (!aIsGoogle && bIsGoogle) return 1;
    
    // 3. Recommended female voices
    const isRecA = aName.includes('female') || aName.includes('zira') || aName.includes('hazel') || aName.includes('susan') || aName.includes('heera') || aName.includes('asha') || aName.includes('ayesha');
    const isRecB = bName.includes('female') || bName.includes('zira') || bName.includes('hazel') || bName.includes('susan') || bName.includes('heera') || bName.includes('asha') || bName.includes('ayesha');
    if (isRecA && !isRecB) return -1;
    if (!isRecA && isRecB) return 1;
    
    return 0;
  });

  filteredVoices.forEach(voice => {
    const option = document.createElement('option');
    option.value = voice.name;
    
    // Highlight recommended natural and Google voices
    let suffix = '';
    const nameLower = voice.name.toLowerCase();
    if (nameLower.includes('natural') || nameLower.includes('online') || nameLower.includes('neural')) {
      suffix = ' 🌟 (Natural AI Voice)';
    } else if (nameLower.includes('google')) {
      suffix = ' 🌐 (Google Voice)';
    } else if (nameLower.includes('female') || nameLower.includes('zira') || nameLower.includes('hazel') || nameLower.includes('susan') || nameLower.includes('heera') || nameLower.includes('asha') || nameLower.includes('ayesha')) {
      suffix = ' 👩 (Recommended)';
    }
    
    option.textContent = `${voice.name} (${voice.lang})${suffix}`;
    elements.voiceSelect.appendChild(option);
  });

  // Select default voice depending on active teacher
  autoSelectTeacherVoice();
}

// Auto select the best native voice for the active teacher
function autoSelectTeacherVoice() {
  const systemVoices = synth.getVoices();
  if (!systemVoices || systemVoices.length === 0) return;
  
  // Reuse the centralized voice picker
  const targetVoice = getBestEnglishVoiceForTeacher(systemVoices);
  
  if (targetVoice && elements.voiceSelect) {
    elements.voiceSelect.value = targetVoice.name;
  } else if (systemVoices.length > 0 && elements.voiceSelect) {
    elements.voiceSelect.value = systemVoices[0].name;
  }
}

// Bind DOM Event Listeners
function bindEvents() {
  // Mobile Sidebar Toggle
  elements.mobileSidebarToggle.addEventListener('click', () => {
    elements.sidebar.classList.toggle('open');
  });
  
  // Close sidebar on main click on mobile
  document.querySelector('.chat-workspace').addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.remove('open');
    }
  });

  // Teacher Card Select
  elements.teacherCards.forEach(card => {
    card.addEventListener('click', () => {
      const teacher = card.dataset.teacher;
      if (state.activeTeacher !== teacher) {
        // Cancel speech
        stopSpeaking();
        
        elements.teacherCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        state.activeTeacher = teacher;
        
        // Auto-select the best native voice for the new teacher
        autoSelectTeacherVoice();
        
        // Auto update STT language button active states
        if (teacher === 'ayesha') {
          // Miss Ayesha speaks both, let user decide or default to English
        } else {
          // Sophia is English, default STT to English
          setSttLanguage('en-US');
        }
        
        // Load chat history for this teacher
        const savedChat = localStorage.getItem(`chat_history_${state.activeTeacher}`);
        if (savedChat) {
          state.chatHistory = JSON.parse(savedChat);
          renderChatHistory();
        } else {
          resetChatHistory();
        }
      }
    });
  });

  // Speech Recognition Toggles
  elements.sttEnBtn.addEventListener('click', () => setSttLanguage('en-US'));
  elements.sttUrBtn.addEventListener('click', () => setSttLanguage('ur-PK'));

  // Slider adjustments
  elements.voiceRate.addEventListener('input', (e) => {
    elements.rateVal.textContent = e.target.value + 'x';
  });
  elements.voicePitch.addEventListener('input', (e) => {
    elements.pitchVal.textContent = e.target.value;
  });

  // Auto-speak toggle
  elements.autoSpeakToggle.addEventListener('change', (e) => {
    state.autoSpeak = e.target.checked;
    if (!state.autoSpeak) stopSpeaking();
  });

  // Clear Chat History
  elements.clearChatBtn.addEventListener('click', () => {
    if (confirm("Reset conversation with this teacher?")) {
      stopSpeaking();
      resetChatHistory();
    }
  });

  // Clear Vocab list
  elements.clearVocabBtn.addEventListener('click', () => {
    if (confirm("Clear your vocabulary log?")) {
      state.vocabList = [];
      localStorage.setItem('vocab_list', JSON.stringify(state.vocabList));
      renderVocab();
    }
  });

  // Chat Submission
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleTextSubmit();
  });

  // Handle textarea Enter key
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });

  // Microphone toggle button
  elements.micBtn.addEventListener('click', () => {
    toggleMicrophone();
  });

  // Suggestion chips
  elements.suggestionContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      elements.userInput.value = chip.dataset.prompt;
      elements.userInput.focus();
      // Auto submit suggestion
      handleTextSubmit();
    }
  });

  // Voice Engine Select Change
  if (elements.ttsEngineSelect) {
    elements.ttsEngineSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      state.ttsEngine = val;
      localStorage.setItem('tts_engine', val);
      toggleTtsEngineUI(val);
      
      // If ElevenLabs is selected but no key is configured, prompt the user
      if (val === 'elevenlabs' && !state.elevenLabsKey) {
        elements.apiKeyInput.value = state.apiKey === DEFAULT_API_KEY ? "" : state.apiKey;
        elements.elevenLabsKeyInput.value = "";
        elements.elevenLabsVoiceInput.value = state.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM";
        elements.apiModal.classList.add('open');
        elements.elevenLabsKeyInput.focus();
      }
    });
  }

  // API configuration modal events
  elements.apiKeyConfig.addEventListener('click', () => {
    elements.apiKeyInput.value = state.apiKey === DEFAULT_API_KEY ? "" : state.apiKey;
    elements.elevenLabsKeyInput.value = state.elevenLabsKey || "";
    elements.elevenLabsVoiceInput.value = state.elevenLabsVoiceId || "21m00Tcm4TlvDq8ikWAM";
    elements.apiModal.classList.add('open');
  });
  
  const closeModal = () => elements.apiModal.classList.remove('open');
  elements.closeModalX.addEventListener('click', closeModal);
  elements.cancelApiBtn.addEventListener('click', closeModal);
  
  elements.saveApiBtn.addEventListener('click', () => {
    // Save Groq key
    const newKey = elements.apiKeyInput.value.trim();
    if (newKey) {
      state.apiKey = newKey;
      localStorage.setItem('groq_api_key', newKey);
    } else {
      state.apiKey = DEFAULT_API_KEY;
      localStorage.removeItem('groq_api_key');
    }
    
    // Save ElevenLabs settings
    const elKey = elements.elevenLabsKeyInput.value.trim();
    const elVoice = elements.elevenLabsVoiceInput.value.trim();
    
    state.elevenLabsKey = elKey;
    if (elKey) {
      localStorage.setItem('elevenlabs_api_key', elKey);
    } else {
      localStorage.removeItem('elevenlabs_api_key');
    }
    
    state.elevenLabsVoiceId = elVoice || '21m00Tcm4TlvDq8ikWAM';
    localStorage.setItem('elevenlabs_voice_id', state.elevenLabsVoiceId);
    
    updateApiStatus();
    closeModal();
  });

  // Speech Recognition handlers
  if (recognition) {
    recognition.onstart = () => {
      state.isRecording = true;
      elements.micBtn.classList.add('recording');
      setAvatarState('listening');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      elements.userInput.value = transcript;
      setAvatarState('normal');
      
      // Auto submit after a 500ms voice processing visual
      setAvatarState('thinking');
      setTimeout(() => {
        handleTextSubmit();
      }, 500);
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error: ", event.error);
      setAvatarState('normal');
      state.isRecording = false;
      elements.micBtn.classList.remove('recording');
      
      let msg = `Speech input error: ${event.error}.`;
      if (window.location.protocol === 'file:' && (event.error === 'not-allowed' || event.error === 'service-not-allowed')) {
        msg += "\n\nTip: You are running this app directly as a local file (file://). Browsers restrict microphone access on local files for security. Please type your questions, or run a local web server to enable speech input.";
      } else {
        msg += " Please try typing your question.";
      }
      alert(msg);
    };

    recognition.onend = () => {
      state.isRecording = false;
      elements.micBtn.classList.remove('recording');
      if (elements.avatarContainer.classList.contains('listening')) {
        setAvatarState('normal');
      }
    };
  }
}

// UI State Toggles
function setSttLanguage(lang) {
  state.sttLanguage = lang;
  if (recognition) {
    recognition.lang = lang;
  }
  if (lang === 'en-US') {
    elements.sttEnBtn.classList.add('active');
    elements.sttUrBtn.classList.remove('active');
  } else {
    elements.sttEnBtn.classList.remove('active');
    elements.sttUrBtn.classList.add('active');
  }
}

function updateApiStatus() {
  if (state.apiKey) {
    elements.apiStatusDot.className = 'status-indicator online';
    elements.apiStatusText.textContent = state.apiKey === DEFAULT_API_KEY ? 'Groq Active (Default Key)' : 'Groq Active (Custom Key)';
  } else {
    elements.apiStatusDot.className = 'status-indicator offline';
    elements.apiStatusText.textContent = 'API Key Required';
  }
}

// Avatar State Visualizer manager
function setAvatarState(mode) {
  elements.avatarContainer.classList.remove('speaking', 'listening', 'thinking');
  
  if (mode === 'speaking') {
    elements.avatarContainer.classList.add('speaking');
    elements.avatarStatusText.textContent = "Teacher speaking...";
  } else if (mode === 'listening') {
    elements.avatarContainer.classList.add('listening');
    elements.avatarStatusText.textContent = "Listening to you...";
  } else if (mode === 'thinking') {
    elements.avatarContainer.classList.add('thinking');
    elements.avatarStatusText.textContent = "Teacher is thinking...";
  } else {
    elements.avatarStatusText.textContent = "Ready to teach";
  }
}

// Speech Recognition microphone toggle
function toggleMicrophone() {
  if (!recognition) {
    alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    return;
  }
  
  stopSpeaking(); // Shut up the teacher if she is speaking

  if (state.isRecording) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
      recognition.stop();
    }
  }
}

// Reset Conversation
function resetChatHistory() {
  state.chatHistory = [];
  localStorage.removeItem(`chat_history_${state.activeTeacher}`);
  elements.chatStream.innerHTML = '';
  
  // Add initial welcome bubble
  const teacherName = state.activeTeacher === 'sophia' ? 'Miss Sophia' : 'Miss Ayesha';
  const initialContent = state.activeTeacher === 'sophia' 
    ? `<p>Hello! I am your AI Language Teacher. I can help you learn English and Urdu grammar, literature, translation, and vocabulary. You can speak to me in English or Urdu by toggling the input language, or you can type your questions.</p>
       <div class="translation-block font-urdu">
         <p>السلام علیکم! میں آپ کی اے آئی زبان کی معلمہ ہوں۔ میں آپ کو انگریزی اور اردو گرامر، ادب، ترجمہ اور ذخیرہ الفاظ سیکھنے میں مدد کر سکتی ہوں۔ آپ ان پٹ لینگویج کو تبدیل کر کے مجھ سے انگریزی یا اردو میں بات کر سکتے ہیں، یا اپنے سوالات ٹائپ کر سکتے ہیں۔</p>
       </div>`
    : `<p>Hello and Salam! I am Miss Ayesha, your bilingual English and Urdu companion. I am excited to discuss literature, explain syntax differences, analyze poetry, or practice vocabulary with you. Ask me anything!</p>
       <div class="translation-block font-urdu">
         <p>ہیلو اور السلام علیکم! میں مس عائشہ ہوں، آپ کی دو لسانی انگریزی اور اردو کی ساتھی۔ میں آپ کے ساتھ ادب پر بحث کرنے، جملے کی ساخت کے فرق کو واضح کرنے، شاعری کا تجزیہ کرنے، یا ذخیرہ الفاظ کی مشق کرنے کے لیے پرجوش ہوں۔ مجھ سے کچھ بھی پوچھیں!</p>
       </div>`;

  appendChatBubble('teacher', initialContent, teacherName);
}

// Render Chat History array
function renderChatHistory() {
  elements.chatStream.innerHTML = '';
  state.chatHistory.forEach(msg => {
    appendChatBubble(msg.role, msg.parsedContent || msg.content, msg.name);
  });
  scrollToBottom();
}

// Submit typed or spoken text
async function handleTextSubmit() {
  const query = elements.userInput.value.trim();
  if (!query) return;

  // Clear input area
  elements.userInput.value = '';
  elements.userInput.style.height = 'auto'; // Reset text area height

  // Add User Message to Chat UI & State
  appendChatBubble('user', query, 'Student');
  state.chatHistory.push({ role: 'user', content: query, name: 'Student' });
  saveChatHistory();
  scrollToBottom();

  // Call API
  await fetchTeacherResponse(query);
}

// Append bubble to Stream
function appendChatBubble(role, content, name) {
  const bubbleTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role === 'user' ? 'user-message' : 'teacher-message'}`;
  
  const avatarChar = name ? name.charAt(0) : 'T';
  
  messageDiv.innerHTML = `
    <div class="message-avatar">${avatarChar}</div>
    <div class="message-bubble">
      <div class="bubble-header">
        <span class="teacher-name">${name}</span>
        <span class="bubble-time">${bubbleTime}</span>
      </div>
      <div class="bubble-content">${content}</div>
    </div>
  `;
  
  elements.chatStream.appendChild(messageDiv);
  scrollToBottom();
  return messageDiv;
}

// Save Chat History locally
function saveChatHistory() {
  // Cap history size to preserve local storage limits
  if (state.chatHistory.length > 50) {
    state.chatHistory = state.chatHistory.slice(-50);
  }
  localStorage.setItem(`chat_history_${state.activeTeacher}`, JSON.stringify(state.chatHistory));
}

// Auto Scroll to bottom
function scrollToBottom() {
  elements.chatStream.scrollTop = elements.chatStream.scrollHeight;
}

// Fetch Response from Groq API
async function fetchTeacherResponse(studentQuery) {
  setAvatarState('thinking');
  elements.apiStatusDot.className = 'status-indicator working';
  elements.apiStatusText.textContent = 'AI is composing response...';

  // Construct context messages (limit to last 6 messages for context sizing)
  const contextMsgs = state.chatHistory.slice(-6).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));

  const messagesPayload = [
    { role: 'system', content: SYSTEM_PROMPTS[state.activeTeacher] },
    ...contextMsgs
  ];

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${state.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: messagesPayload,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;

    // Process & Parse Teacher response
    processTeacherResponse(rawResponse);

  } catch (error) {
    console.error("API Fetch Error: ", error);
    elements.apiStatusDot.className = 'status-indicator offline';
    elements.apiStatusText.textContent = 'API Connection Error';
    
    const errBubble = appendChatBubble('teacher', `<p style="color:var(--accent-pink)">Error fetching response from teacher: ${error.message}. Please verify your Groq API key is valid.</p>`, state.activeTeacher === 'sophia' ? 'Miss Sophia' : 'Miss Ayesha');
    setAvatarState('normal');
  }
}

// Process, Parse Tags, Voice Speak and Render the response
function processTeacherResponse(rawText) {
  // 1. Extract vocabulary tags
  let parsedText = rawText;
  const vocabRegex = /\[VOCAB\]([\s\S]*?)\[\/VOCAB\]/g;
  let match;
  
  let newVocabs = [];
  while ((match = vocabRegex.exec(rawText)) !== null) {
    const vocabContent = match[1].trim();
    // Format is "English Word | Urdu Word - Meaning"
    const parts = vocabContent.split('|');
    if (parts.length >= 2) {
      const enWord = parts[0].trim();
      const rest = parts[1].split('-');
      const urWord = rest[0].trim();
      const meaning = rest.slice(1).join('-').trim();
      
      newVocabs.push({ en: enWord, ur: urWord, def: meaning });
    }
  }
  
  // Remove vocab blocks from displaying in main chat bubble
  parsedText = parsedText.replace(vocabRegex, '').trim();

  // Save new vocab words
  if (newVocabs.length > 0) {
    newVocabs.forEach(item => {
      // Check if it already exists
      const exists = state.vocabList.some(v => v.en.toLowerCase() === item.en.toLowerCase());
      if (!exists) {
        state.vocabList.unshift(item); // Add to beginning
      }
    });
    // Cap vocab list
    if (state.vocabList.length > 30) state.vocabList = state.vocabList.slice(0, 30);
    localStorage.setItem('vocab_list', JSON.stringify(state.vocabList));
    renderVocab();
  }

  // 2. Extract speech text (Text to read aloud before applying HTML rendering replacements)
  // We want to speak English parts with English voice, and Urdu parts with Urdu voice
  // Let's split text into speech blocks: {text: string, lang: 'en' | 'ur'}
  let speechBlocks = [];
  
  // Split by [URDU] or [ENGLISH] tags
  const blockRegex = /\[URDU\]([\s\S]*?)\[\/URDU\]|\[ENGLISH\]([\s\S]*?)\[\/ENGLISH\]/g;
  let lastIndex = 0;
  let blockMatch;

  // Temporary container to scan blocks
  while ((blockMatch = blockRegex.exec(parsedText)) !== null) {
    // Add text preceding the tag (assumed to be primary language of the teacher - English)
    const precedingText = parsedText.substring(lastIndex, blockMatch.index).trim();
    if (precedingText) {
      speechBlocks.push({ text: cleanSpeechText(precedingText), lang: 'en' });
    }

    if (blockMatch[1]) {
      // It's a [URDU] match
      speechBlocks.push({ text: cleanSpeechText(blockMatch[1]), lang: 'ur' });
    } else if (blockMatch[2]) {
      // It's an [ENGLISH] match
      speechBlocks.push({ text: cleanSpeechText(blockMatch[2]), lang: 'en' });
    }
    
    lastIndex = blockRegex.lastIndex;
  }
  
  // Add remaining text after last match
  const remainingText = parsedText.substring(lastIndex).trim();
  if (remainingText) {
    speechBlocks.push({ text: cleanSpeechText(remainingText), lang: 'en' });
  }

  // If no tags were matched, just speak the whole text as English
  if (speechBlocks.length === 0 && parsedText) {
    speechBlocks.push({ text: cleanSpeechText(parsedText), lang: 'en' });
  }

  // 3. Convert tags to styled HTML structures for bubble rendering
  // Replace [URDU]...[/URDU] with translation card
  let htmlContent = parsedText;
  htmlContent = htmlContent.replace(/\[URDU\]([\s\S]*?)\[\/URDU\]/g, (m, p1) => {
    return `<div class="translation-block font-urdu"><p>${p1.trim()}</p></div>`;
  });
  
  // Replace [ENGLISH]...[/ENGLISH] with translation card
  htmlContent = htmlContent.replace(/\[ENGLISH\]([\s\S]*?)\[\/ENGLISH\]/g, (m, p1) => {
    return `<div class="translation-block"><p><strong>English Translation:</strong> ${p1.trim()}</p></div>`;
  });

  // Convert markdown-like syntax to HTML formatting in bubbles
  htmlContent = formatMarkdownToHtml(htmlContent);

  // 4. Render Message bubble
  const teacherName = state.activeTeacher === 'sophia' ? 'Miss Sophia' : 'Miss Ayesha';
  const bubbleElement = appendChatBubble('teacher', htmlContent, teacherName);
  
  // Save to History state
  state.chatHistory.push({ 
    role: 'teacher', 
    content: rawText, // save raw response for context API
    parsedContent: htmlContent, // save processed HTML for quick rendering
    name: teacherName 
  });
  saveChatHistory();

  // Reset API status display
  updateApiStatus();
  setAvatarState('normal');

  // 5. Trigger Text to Speech synthesis if toggled
  if (state.autoSpeak) {
    speakTeacherResponse(speechBlocks, bubbleElement);
  }
}

// Clean brackets or tags from speech text
function cleanSpeechText(text) {
  // Strip Markdown characters for cleaner reading
  return text
    .replace(/\*|_|#/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '$1') // remove markdown links, keep text
    .trim();
}

// Simple Markdown to HTML formatter
function formatMarkdownToHtml(text) {
  return text
    // Paragraphs
    .split(/\n\n+/)
    .map(para => {
      // Check if it's a translation card or header list already, else wrap in <p>
      if (para.trim().startsWith('<div') || para.trim().startsWith('<ul>') || para.trim().startsWith('<ol>')) {
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    })
    .join('')
    // Headers
    .replace(/### (.*?)\n/g, '<h3>$1</h3>')
    .replace(/## (.*?)\n/g, '<h2>$1</h2>')
    .replace(/# (.*?)\n/g, '<h1>$1</h1>')
    // Bold / Strong
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italics / Emphasis
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet lists (simple line by line)
    .replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>')
    // Wrap lists if <li> found but not enclosed
    .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, ''); // merge lists
}

// Split text into chunks to respect character limits (e.g. 200 chars for Google Translate TTS)
function splitTextIntoChunks(text, maxLen = 180) {
  if (text.length <= maxLen) return [text];
  
  const chunks = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    
    // Find a good split point in the first maxLen characters
    let part = remaining.substring(0, maxLen);
    
    // Look for sentence/clause boundaries: period, question mark, exclamation, semicolon, comma
    let splitIdx = -1;
    const splitChars = ['. ', '? ', '! ', '; ', ', ', '۔ ', '، '];
    
    for (const char of splitChars) {
      const idx = part.lastIndexOf(char);
      if (idx > splitIdx) {
        splitIdx = idx + char.length - 1; // split after the punctuation
      }
    }
    
    // Fallback to space if no punctuation
    if (splitIdx === -1) {
      splitIdx = part.lastIndexOf(' ');
    }
    
    // Fallback to maxLen if no space
    if (splitIdx === -1) {
      splitIdx = maxLen;
    }
    
    chunks.push(remaining.substring(0, splitIdx).trim());
    remaining = remaining.substring(splitIdx).trim();
  }
  
  return chunks.filter(c => c.length > 0);
}

// Global audio playback states
let currentAudio = null;
let audioQueue = [];

// Speak response segments sequentially
function speakTeacherResponse(speechBlocks, bubbleElement) {
  stopSpeaking(); // Cancel any current utterances or audio

  state.isSpeaking = true;
  setAvatarState('speaking');
  bubbleElement.classList.add('tts-reading');

  const engine = state.ttsEngine || 'google-cloud';

  if (engine === 'native') {
    // Browser System Voices — pick best voice for each teacher
    const systemVoices = synth.getVoices();
    const selectedVoiceName = elements.voiceSelect.value;
    const rate = parseFloat(elements.voiceRate.value);
    const pitch = parseFloat(elements.voicePitch.value);

    // Resolve the best English voice for the active teacher
    const englishVoice = systemVoices.find(v => v.name === selectedVoiceName)
      || getBestEnglishVoiceForTeacher(systemVoices);

    // Best Urdu voice for Urdu blocks
    const urduVoice = systemVoices.find(v => v.lang.startsWith('ur'))
      || systemVoices.find(v => v.lang.startsWith('hi'));

    speechBlocks.forEach((block, index) => {
      if (!block.text) return;

      const utterance = new SpeechSynthesisUtterance(block.text);
      utterance.rate = rate;
      utterance.pitch = pitch;

      if (block.lang === 'ur' && urduVoice) {
        utterance.voice = urduVoice;
        utterance.lang = urduVoice.lang;
      } else if (englishVoice) {
        utterance.voice = englishVoice;
        utterance.lang = englishVoice.lang;
      }
      
      if (index === 0) {
        utterance.onstart = () => setAvatarState('speaking');
      }
      
      if (index === speechBlocks.length - 1) {
        utterance.onend = () => {
          state.isSpeaking = false;
          setAvatarState('normal');
          bubbleElement.classList.remove('tts-reading');
        };
        utterance.onerror = (e) => {
          console.error('Speech Synthesis Error: ', e);
          state.isSpeaking = false;
          setAvatarState('normal');
          bubbleElement.classList.remove('tts-reading');
        };
      }

      synth.speak(utterance);
    });
  } else {
    // Cloud TTS (Google or ElevenLabs)
    let processedBlocks = [];
    
    speechBlocks.forEach(block => {
      if (!block.text) return;
      
      if (engine === 'google-cloud') {
        // Split text for Google Translate TTS limit
        const chunks = splitTextIntoChunks(block.text, 180);
        chunks.forEach(chunk => {
          processedBlocks.push({ text: chunk, lang: block.lang });
        });
      } else {
        processedBlocks.push(block);
      }
    });

    if (processedBlocks.length === 0) {
      state.isSpeaking = false;
      setAvatarState('normal');
      bubbleElement.classList.remove('tts-reading');
      return;
    }

    audioQueue = [...processedBlocks];
    playNextCloudBlock(bubbleElement);
  }
}

// Sequential playback of cloud audio blocks
async function playNextCloudBlock(bubbleElement) {
  if (audioQueue.length === 0) {
    state.isSpeaking = false;
    setAvatarState('normal');
    bubbleElement.classList.remove('tts-reading');
    return;
  }

  const block = audioQueue.shift();
  const engine = state.ttsEngine || 'google-cloud';

  try {
    let url;
    if (engine === 'elevenlabs') {
      setAvatarState('thinking'); // Visual loading state
      url = await fetchElevenLabsAudio(block.text, block.lang);
    } else {
      const langCode = block.lang === 'ur' ? 'ur' : 'en';
      url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(block.text)}`;
    }

    setAvatarState('speaking');

    const audio = new Audio(url);
    currentAudio = audio;

    const rate = parseFloat(elements.voiceRate.value) || 1.0;
    audio.playbackRate = rate;

    // Apply speed to the element when it is loaded
    audio.addEventListener('loadedmetadata', () => {
      audio.playbackRate = rate;
    });

    audio.addEventListener('ended', () => {
      if (engine === 'elevenlabs' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      currentAudio = null;
      playNextCloudBlock(bubbleElement);
    });

    audio.addEventListener('error', (e) => {
      console.error("Audio Playback Error: ", e);
      if (engine === 'elevenlabs' && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      currentAudio = null;
      // Fallback to Native Speech Synthesis instead of skipping silently
      playNativeFallback(block, () => playNextCloudBlock(bubbleElement));
    });

    await audio.play();

  } catch (err) {
    console.error("Failed to play block: ", err);
    currentAudio = null;
    
    if (engine === 'elevenlabs') {
      console.warn("ElevenLabs failed, falling back to Google Cloud for this block.");
      // Fallback block to Google Translate TTS first, if that fails it will hit playNativeFallback
      const langCode = block.lang === 'ur' ? 'ur' : 'en';
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(block.text)}`;
      try {
        const audio = new Audio(fallbackUrl);
        currentAudio = audio;
        audio.addEventListener('ended', () => {
          currentAudio = null;
          playNextCloudBlock(bubbleElement);
        });
        audio.addEventListener('error', () => {
          currentAudio = null;
          playNativeFallback(block, () => playNextCloudBlock(bubbleElement));
        });
        await audio.play();
      } catch (fallbackErr) {
        currentAudio = null;
        playNativeFallback(block, () => playNextCloudBlock(bubbleElement));
      }
    } else {
      // Direct native fallback if Google TTS failed
      playNativeFallback(block, () => playNextCloudBlock(bubbleElement));
    }
  }
}

// Get the best English voice for the currently active teacher
function getBestEnglishVoiceForTeacher(systemVoices) {
  const allVoices = systemVoices || synth.getVoices();
  
  if (state.activeTeacher === 'sophia') {
    // Miss Sophia: Prefer British English Natural/Online voice
    return (
      // 1. British English Natural/Online voice
      allVoices.find(v => v.lang.toLowerCase().startsWith('en-gb') && (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('neural'))) ||
      // 2. British English Female
      allVoices.find(v => v.lang.toLowerCase().startsWith('en-gb') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('hazel') || v.name.toLowerCase().includes('susan'))) ||
      // 3. Any English Natural/Online voice
      allVoices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('neural'))) ||
      // 4. Google English female
      allVoices.find(v => v.lang.toLowerCase().startsWith('en') && v.name.toLowerCase().includes('google')) ||
      // 5. Any English female
      allVoices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('hazel'))) ||
      // 6. Any English
      allVoices.find(v => v.lang.toLowerCase().startsWith('en'))
    );
  } else {
    // Miss Ayesha: Prefer US English Natural/Online voice
    return (
      // 1. US English Natural/Online voice
      allVoices.find(v => v.lang.toLowerCase().startsWith('en-us') && (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('neural'))) ||
      // 2. US English Female
      allVoices.find(v => v.lang.toLowerCase().startsWith('en-us') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('aria') || v.name.toLowerCase().includes('jenny') || v.name.toLowerCase().includes('zira'))) ||
      // 3. Any English Natural/Online voice
      allVoices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('neural'))) ||
      // 4. Google English
      allVoices.find(v => v.lang.toLowerCase().startsWith('en') && v.name.toLowerCase().includes('google')) ||
      // 5. Any English female
      allVoices.find(v => v.lang.toLowerCase().startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira'))) ||
      // 6. Any English
      allVoices.find(v => v.lang.toLowerCase().startsWith('en'))
    );
  }
}

// Fallback to Web Speech API (Native) when cloud APIs fail or are blocked
function playNativeFallback(block, onDone) {
  console.warn("Playing native fallback for block:", block.text);
  const utterance = new SpeechSynthesisUtterance(block.text);
  const rate = parseFloat(elements.voiceRate.value) || 1.0;
  const pitch = parseFloat(elements.voicePitch.value) || 1.0;
  
  utterance.rate = rate;
  utterance.pitch = pitch;
  
  const systemVoices = synth.getVoices();

  // Find best Urdu voice for Urdu blocks
  const urduVoice = systemVoices.find(v => v.lang.startsWith('ur'))
    || systemVoices.find(v => v.lang.startsWith('hi'));

  // Get best English voice for current teacher
  const englishVoice = systemVoices.find(v => v.name === elements.voiceSelect.value)
    || getBestEnglishVoiceForTeacher(systemVoices);
  
  if (block.lang === 'ur' && urduVoice) {
    utterance.voice = urduVoice;
    utterance.lang = urduVoice.lang;
  } else if (englishVoice) {
    utterance.voice = englishVoice;
    utterance.lang = englishVoice.lang;
  }
  
  utterance.onstart = () => setAvatarState('speaking');
  
  utterance.onend = () => onDone();
  
  utterance.onerror = (e) => {
    console.error("Native fallback speech failed:", e);
    onDone();
  };
  
  synth.speak(utterance);
}

// Fetch generated audio from ElevenLabs REST API
async function fetchElevenLabsAudio(text, lang) {
  const apiKey = state.elevenLabsKey || localStorage.getItem('elevenlabs_api_key');
  const voiceId = state.elevenLabsVoiceId || localStorage.getItem('elevenlabs_voice_id') || '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    throw new Error("ElevenLabs API Key is not configured.");
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.75,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail?.message || `ElevenLabs API status ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Stop current speech and cancel all queues
function stopSpeaking() {
  // Cancel native speech synthesis
  if (synth.speaking) {
    synth.cancel();
  }

  // Cancel custom HTML5 audio playback
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch (e) {
      console.error(e);
    }
    currentAudio = null;
  }

  audioQueue = [];
  state.isSpeaking = false;
  setAvatarState('normal');
  
  // Remove reading highlights
  document.querySelectorAll('.message').forEach(m => m.classList.remove('tts-reading'));
}

// Render Vocabulary sidebar
function renderVocab() {
  elements.vocabList.innerHTML = '';
  
  if (state.vocabList.length === 0) {
    elements.vocabList.innerHTML = `
      <div class="vocab-placeholder">
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <p>Words translated in lessons will appear here</p>
      </div>
    `;
    return;
  }
  
  state.vocabList.forEach(item => {
    const card = document.createElement('div');
    card.className = 'vocab-card';
    
    card.innerHTML = `
      <div class="vocab-word-row">
        <span class="vocab-en">${item.en}</span>
        <button class="vocab-speak-btn" title="Listen Word"><i class="fa-solid fa-volume-high"></i></button>
      </div>
      <div class="vocab-ur">${item.ur}</div>
      <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 4px;">${item.def}</p>
    `;
    
    // Add Speech listener to listen button on vocab card
    card.querySelector('.vocab-speak-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(item.en);
    });
    
    elements.vocabList.appendChild(card);
  });
}

// Speak a single word
function speakWord(word) {
  stopSpeaking(); // cancels speech and pauses audio
  
  const engine = state.ttsEngine || 'google-cloud';
  if (engine === 'native') {
    playNativeWordFallback(word);
  } else {
    // For single word, play using Google Cloud or ElevenLabs
    if (engine === 'elevenlabs') {
      fetchElevenLabsAudio(word, 'en').then(resolvedUrl => {
        const audio = new Audio(resolvedUrl);
        currentAudio = audio;
        audio.playbackRate = 0.9;
        
        audio.addEventListener('ended', () => {
          if (resolvedUrl.startsWith('blob:')) URL.revokeObjectURL(resolvedUrl);
          currentAudio = null;
        });
        
        audio.addEventListener('error', () => {
          if (resolvedUrl.startsWith('blob:')) URL.revokeObjectURL(resolvedUrl);
          currentAudio = null;
          playNativeWordFallback(word);
        });
        
        audio.play().catch(e => {
          console.error(e);
          currentAudio = null;
          playNativeWordFallback(word);
        });
      }).catch(err => {
        console.error(err);
        // Fallback to google-cloud
        playGoogleWordWithFallback(word);
      });
    } else {
      playGoogleWordWithFallback(word);
    }
  }
}

// Play single word using Google TTS with native fallback
function playGoogleWordWithFallback(word) {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(word)}`;
  const audio = new Audio(url);
  currentAudio = audio;
  audio.playbackRate = 0.9;
  
  audio.addEventListener('ended', () => {
    currentAudio = null;
  });
  
  audio.addEventListener('error', () => {
    currentAudio = null;
    playNativeWordFallback(word);
  });
  
  audio.play().catch(e => {
    console.error(e);
    currentAudio = null;
    playNativeWordFallback(word);
  });
}

// Play single word using Browser Native Synthesis
function playNativeWordFallback(word) {
  const utterance = new SpeechSynthesisUtterance(word);
  const selectedVoiceName = elements.voiceSelect.value;
  const activeVoice = synth.getVoices().find(v => v.name === selectedVoiceName);
  
  if (activeVoice) {
    utterance.voice = activeVoice;
  }
  utterance.rate = 0.9; // speak slightly slower for learning
  synth.speak(utterance);
}
