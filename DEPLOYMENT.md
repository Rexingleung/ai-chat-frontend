# 部署配置说明

## 🚀 前端部署

前端项目已部署到 GitHub Pages，访问地址：
**https://rexingleung.github.io/ai-chat-frontend**

## 🔧 后端配置

### 1. Cloudflare Workers 部署

你需要部署Cloudflare Workers后端来支持GraphQL API和DeepSeek集成。

#### 快速部署步骤：

1. **安装 Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **创建 Worker 项目**
   ```bash
   mkdir ai-chat-workers
   cd ai-chat-workers
   ```

4. **创建 wrangler.toml**
   ```toml
   name = "ai-chat-graphql"
   main = "worker.js"
   compatibility_date = "2024-01-01"
   compatibility_flags = ["nodejs_compat"]

   [[kv_namespaces]]
   binding = "CHAT_DB"
   id = "your-chat-db-namespace-id"
   preview_id = "your-chat-db-preview-namespace-id"

   [[kv_namespaces]]
   binding = "RATE_LIMIT"
   id = "your-rate-limit-namespace-id"
   preview_id = "your-rate-limit-preview-namespace-id"

   [vars]
   ENVIRONMENT = "production"
   ```

5. **创建 KV 命名空间**
   ```bash
   wrangler kv:namespace create "CHAT_DB"
   wrangler kv:namespace create "CHAT_DB" --preview
   wrangler kv:namespace create "RATE_LIMIT"
   wrangler kv:namespace create "RATE_LIMIT" --preview
   ```

6. **设置 DeepSeek API Key**
   ```bash
   wrangler secret put DEEPSEEK_API_KEY
   # 输入: key
   ```

7. **创建 package.json**
   ```json
   {
     "name": "ai-chat-workers",
     "version": "1.0.0",
     "dependencies": {
       "graphql": "^16.8.1",
       "graphql-yoga": "^5.1.1"
     }
   }
   ```

8. **安装依赖并部署**
   ```bash
   npm install
   wrangler publish
   ```

### 2. 获取 Worker URL

部署成功后，你会得到一个类似这样的URL：
`https://ai-chat-graphql.your-subdomain.workers.dev`

### 3. 更新前端配置

在前端项目中更新API端点：

1. 编辑 `src/components/AIChatWithGraphQL.tsx`
2. 找到这一行：
   ```typescript
   const GRAPHQL_API_URL = 'https://ai-chat-graphql.your-subdomain.workers.dev/graphql';
   ```
3. 替换为你的实际 Worker URL

### 4. 重新部署前端

更新API端点后，提交更改到GitHub，前端会自动重新部署。

## 🧪 测试部署

### 1. 测试后端API

```bash
# 健康检查
curl https://your-worker.workers.dev/health

# GraphQL查询
curl -X POST https://your-worker.workers.dev/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query{health{status services{deepseek database rateLimit}}}"}'
```

### 2. 测试前端

访问 https://rexingleung.github.io/ai-chat-frontend 并：
- 点击右下角的AI聊天按钮
- 发送测试消息
- 检查是否正常回复

## 🔧 故障排除

### 常见问题：

1. **前端无法连接后端**
   - 检查API端点URL是否正确
   - 确保Cloudflare Workers已部署
   - 检查CORS配置

2. **DeepSeek API错误**
   - 验证API Key是否正确设置
   - 检查DeepSeek服务状态

3. **KV存储错误**
   - 确保KV命名空间已创建并正确配置

### 调试步骤：

1. **查看Workers日志**
   ```bash
   wrangler tail
   ```

2. **使用GraphiQL界面**
   访问: `https://your-worker.workers.dev/graphql`

3. **检查浏览器控制台**
   查看前端错误信息

## 📞 技术支持

如果遇到问题，请：
1. 检查GitHub Issues
2. 查看Cloudflare Workers文档
3. 验证DeepSeek API状态

---

**🎉 现在你可以开始使用AI聊天应用了！**
