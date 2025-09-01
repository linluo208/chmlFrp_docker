# ChmlFrp Docker 部署验证脚本
# 验证所有服务是否正常运行

Write-Host "🚀 ChmlFrp Docker 部署验证开始..." -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Cyan

# 1. 检查Docker服务状态
Write-Host "`n📋 1. 检查Docker服务状态" -ForegroundColor Yellow
$services = docker-compose ps --format "table {{.Service}}\t{{.State}}\t{{.Ports}}"
Write-Host $services

# 2. 验证前端界面
Write-Host "`n🌐 2. 验证前端界面" -ForegroundColor Yellow
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:8888" -Method Head -TimeoutSec 10
    Write-Host "✅ 前端界面正常 (状态码: $($frontendResponse.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "❌ 前端界面异常: $($_.Exception.Message)" -ForegroundColor Red
}

# 3. 验证后端API
Write-Host "`n🔧 3. 验证后端API服务" -ForegroundColor Yellow
try {
    $apiResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -Method Get -TimeoutSec 10
    $apiData = $apiResponse.Content | ConvertFrom-Json
    Write-Host "✅ 后端API正常 (版本: $($apiData.data.version), 运行时间: $([math]::Round($apiData.data.uptime, 2))秒)" -ForegroundColor Green
} catch {
    Write-Host "❌ 后端API异常: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. 验证FRP状态接口
Write-Host "`n⚙️ 4. 验证FRP管理接口" -ForegroundColor Yellow
try {
    $frpResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/frp/status" -Method Get -TimeoutSec 10
    $frpData = $frpResponse.Content | ConvertFrom-Json
    if ($frpData.code -eq 200) {
        Write-Host "✅ FRP管理接口正常" -ForegroundColor Green
        Write-Host "   - FRP客户端状态: $(if($frpData.data.isRunning) {'运行中'} else {'未运行'})"
        Write-Host "   - 配置文件路径: $($frpData.data.configPath)"
    } else {
        Write-Host "⚠️ FRP接口返回错误: $($frpData.msg)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ FRP管理接口异常: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. 验证FRP服务器接口
Write-Host "`n🏢 5. 验证FRP服务器接口" -ForegroundColor Yellow
try {
    $serverResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/frp/server/status" -Method Get -TimeoutSec 10
    $serverData = $serverResponse.Content | ConvertFrom-Json
    if ($serverData.code -eq 200) {
        Write-Host "✅ FRP服务器接口正常" -ForegroundColor Green
        Write-Host "   - 服务器状态: $(if($serverData.data.isRunning) {'运行中'} else {'未运行'})"
        Write-Host "   - 绑定端口: $($serverData.data.bindPort)"
        Write-Host "   - 管理端口: $($serverData.data.dashboardPort)"
    } else {
        Write-Host "⚠️ FRP服务器接口返回错误: $($serverData.msg)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ FRP服务器接口异常: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. 检查端口监听状态
Write-Host "`n🔌 6. 检查端口监听状态" -ForegroundColor Yellow
$ports = @(80, 3001, 7000, 7400, 7500)
foreach ($port in $ports) {
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $port -WarningAction SilentlyContinue
        if ($connection.TcpTestSucceeded) {
            Write-Host "✅ 端口 $port 正常监听" -ForegroundColor Green
        } else {
            Write-Host "❌ 端口 $port 无法连接" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ 端口 $port 检查失败" -ForegroundColor Red
    }
}

# 7. 检查Docker资源使用
Write-Host "`n📊 7. Docker资源使用情况" -ForegroundColor Yellow
$stats = docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
Write-Host $stats

# 8. 显示访问信息
Write-Host "`n🎯 8. 访问信息" -ForegroundColor Yellow
Write-Host "✨ 主要访问地址:" -ForegroundColor Cyan
Write-Host "   🌐 管理界面:        http://localhost:8888" -ForegroundColor White
Write-Host "   🔧 API接口:         http://localhost:3001" -ForegroundColor White
Write-Host "   📊 FRP服务器控制台: http://localhost:7500" -ForegroundColor White
Write-Host "   📋 API文档:         http://localhost:3001/api/health" -ForegroundColor White

# 9. 快速功能测试建议
Write-Host "`n🧪 9. 快速功能测试建议" -ForegroundColor Yellow
Write-Host "1️⃣ 打开管理界面: http://localhost:8888" -ForegroundColor White
Write-Host "2️⃣ 使用 ChmlFrp 账户登录" -ForegroundColor White
Write-Host "3️⃣ 进入'隧道管理'创建测试隧道" -ForegroundColor White
Write-Host "4️⃣ 进入'内网穿透'启动FRP客户端" -ForegroundColor White
Write-Host "5️⃣ 查看'流量监控'验证数据统计" -ForegroundColor White

# 10. 故障排除提示
Write-Host "`n🔧 10. 故障排除提示" -ForegroundColor Yellow
Write-Host "如果遇到问题，请检查:" -ForegroundColor White
Write-Host "   📖 查看故障排除指南: cat TROUBLESHOOTING.md" -ForegroundColor White
Write-Host "   📝 查看服务日志: docker-compose logs backend" -ForegroundColor White
Write-Host "   🔄 重启服务: docker-compose restart" -ForegroundColor White
Write-Host "   🆘 完全重建: docker-compose down && docker-compose up -d --build" -ForegroundColor White

Write-Host "`n=======================================" -ForegroundColor Cyan
Write-Host "🎉 部署验证完成!" -ForegroundColor Green
Write-Host "如果所有检查都通过，您的ChmlFrp Docker系统已准备就绪！" -ForegroundColor Green
