# 无伴奏合唱编曲器

这是一个基于AI的工具，可以将单一乐谱转换为多声部的无伴奏合唱编曲。

## 功能特点

- 支持上传 MuseScore (.mscz), MusicXML (.musicxml, .xml), 和 MIDI (.mid, .midi) 格式的乐谱文件
- 可选择2到5个声部进行编曲
- 提供古典、爵士和流行三种编曲风格
- 支持原始乐谱和编曲结果的在线播放

## 项目结构

```
acapella-arranger/
│
├── templates/
│   └── index.html
├── static/
│   ├── app.js
│   └── styles.css
├── app.py
├── ai_arranger.py
├── create_model.py
├── Dockerfile
├── pyproject.toml
└── README.md
```

## 安装要求

- Python 3.9+
- Docker
- Poetry

## 安装步骤

1. 克隆此仓库:
   ```
   git clone https://github.com/yourusername/acapella-arranger.git
   cd acapella-arranger
   ```

2. 使用 Poetry 安装依赖:
   ```
   poetry install
   ```

3. 创建 AI 模型文件:
   ```
   poetry run python create_model.py
   ```

## 运行应用

### 开发模式

1. 设置环境变量：
   ```
   export FLASK_APP=app.py
   export FLASK_ENV=development
   ```

2. 运行应用：
   ```
   poetry run python app.py
   ```

3. 访问 `http://localhost:5002`

### 使用 Docker

1. 构建 Docker 镜像:
   ```
   docker build -t acapella-arranger .
   ```

2. 运行 Docker 容器:
   ```
   docker run -p 5002:5002 acapella-arranger
   ```

3. 在浏览器中访问 `http://localhost:5002`

## 开发模式

对于开发和调试，您可以直接运行 Flask 应用：

1. 设置环境变量：
   ```
   export FLASK_APP=app.py
   export FLASK_ENV=development
   export FLASK_RUN_PORT=5002
   ```

2. 运行应用：
   ```
   poetry run flask run
   ```

3. 访问 `http://localhost:5002`

## 故障排除

如果遇到问题，请检查以下几点：

1. 确保已安装所有必要的依赖：
   ```
   poetry install
   ```

2. 检查 `acapella_model.h5` 文件是否存在于项目根目录。如果不存在，运行：
   ```
   poetry run python create_model.py
   ```

3. 确保 Docker 守护进程正在运行。

4. 检查 Docker 日志以获取更多信息：
   ```
   docker logs <container_id>
   ```

5. 如果遇到权限问题，可能需要使用 `sudo` 运行 Docker 命令。

## 注意事项

- 本工具仅用于处理您自己创作的原创乐谱
- 当前的 AI 模型是一个简单的占位符，不能进行实际的编曲。要实现真正的编曲功能，需要开发一个更复杂的模型。

## 贡献

欢迎提交问题和拉取请求。对于重大更改，请先开 issue 讨论您想要改变的内容。

## 许可证

[MIT](https://choosealicense.com/licenses/mit/)