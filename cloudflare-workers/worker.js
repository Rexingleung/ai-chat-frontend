// Cloudflare Workers with GraphQL + DeepSeek API
// 将此文件保存为 worker.js 并用于 Cloudflare Workers 部署

import { createSchema, createYoga } from 'graphql-yoga';

// GraphQL Schema 定义
const typeDefs = `
  type Query {
    health: HealthStatus!
    conversation(id: ID!): Conversation
  }

  type Mutation {
    sendMessage(input: SendMessageInput!): SendMessageResponse!
    createConversation: CreateConversationResponse!
    clearConversation(id: ID!): ClearConversationResponse!
  }

  input SendMessageInput {
    message: String!
    conversationId: ID!
    model: String = "deepseek-chat"
    temperature: Float = 0.7
    maxTokens: Int = 1000
  }

  type SendMessageResponse {
    success: Boolean!
    message: Message
    error: String
    usage: TokenUsage
  }

  type CreateConversationResponse {
    success: Boolean!
    conversationId: ID!
    error: String
  }

  type ClearConversationResponse {
    success: Boolean!
    error: String
  }

  type Message {
    id: ID!
    content: String!
    role: MessageRole!
    timestamp: String!
    conversationId: ID!
    model: String
    tokens: Int
  }

  type Conversation {
    id: ID!
    messages: [Message!]!
    createdAt: String!
    updatedAt: String!
    messageCount: Int!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    version: String!
    services: ServiceStatus!
  }

  type ServiceStatus {
    deepseek: Boolean!
    database: Boolean!
    rateLimit: Boolean!
  }

  type TokenUsage {
    promptTokens: Int!
    completionTokens: Int!
    totalTokens: Int!
  }

  enum MessageRole {
    USER
    ASSISTANT
    SYSTEM
  }
`;

