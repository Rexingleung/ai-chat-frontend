# AI Chat Frontend

基于 React + TypeScript + GraphQL + DeepSeek 的智能对话前端应用。

## 🌟 在线演示

🔗 **访问地址**: [https://rexingleung.github.io/ai-chat-frontend](https://rexingleung.github.io/ai-chat-frontend)

## ✨ 功能特性

- 🤖 **AI 对话**: 基于 DeepSeek 的智能对话
- 📡 **GraphQL**: 现代化的 API 通信协议
- 💬 **实时聊天**: 流畅的对话体验
- 🎨 **现代界面**: 精美的 UI 设计
- 📱 **响应式**: 适配各种设备
- ⚙️ **参数调节**: 可调整 AI 模型参数
- 🔄 **多轮对话**: 支持上下文记忆

## 🚀 快速开始

### 本地开发

```bash
# 克隆项目
git clone https://github.com/Rexingleung/ai-chat-frontend.git
cd ai-chat-frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 部署到 GitHub Pages

```bash
# 构建并部署
npm run deploy
```

## 🔧 配置说明

### API 端点配置

在 `src/components/AIChatWithGraphQL.tsx` 中修改 GraphQL API 端点：

```typescript
// 更新为你的 Cloudflare Workers URL
const GRAPHQL_API_URL = 'https://your-worker.your-subdomain.workers.dev/graphql';
```

### 支持的 AI 模型

- `deepseek-chat`: 通用对话模型
- `deepseek-coder`: 代码专用模型

### 可调参数

- **温度 (Temperature)**: 0-2, 控制回答的创造性
- **最大长度 (Max Tokens)**: 100-4000, 控制回答长度

## 📁 项目结构

```
ai-chat-frontend/
├── public/                 # 静态资源
├── src/
│   ├── components/        # React 组件
│   │   └── AIChatWithGraphQL.tsx  # 主要聊天组件
│   ├── App.tsx           # 主应用组件
│   ├── App.css          # 应用样式
│   └── index.tsx        # 入口文件
├── package.json         # 项目配置
└── README.md           # 项目文档
```

## 🎯 核心组件

### AIChatWithGraphQL

主要的聊天组件，包含以下功能：

- GraphQL 客户端通信
- 消息发送和接收
- 对话历史管理
- 模型参数配置
- 错误处理和重试

### GraphQL 查询示例

```graphql
# 发送消息
mutation {
  sendMessage(input: {
    message: "你好，请介绍一下你自己"
    conversationId: "conv_xxx"
    model: "deepseek-chat"
    temperature: 0.7
    maxTokens: 1000
  }) {
    success
    message {
      content
      role
      timestamp
    }
    usage {
      totalTokens
    }
  }
}
```

## 🔗 相关链接

- [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)
- [GraphQL 官方文档](https://graphql.org/)
- [React 官方文档](https://react.dev/)
- [TypeScript 官方文档](https://www.typescriptlang.org/)

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [DeepSeek](https://www.deepseek.com/) - 提供强大的 AI 模型
- [Cloudflare Workers](https://workers.cloudflare.com/) - 无服务器计算平台
- [React](https://react.dev/) - 用户界面库
- [Lucide React](https://lucide.dev/) - 图标库

---

**开始与 AI 对话吧！** 🚀
