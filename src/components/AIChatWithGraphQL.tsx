import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, MoreVertical, Minimize2, AlertCircle, RefreshCw, Settings, Zap } from 'lucide-react';

// GraphQL 查询和变更定义
const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      success
      message {
        id
        content
        role
        timestamp
        model
        tokens
      }
      error
      usage {
        promptTokens
        completionTokens
        totalTokens
      }
    }
  }
`;

const CREATE_CONVERSATION_MUTATION = `
  mutation CreateConversation {
    createConversation {
      success
      conversationId
      error
    }
  }
`;

const CLEAR_CONVERSATION_MUTATION = `
  mutation ClearConversation($id: ID!) {
    clearConversation(id: $id) {
      success
      error
    }
  }
`;

const HEALTH_QUERY = `
  query Health {
    health {
      status
      timestamp
      services {
        deepseek
        database
        rateLimit
      }
    }
  }
`;

interface Message {
  id: string;
  content: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  timestamp: string;
  model?: string;
  tokens?: number;
  isTyping?: boolean;
  error?: boolean;
}

interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

interface GraphQLError {
  message: string;
  extensions?: {
    code: string;
  };
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

const AIChatWithGraphQL: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showSettings, setShowSettings] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [totalTokens, setTotalTokens] = useState(0);
  
  const [settings, setSettings] = useState<ChatSettings>({
    model: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 1000
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🔧 更新为你的 Cloudflare Workers GraphQL 端点
  // 在部署后，请将下面的 URL 替换为你的实际 Workers URL
  const GRAPHQL_API_URL = 'https://ai-chat-graphql.your-subdomain.workers.dev/graphql';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化对话
  useEffect(() => {
    initializeChat();
    checkHealth();
  }, []);

  // GraphQL 请求函数
  const graphqlRequest = async <T,>(
    query: string, 
    variables?: any
  ): Promise<GraphQLResponse<T>> => {
    try {
      const response = await fetch(GRAPHQL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('GraphQL request error:', error);
      throw error;
    }
  };

  // 初始化聊天
  const initializeChat = async () => {
    try {
      const response = await graphqlRequest<{ createConversation: any }>(
        CREATE_CONVERSATION_MUTATION
      );

      if (response.data?.createConversation.success) {
        const newConversationId = response.data.createConversation.conversationId;
        setConversationId(newConversationId);
        setMessages([
          {
            id: 'welcome',
            content: '你好！我是基于DeepSeek的AI助手，有什么可以帮助你的吗？\n\n✨ 我可以帮你：\n• 回答各种问题\n• 协助编程和代码分析\n• 创作和翻译文本\n• 解决学习和工作中的问题',
            role: 'ASSISTANT',
            timestamp: new Date().toISOString()
          }
        ]);
      } else {
        throw new Error(response.data?.createConversation.error || '创建对话失败');
      }
    } catch (error) {
      console.error('Initialize chat error:', error);
      setError('连接AI服务失败，请检查网络连接或稍后重试');
      // 设置离线模式的欢迎消息
      setMessages([
        {
          id: 'offline',
          content: '⚠️ 暂时无法连接到AI服务，请稍后重试。\n\n请确保：\n• 网络连接正常\n• Cloudflare Workers已部署\n• API端点配置正确',
          role: 'ASSISTANT',
          timestamp: new Date().toISOString(),
          error: true
        }
      ]);
    }
  };

  // 健康检查
  const checkHealth = async () => {
    try {
      const response = await graphqlRequest<{ health: any }>(HEALTH_QUERY);
      setHealthStatus(response.data?.health);
      if (response.data?.health?.services?.deepseek) {
        setError(''); // 清除错误状态
      }
    } catch (error) {
      console.error('Health check error:', error);
      setError('无法连接到服务器');
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // 如果没有对话ID，尝试重新初始化
    if (!conversationId) {
      await initializeChat();
      if (!conversationId) return;
    }

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      content: inputValue.trim(),
      role: 'USER',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError('');

    // 添加打字指示器
    const typingMessage: Message = {
      id: 'typing',
      content: '',
      role: 'ASSISTANT',
      timestamp: new Date().toISOString(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await graphqlRequest<{ sendMessage: any }>(
        SEND_MESSAGE_MUTATION,
        {
          input: {
            message: userMessage.content,
            conversationId: conversationId,
            model: settings.model,
            temperature: settings.temperature,
            maxTokens: settings.maxTokens
          }
        }
      );

      if (response.errors) {
        throw new Error(response.errors[0].message);
      }

      const result = response.data?.sendMessage;
      
      if (!result?.success) {
        throw new Error(result?.error || '发送消息失败');
      }

      // 移除打字指示器并添加AI回复
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.id !== 'typing');
        if (result.message) {
          const aiMessage: Message = {
            id: result.message.id,
            content: result.message.content,
            role: result.message.role,
            timestamp: result.message.timestamp,
            model: result.message.model,
            tokens: result.message.tokens
          };
          return [...withoutTyping, aiMessage];
        }
        return withoutTyping;
      });

      // 更新token统计
      if (result.usage) {
        setTotalTokens(prev => prev + result.usage.totalTokens);
      }

    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setError(errorMessage);
      
      setMessages(prev => {
        const withoutTyping = prev.filter(msg => msg.id !== 'typing');
        const errorMsg: Message = {
          id: `error_${Date.now()}`,
          content: `抱歉，我遇到了一些问题：${errorMessage}\n\n请稍后重试，或检查网络连接。`,
          role: 'ASSISTANT',
          timestamp: new Date().toISOString(),
          error: true
        };
        return [...withoutTyping, errorMsg];
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 清空对话
  const clearConversation = async () => {
    if (!conversationId) return;
    
    try {
      await graphqlRequest<{ clearConversation: any }>(
        CLEAR_CONVERSATION_MUTATION,
        { id: conversationId }
      );
      
      setMessages([
        {
          id: 'welcome',
          content: '对话已清空。有什么新的问题吗？',
          role: 'ASSISTANT',
          timestamp: new Date().toISOString()
        }
      ]);
      setTotalTokens(0);
      setError('');
    } catch (error) {
      console.error('Clear conversation error:', error);
      setError('清空对话失败');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRetry = () => {
    const lastUserMessage = messages
      .filter(msg => msg.role === 'USER')
      .pop();
    
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
      setMessages(prev => 
        prev.filter(msg => !(msg.error && msg.role === 'ASSISTANT'))
      );
    }
  };

  const TypingIndicator = () => (
    <div className="flex items-center space-x-1 p-2">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
      </div>
      <span className="text-xs text-gray-500 ml-2">DeepSeek正在思考...</span>
    </div>
  );

  const ErrorBanner = () => {
    if (!error) return null;
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 m-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-red-700 text-sm">{error}</span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={checkHealth}
            className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
            title="重新检查连接"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={handleRetry}
            className="text-red-600 hover:text-red-800 p-1 rounded transition-colors"
            title="重试"
          >
            重试
          </button>
        </div>
      </div>
    );
  };

  const SettingsPanel = () => {
    if (!showSettings) return null;

    return (
      <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-10">
        <h3 className="font-semibold mb-3 flex items-center">
          <Settings size={16} className="mr-2" />
          模型设置
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              模型
            </label>
            <select
              value={settings.model}
              onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="deepseek-chat">DeepSeek Chat (通用对话)</option>
              <option value="deepseek-coder">DeepSeek Coder (编程专用)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              创造性 (Temperature): {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>保守准确</span>
              <span>创造多样</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              最大输出长度
            </label>
            <input
              type="number"
              min="100"
              max="4000"
              step="100"
              value={settings.maxTokens}
              onChange={(e) => setSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
        </div>

        {healthStatus && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">服务状态</h4>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span>DeepSeek API:</span>
                <span className={healthStatus.services?.deepseek ? 'text-green-600' : 'text-red-600'}>
                  {healthStatus.services?.deepseek ? '✅ 正常' : '❌ 异常'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>数据库:</span>
                <span className={healthStatus.services?.database ? 'text-green-600' : 'text-red-600'}>
                  {healthStatus.services?.database ? '✅ 正常' : '❌ 异常'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>速率限制:</span>
                <span className={healthStatus.services?.rateLimit ? 'text-green-600' : 'text-red-600'}>
                  {healthStatus.services?.rateLimit ? '✅ 正常' : '❌ 异常'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p><strong>API端点:</strong></p>
            <p className="font-mono text-xs break-all">{GRAPHQL_API_URL}</p>
            <p className="mt-2 text-orange-600">
              ⚠️ 如果无法连接，请确保已部署Cloudflare Workers并更新API端点URL
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white rounded-full p-4 shadow-lg transition-all duration-300 transform hover:scale-105 relative"
        >
          <Bot size={24} />
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
            AI
          </div>
          {error && (
            <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[650px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-lg relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Zap size={18} />
            </div>
            <div>
              <h3 className="font-semibold flex items-center">
                DeepSeek AI
                {healthStatus?.services?.deepseek ? (
                  <div className="w-2 h-2 bg-green-400 rounded-full ml-2"></div>
                ) : (
                  <div className="w-2 h-2 bg-red-400 rounded-full ml-2 animate-pulse"></div>
                )}
              </h3>
              <p className="text-xs opacity-90">
                {isLoading ? '正在思考...' : `模型: ${settings.model}`}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="hover:bg-white/20 p-1 rounded transition-colors"
                title="设置"
              >
                <Settings size={16} />
              </button>
              <SettingsPanel />
            </div>
            <button
              onClick={clearConversation}
              className="hover:bg-white/20 p-1 rounded transition-colors text-xs px-2 py-1"
              title="清空对话"
            >
              清空
            </button>
            <button
              onClick={() => setIsMinimized(true)}
              className="hover:bg-white/20 p-1 rounded transition-colors"
              title="最小化"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Token 统计 */}
        {totalTokens > 0 && (
          <div className="mt-2 text-xs opacity-75">
            本次对话已使用 {totalTokens.toLocaleString()} Tokens
          </div>
        )}
      </div>

      {/* Error Banner */}
      <ErrorBanner />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex items-start space-x-2 max-w-[85%] ${
              message.role === 'USER' ? 'flex-row-reverse space-x-reverse' : ''
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'USER' 
                  ? 'bg-purple-600 text-white' 
                  : message.error
                  ? 'bg-red-300 text-red-700'
                  : 'bg-blue-500 text-white'
              }`}>
                {message.role === 'USER' ? (
                  <User size={16} />
                ) : (
                  <Bot size={16} />
                )}
              </div>
              <div className={`p-3 rounded-lg ${
                message.role === 'USER'
                  ? 'bg-purple-600 text-white rounded-br-sm'
                  : message.error
                  ? 'bg-red-50 text-red-800 rounded-bl-sm border border-red-200'
                  : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200 shadow-sm'
              }`}>
                {message.isTyping ? (
                  <TypingIndicator />
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </p>
                    <div className={`flex justify-between items-center mt-2 text-xs ${
                      message.role === 'USER' 
                        ? 'text-purple-100' 
                        : message.error
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}>
                      <span>
                        {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {message.tokens && (
                        <span className="ml-2">
                          {message.tokens} tokens
                        </span>
                      )}
                      {message.model && (
                        <span className="ml-2 opacity-75">
                          {message.model}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Connection Status */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              error ? 'bg-red-500' : healthStatus?.services?.deepseek ? 'bg-green-500' : 'bg-yellow-500'
            }`}></div>
            <span className={
              error ? 'text-red-600' : healthStatus?.services?.deepseek ? 'text-green-600' : 'text-yellow-600'
            }>
              {error ? '连接异常' : healthStatus?.services?.deepseek ? 'DeepSeek已连接' : '检查连接中...'}
            </span>
          </div>
          {conversationId && (
            <span className="text-gray-500">
              会话: {conversationId.slice(-8)}
            </span>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
        <div className="flex items-center space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isLoading ? "AI正在思考..." : "与DeepSeek对话..."}
            disabled={isLoading}
            maxLength={2000}
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-full p-2 transition-all duration-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>Enter发送 • Shift+Enter换行 • GraphQL+DeepSeek</span>
          <span className={inputValue.length > 1800 ? 'text-red-500' : ''}>
            {inputValue.length}/2000
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIChatWithGraphQL;