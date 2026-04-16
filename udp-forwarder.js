// UDP转发服务器，用于在Web环境下转发UDP消息
import dgram from 'dgram';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// 创建UDP客户端
const udpClient = dgram.createSocket('udp4');

// 创建HTTP服务器
const server = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/send-udp') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { address, port, message } = JSON.parse(body);
        
        // 发送UDP消息
        udpClient.send(message, port, address, (err) => {
          if (err) {
            console.error('UDP发送错误:', err);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err.message }));
          } else {
            console.log(`UDP消息已发送到 ${address}:${port}: ${message}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          }
        });
      } catch (error) {
        console.error('处理请求错误:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: '无效的请求格式' }));
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: '未找到接口' }));
  }
});

// 创建WebSocket服务器
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WebSocket客户端已连接');
  
  ws.on('message', (data) => {
    try {
      const { address, port, message } = JSON.parse(data);
      
      // 发送UDP消息
      udpClient.send(message, port, address, (err) => {
        if (err) {
          console.error('UDP发送错误:', err);
          ws.send(JSON.stringify({ success: false, error: err.message }));
        } else {
          console.log(`UDP消息已发送到 ${address}:${port}: ${message}`);
          ws.send(JSON.stringify({ success: true }));
        }
      });
    } catch (error) {
      console.error('处理WebSocket消息错误:', error);
      ws.send(JSON.stringify({ success: false, error: '无效的消息格式' }));
    }
  });
  
  ws.on('close', () => {
    console.log('WebSocket客户端已断开连接');
  });
});

// 启动服务器
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`UDP转发服务器运行在 http://localhost:${PORT}`);
  console.log('支持HTTP POST和WebSocket两种方式发送UDP消息');
});

// 关闭时清理资源
process.on('SIGINT', () => {
  console.log('关闭服务器...');
  udpClient.close();
  server.close(() => {
    console.log('服务器已关闭');
    process.exit(0);
  });
});