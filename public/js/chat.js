// public/js/chat.js

(function () {
  // 요소 참조
  const root = document.getElementById('chat-root');
  if (!root) return; // 다른 페이지에서 로드될 수도 있으니 방어
  const CHAT_ID = Number(root.dataset.chatId);
  const log = document.getElementById('log');
  const ty = document.getElementById('typing');
  const input = document.getElementById('text');
  const sendBtn = document.getElementById('sendBtn');

  function addMsg({ content, senderId, me, senderName, createdAt }) {
    const wrap = document.createElement('div');
    wrap.className = 'msg' + (me ? ' mine' : '');
    const t = createdAt ? new Date(createdAt) : new Date();

    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.color = '#666';
    meta.textContent = `${senderName || (me ? '나' : '상대')} · ${t.toLocaleString()}`;

    const body = document.createElement('div');
    body.style.marginTop = '4px';
    body.style.whiteSpace = 'pre-wrap';
    body.textContent = content; // XSS 안전

    wrap.appendChild(meta);
    wrap.appendChild(body);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  // 초기 메시지 로드
  fetch(`/api/chats/${CHAT_ID}/messages`)
    .then(r => r.ok ? r.json() : [])
    .then(list => {
      (list || []).forEach(m => addMsg({
        content: m.content,
        senderId: m.senderId,
        senderName: m.senderName,
        createdAt: m.createdAt,
        me: false
      }));
    })
    .catch(() => {});

  // socket.io 연결
  const socket = io('/chat', { withCredentials: true });

  socket.on('connect', () => {
    socket.emit('join', { chatId: CHAT_ID });
  });

  let typingTimer = null;
  input.addEventListener('input', () => {
    socket.emit('typing', { chatId: CHAT_ID, isTyping: true });
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      socket.emit('typing', { chatId: CHAT_ID, isTyping: false });
    }, 800);
  });

  socket.on('typing', ({ userId, isTyping }) => {
    ty.style.display = isTyping ? 'block' : 'none';
  });

  // 전송 버튼
  sendBtn.addEventListener('click', () => {
    const content = (input.value || '').trim();
    if (!content) return;

    // 서버에 전송
    socket.emit('message:send', { chatId: CHAT_ID, content });

    // 로컬에 즉시 표시 (에코)
    addMsg({ content, me: true, senderName: '나' });

    input.value = '';
    input.focus();
  });

  // 서버에서 받은 새 메시지
  socket.on('message:new', (msg) => {
    addMsg({
      content: msg.content,
      senderId: msg.senderId,
      senderName: msg.senderName,
      createdAt: msg.createdAt,
      me: false
    });
  });
})();
