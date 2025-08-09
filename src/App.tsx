import React from 'react';
import './App.css';
import AIChatWithGraphQL from './components/AIChatWithGraphQL';

function App() {
  return (
    <div className="App">
      <div className="app-background">
        <div className="app-container">
          <header className="app-header">
            <h1>AI Chat Demo</h1>
            <p>基于 GraphQL + DeepSeek 的智能对话系统</p>
          </header>
          
          <main className="app-main">
            <div className="demo-info">
              <div className="info-card">
                <h3>🚀 技术特性</h3>
                <ul>
                  <li>GraphQL API 接口</li>
                  <li>DeepSeek AI 模型</li>
                  <li>实时对话体验</li>
                  <li>响应式设计</li>
                </ul>
              </div>
              
              <div className="info-card">
                <h3>💬 使用说明</h3>
                <ul>
                  <li>点击右下角聊天图标开始对话</li>
                  <li>支持中文和英文对话</li>
                  <li>可调整模型参数</li>
                  <li>支持多轮上下文对话</li>
                </ul>
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* AI 聊天组件 */}
      <AIChatWithGraphQL />
    </div>
  );
}

export default App;