// GraphQL Resolvers
const resolvers = {
  Query: {
    health: async (parent, args, context) => {
      const { env } = context;
      
      const services = {
        deepseek: await checkDeepSeekStatus(env),
        database: await checkDatabaseStatus(env),
        rateLimit: await checkRateLimitStatus(env)
      };

      return {
        status: Object.values(services).every(Boolean) ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services
      };
    },

    conversation: async (parent, { id }, context) => {
      const { env } = context;
      
      try {
        const messages = await getConversationMessages(env, id);
        return {
          id,
          messages,
          createdAt: messages[0]?.timestamp || new Date().toISOString(),
          updatedAt: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
          messageCount: messages.length
        };
      } catch (error) {
        console.error('Error fetching conversation:', error);
        return null;
      }
    }
  },

  Mutation: {
    createConversation: async (parent, args, context) => {
      try {
        const conversationId = generateConversationId();
        
        return {
          success: true,
          conversationId,
          error: null
        };
      } catch (error) {
        return {
          success: false,
          conversationId: '',
          error: error.message
        };
      }
    },

    sendMessage: async (parent, { input }, context) => {
      const { env, request } = context;
      
      try {
        // 速率限制检查
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitCheck = await checkRateLimit(env, clientIP);
        
        if (!rateLimitCheck.allowed) {
          return {
            success: false,
            message: null,
            error: `请求过于频繁，请 ${rateLimitCheck.resetTime} 秒后重试`
          };
        }

        // 输入验证
        const validation = validateMessageInput(input);
        if (!validation.valid) {
          return {
            success: false,
            message: null,
            error: validation.error
          };
        }

        // 获取对话历史
        const conversationHistory = await getConversationMessages(env, input.conversationId);
        
        // 保存用户消息
        const userMessage = {
          id: generateMessageId(),
          content: input.message,
          role: 'USER',
          timestamp: new Date().toISOString(),
          conversationId: input.conversationId,
          model: null,
          tokens: estimateTokens(input.message)
        };

        await saveMessage(env, userMessage);

        // 调用 DeepSeek API
        const deepseekResponse = await callDeepSeekAPI(env, {
          message: input.message,
          history: conversationHistory,
          model: input.model,
          temperature: input.temperature,
          maxTokens: input.maxTokens
        });

        // 保存 AI 回复
        const aiMessage = {
          id: generateMessageId(),
          content: deepseekResponse.content,
          role: 'ASSISTANT',
          timestamp: new Date().toISOString(),
          conversationId: input.conversationId,
          model: input.model,
          tokens: deepseekResponse.usage?.completion_tokens || 0
        };

        await saveMessage(env, aiMessage);

        return {
          success: true,
          message: aiMessage,
          error: null,
          usage: deepseekResponse.usage ? {
            promptTokens: deepseekResponse.usage.prompt_tokens,
            completionTokens: deepseekResponse.usage.completion_tokens,
            totalTokens: deepseekResponse.usage.total_tokens
          } : null
        };

      } catch (error) {
        console.error('Error in sendMessage:', error);
        return {
          success: false,
          message: null,
          error: '服务暂时不可用，请稍后重试'
        };
      }
    },

    clearConversation: async (parent, { id }, context) => {
      const { env } = context;
      
      try {
        await clearConversationMessages(env, id);
        return {
          success: true,
          error: null
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  }
};

// DeepSeek API 调用函数
async function callDeepSeekAPI(env, { message, history, model = 'deepseek-chat', temperature = 0.7, maxTokens = 1000 }) {
  // 使用提供的 DeepSeek API Key
  const apiKey = env.DEEPSEEK_API_KEY || 'sk-c7bae2605b6e48feb8ff9d626045e79a';
  
  if (!apiKey) {
    throw new Error('DeepSeek API Key 未配置');
  }

  // 构建消息历史
  const messages = [
    {
      role: 'system',
      content: '你是一个友善、有帮助的AI助手。请用中文回答问题，保持回答准确、简洁且有用。'
    }
  ];

  // 添加历史消息（限制最近20条）
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role.toLowerCase(),
      content: msg.content
    });
  }

  // 添加当前用户消息
  messages.push({
    role: 'user',
    content: message
  });

  const requestBody = {
    model: model,
    messages: messages,
    temperature: temperature,
    max_tokens: maxTokens,
    stream: false
  };

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('DeepSeek API Error:', response.status, errorText);
    throw new Error(`DeepSeek API 错误: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0]) {
    throw new Error('DeepSeek API 返回数据格式错误');
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage
  };
}

// 数据库操作函数
async function saveMessage(env, message) {
  const key = `msg:${message.conversationId}:${message.id}`;
  await env.CHAT_DB.put(key, JSON.stringify(message));
  
  // 更新对话消息列表
  const listKey = `conv:${message.conversationId}`;
  const existingList = await env.CHAT_DB.get(listKey);
  const messageIds = existingList ? JSON.parse(existingList) : [];
  messageIds.push(message.id);
  
  // 限制每个对话最多保存100条消息
  if (messageIds.length > 100) {
    const removedId = messageIds.shift();
    await env.CHAT_DB.delete(`msg:${message.conversationId}:${removedId}`);
  }
  
  await env.CHAT_DB.put(listKey, JSON.stringify(messageIds));
}

async function getConversationMessages(env, conversationId) {
  const listKey = `conv:${conversationId}`;
  const messageIds = await env.CHAT_DB.get(listKey);
  
  if (!messageIds) {
    return [];
  }

  const ids = JSON.parse(messageIds);
  const messages = [];

  for (const id of ids) {
    const messageKey = `msg:${conversationId}:${id}`;
    const messageData = await env.CHAT_DB.get(messageKey);
    if (messageData) {
      messages.push(JSON.parse(messageData));
    }
  }

  return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function clearConversationMessages(env, conversationId) {
  const listKey = `conv:${conversationId}`;
  const messageIds = await env.CHAT_DB.get(listKey);
  
  if (messageIds) {
    const ids = JSON.parse(messageIds);
    for (const id of ids) {
      await env.CHAT_DB.delete(`msg:${conversationId}:${id}`);
    }
    await env.CHAT_DB.delete(listKey);
  }
}

// 速率限制
async function checkRateLimit(env, clientIP) {
  const key = `rate:${clientIP}`;
  const limit = 30; // 每分钟30次
  const window = 60; // 60秒

  try {
    const current = await env.RATE_LIMIT.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= limit) {
      return { allowed: false, resetTime: window };
    }

    await env.RATE_LIMIT.put(key, (count + 1).toString(), {
      expirationTtl: window
    });

    return { allowed: true, remaining: limit - count - 1 };
  } catch (error) {
    console.error('Rate limit check error:', error);
    return { allowed: true };
  }
}

// 输入验证
function validateMessageInput(input) {
  if (!input.message || typeof input.message !== 'string') {
    return { valid: false, error: '消息内容不能为空' };
  }

  if (input.message.length > 2000) {
    return { valid: false, error: '消息长度不能超过2000字符' };
  }

  if (!input.conversationId) {
    return { valid: false, error: '会话ID不能为空' };
  }

  if (input.temperature && (input.temperature < 0 || input.temperature > 2)) {
    return { valid: false, error: '温度参数必须在0-2之间' };
  }

  if (input.maxTokens && (input.maxTokens < 1 || input.maxTokens > 4000)) {
    return { valid: false, error: '最大token数必须在1-4000之间' };
  }

  return { valid: true };
}

// 健康检查函数
async function checkDeepSeekStatus(env) {
  try {
    const apiKey = env.DEEPSEEK_API_KEY || 'sk-c7bae2605b6e48feb8ff9d626045e79a';
    if (!apiKey) return false;
    
    const response = await fetch('https://api.deepseek.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function checkDatabaseStatus(env) {
  try {
    await env.CHAT_DB.get('health_check');
    return true;
  } catch {
    return false;
  }
}

async function checkRateLimitStatus(env) {
  try {
    await env.RATE_LIMIT.get('health_check');
    return true;
  } catch {
    return false;
  }
}

// 工具函数
function generateConversationId() {
  return 'conv_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function generateMessageId() {
  return 'msg_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function estimateTokens(text) {
  // 简单的token估算，中文大约1.5个字符=1个token
  return Math.ceil(text.length / 1.5);
}

// 创建 GraphQL Yoga 实例
const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  cors: {
    origin: '*',
    credentials: true,
  },
  graphiql: true, // 启用 GraphiQL 界面
  context: ({ request, env }) => ({ request, env }),
});

// Cloudflare Workers 入口点
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // GraphQL 端点
    if (url.pathname.startsWith('/graphql')) {
      return yoga.fetch(request, env, ctx);
    }
    
    // 健康检查端点
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        graphql: url.origin + '/graphql'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 默认重定向到 GraphiQL
    if (url.pathname === '/') {
      return Response.redirect(url.origin + '/graphql', 302);
    }

    return new Response('Not Found', { status: 404 });
  },
};
