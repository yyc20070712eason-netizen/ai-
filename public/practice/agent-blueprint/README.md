# 订单查询与退款 Agent 设计包

这是 Agent 章五个单元共同使用的本地练习目录。案例中的订单、用户和退款均为虚构数据；不要填入真实姓名、订单、地址、凭据或 API Key。

## 使用方法

1. 在学习工作台中按关卡修改对应 Markdown 或 JSON 文件。
2. 在每个单元最后一关运行该关给出的测试命令。
3. 将产物内容、量表证据和测试摘要主动粘贴回学习工作台。
4. 首次正式提交后再查看工作台中的参考结构。

## 验证命令

```powershell
node --test --test-name-pattern="milestone 1"
node --test --test-name-pattern="milestone 2"
node --test --test-name-pattern="milestone 3"
node --test --test-name-pattern="milestone 4"
npm test
```

测试只读取本目录文件，使用 Node.js 内置模块，不安装第三方依赖，也不访问网络。
