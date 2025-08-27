require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initChatSocket } = require('./sockets/chat'); // 아까 만든 소켓 모듈

const port = process.env.PORT || 3000;

// http 서버 생성
const server = http.createServer(app);

// socket.io는 Server 클래스로 import
const { Server } = require('socket.io');

// io 객체 생성
const io = new Server(server, {
  cors: { origin: true, credentials: true } // credentials 오타 수정
});

// 채팅 소켓 초기화
initChatSocket(io);

// 서버 실행
server.listen(port, () => {
  console.log('server listening on http://localhost:' + port);
});
