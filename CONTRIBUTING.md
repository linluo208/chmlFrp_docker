# 贡献指南

感谢您对 ChmlFrp Docker 管理面板项目的关注！我们欢迎所有形式的贡献。

## 🤝 如何贡献

### 报告问题

如果您发现了bug或有功能建议，请：

1. 在提交前搜索现有的issues，避免重复
2. 使用issue模板提供详细信息
3. 包含复现步骤、环境信息和错误日志
4. 添加适当的标签

### 提交代码

1. **Fork项目**
   ```bash
   git clone https://github.com/your-username/chmlfrp-docker.git
   cd chmlfrp-docker
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **开发和测试**
   - 遵循现有代码风格
   - 添加必要的测试
   - 确保所有测试通过
   - 更新相关文档

4. **提交更改**
   ```bash
   git add .
   git commit -m "type(scope): description"
   git push origin feature/your-feature-name
   ```

5. **创建Pull Request**
   - 使用PR模板
   - 详细描述更改内容
   - 关联相关issues
   - 等待代码审查

## 📝 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
type(scope): description

[optional body]

[optional footer]
```

### 类型 (type)
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建工具、依赖更新等

### 示例
```
feat(tunnel): add auto-reconnect feature
fix(dns): resolve domain configuration issue
docs(readme): update installation guide
```

## 🔧 开发环境

### 环境要求
- Node.js 18+
- Docker & Docker Compose
- Git

### 本地开发
```bash
# 后端开发
cd backend && npm install && npm run dev

# 前端开发
cd frontend && npm install && npm start

# 容器开发
docker-compose up -d --build
```

## 🧪 测试

### 运行测试
```bash
# 后端测试
cd backend && npm test

# 前端测试
cd frontend && npm test

# 集成测试
docker-compose build
./verify-deployment.ps1
```

### 测试要求
- 新功能必须包含单元测试
- 修复的bug需要添加回归测试
- 保持测试覆盖率不下降

## 📋 代码风格

### JavaScript/React
- 使用ES6+语法
- 函数组件优于类组件
- 使用Hooks管理状态
- 遵循Ant Design设计规范

### 命名规范
- 组件：PascalCase (`TunnelManagement`)
- 变量/函数：camelCase (`getUserInfo`)
- 常量：UPPER_SNAKE_CASE (`API_BASE_URL`)
- 文件：kebab-case (`tunnel-management.js`)

### 示例代码
```javascript
// React组件
const TunnelManagement = () => {
    const [tunnels, setTunnels] = useState([]);
    
    const loadTunnels = useCallback(async () => {
        try {
            const response = await api.getTunnels();
            setTunnels(response.data);
        } catch (error) {
            message.error('加载隧道失败');
        }
    }, []);
    
    return (
        <Card title="隧道管理">
            {/* 组件内容 */}
        </Card>
    );
};
```

## 📚 文档

### 文档更新
- API变更需要更新文档
- 新功能需要添加使用说明
- 保持中英文文档同步

### 文档结构
```
docs/
├── README.md          # 项目介绍和快速开始
├── DEVELOPMENT.md     # 开发者指南
├── CONTRIBUTING.md    # 贡献指南
└── LICENSE           # 开源协议
```

## 🏷️ 发布流程

### 版本号规范
遵循 [Semantic Versioning](https://semver.org/)：
- `MAJOR.MINOR.PATCH`
- MAJOR: 不兼容的API更改
- MINOR: 向后兼容的功能添加
- PATCH: 向后兼容的bug修复

### 发布清单
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] CHANGELOG已更新
- [ ] 版本号已更新
- [ ] Docker镜像已构建
- [ ] Release notes已准备

## 🐛 问题处理

### Bug报告模板
```markdown
**问题描述**
简洁清楚地描述问题

**复现步骤**
1. 进入 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

**期望行为**
描述期望发生的情况

**实际行为**
描述实际发生的情况

**环境信息**
- 操作系统: [e.g. Windows 11]
- 浏览器: [e.g. Chrome 91]
- Docker版本: [e.g. 20.10.7]
- 项目版本: [e.g. 1.2.0]

**附加信息**
其他有助于问题定位的信息
```

### 功能请求模板
```markdown
**功能描述**
描述您希望添加的功能

**问题背景**
说明这个功能解决什么问题

**解决方案**
描述您期望的解决方案

**替代方案**
描述您考虑过的其他解决方案

**附加信息**
其他相关信息或截图
```

## 💡 最佳实践

### 代码质量
- 编写自文档化的代码
- 添加有意义的注释
- 保持函数和组件简洁
- 使用TypeScript（推荐）

### 性能优化
- 避免不必要的重渲染
- 使用React.memo和useMemo
- 优化API请求
- 实现适当的缓存

### 安全考虑
- 验证所有用户输入
- 使用HTTPS
- 妥善处理敏感信息
- 定期更新依赖

## 🎯 发展路线

### 短期目标
- [ ] 完善单元测试覆盖
- [ ] 优化用户体验
- [ ] 添加国际化支持

### 中期目标
- [ ] 移动端适配
- [ ] 插件系统
- [ ] 性能监控

### 长期目标
- [ ] 微服务架构
- [ ] 云原生支持
- [ ] 企业级功能

## 💬 交流社区

- **GitHub Discussions**: 技术讨论和问答
- **Issues**: Bug报告和功能请求
- **Pull Requests**: 代码贡献

## 🙏 致谢

感谢所有为项目做出贡献的开发者！

---

## 联系方式

如有任何问题，请通过以下方式联系：

- 提交 [GitHub Issue](https://github.com/your-username/chmlfrp-docker/issues)
- 参与 [GitHub Discussions](https://github.com/your-username/chmlfrp-docker/discussions)

让我们一起打造更好的 ChmlFrp Docker 管理面板！
