// -----------------------------------
//  SETUP & CONFIGURATION
// -----------------------------------
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// 【修正】1. 先创建 app 实例
const app = express();
const PORT = process.env.PORT || 3001; // Render 会提供一个 PORT 环境变量，我们优先使用它

// -----------------------------------
//  ENVIRONMENT & SECURITY
// -----------------------------------

// 启动时检查环境变量
const requiredEnvVars = ['QWEN_API_KEY', 'SPARK_API_PASSWORD', 'DEEPSEEK_API_KEY'];
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`错误：环境变量 ${varName} 未设置。服务器无法启动。`);
    process.exit(1);
  }
}

// CORS 配置
const allowedOrigins = [
  'http://localhost:5173', 
  'https://magi-frontend-dei3a527r-valonsides-projects.vercel.app' // 再次确认这个URL完全正确
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // 【新增】在日志中打印出被拒绝的URL
      console.error(`CORS 拒绝了来源: ${origin}`); 
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // for some legacy browsers
};

app.use(cors(corsOptions));

app.use(express.json()); // 解析JSON请求体

// 从 .env 文件中安全地获取API密钥
const qwenApiKey = process.env.QWEN_API_KEY;
const sparkApiPassword = process.env.SPARK_API_PASSWORD;
const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

// -----------------------------------
//  HELPER: AI MODEL CALL FUNCTIONS
// -----------------------------------
// ... (这部分及之后的所有代码都保持不变，无需修改) ...

const createSystemPrompt = (userContent) => {
  return `你是一个决策辅助系统。请分析以下内容，并做出“同意”或“否定”的决策。
你的回答必须严格遵循以下JSON格式:
{
  "decision": (一个数字，0代表否定，1代表同意),
  "explanation": "你的详细解释理由。"
}

需要分析的内容是：
"${userContent}"`;
};

const callQwen = async (content) => {
  const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
  const headers = { 'Authorization': `Bearer ${qwenApiKey}` };
  const body = {
    model: 'qwen-plus',
    messages: [{ role: 'system', content: createSystemPrompt(content) }],
    response_format: { type: 'json_object' }
  };
  try {
    const response = await axios.post(url, body, { headers });
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Error calling Qwen:', error.response ? error.response.data : error.message);
    return { decision: 0, explanation: '通义千问模型调用失败。' };
  }
};

const callSpark = async (content) => {
  const url = 'https://spark-api-open.xf-yun.com/v1/chat/completions';
  const headers = { 'Authorization': `Bearer ${sparkApiPassword}` };
  const body = {
    model: 'generalv3.5',
    messages: [{ role: 'system', content: createSystemPrompt(content) }],
    response_format: { type: 'json_object' }
  };
  try {
    const response = await axios.post(url, body, { headers });
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Error calling Spark:', error.response ? error.response.data : error.message);
    return { decision: 0, explanation: '讯飞星火模型调用失败。' };
  }
};

const callDeepSeek = async (content) => {
  const url = 'https://api.deepseek.com/chat/completions';
  const headers = { 
    'Authorization': `Bearer ${deepseekApiKey}`,
    'Content-Type': 'application/json'
  };
  const body = {
    model: 'deepseek-chat',
    messages: [{ role: 'system', content: createSystemPrompt(content) }],
    response_format: { type: 'json_object' }
  };
  try {
    const response = await axios.post(url, body, { headers });
    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('Error calling DeepSeek:', error.response ? error.response.data : error.message);
    return { decision: 0, explanation: 'DeepSeek模型调用失败。' };
  }
};

// -----------------------------------
//  MAIN API ENDPOINT
// -----------------------------------
app.post('/decide', async (req, res) => {
  console.log('Received a decision request...');
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required.' });
  }

  try {
    const [deepseekResult, qwenResult, sparkResult] = await Promise.all([
      callDeepSeek(content),
      callQwen(content),
      callSpark(content)
    ]);

    const votes = [deepseekResult.decision, qwenResult.decision, sparkResult.decision];
    const agreeVotes = votes.filter(v => v === 1).length;
    const finalDecision = agreeVotes >= 2 ? 'APPROVED' : 'REJECTED';
    
    console.log('Decision complete:', finalDecision);

    res.json({
      finalDecision,
      results: [
        { model: 'MELCHIOR-1', ...deepseekResult },
        { model: 'BALTHASAR-2', ...qwenResult },
        { model: 'CASPER-3', ...sparkResult }
      ]
    });

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});

// -----------------------------------
//  START SERVER
// -----------------------------------
app.listen(PORT, () => {
  console.log(`MAGI System Backend is ready and listening on port ${PORT}`);
});