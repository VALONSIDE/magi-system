// -----------------------------------
//  SETUP & CONFIGURATION
// -----------------------------------
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001;

app.use(cors()); 
app.use(express.json());

// 从 .env 文件中安全地获取API密钥
const qwenApiKey = process.env.QWEN_API_KEY;
const sparkApiPassword = process.env.SPARK_API_PASSWORD;
const deepseekApiKey = process.env.DEEPSEEK_API_KEY; // <-- 已更新

// -----------------------------------
//  HELPER: AI MODEL CALL FUNCTIONS
// -----------------------------------

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

// 调用通义千问 (Balthasar)
const callQwen = async (content) => {
  // ... (这部分代码保持不变) ...
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

// 调用讯飞星火 (Casper)
const callSpark = async (content) => {
  // ... (这部分代码保持不变) ...
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

// 【已更新】 调用 DeepSeek (Melchior)
const callDeepSeek = async (content) => {
  const url = 'https://api.deepseek.com/chat/completions';
  const headers = { 
    'Authorization': `Bearer ${deepseekApiKey}`,
    'Content-Type': 'application/json'
  };
  const body = {
    model: 'deepseek-chat', // 使用文档中推荐的模型
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
    // 【已更新】使用 Promise.all 并行调用新的模型组合
    const [deepseekResult, qwenResult, sparkResult] = await Promise.all([
      callDeepSeek(content), // <-- 已更新
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
        { model: 'MELCHIOR-1', ...deepseekResult }, // <-- 已更新
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