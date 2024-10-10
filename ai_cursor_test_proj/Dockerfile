# 使用官方Python运行时作为父镜像
FROM python:3.9-slim-buster

# 安装 poetry
RUN pip install poetry

# 设置工作目录
WORKDIR /app

# 复制 pyproject.toml 和 poetry.lock (如果存在)
COPY pyproject.toml poetry.lock* /app/

# 安装依赖
RUN poetry config virtualenvs.create false \
  && poetry install --no-interaction --no-ansi

# 复制当前目录内容到容器中的/app
COPY . /app

# 确保 templates 和 static 文件夹存在
RUN mkdir -p /app/templates /app/static

# 使端口5002可用于此容器
EXPOSE 5002

# 定义环境变量
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_RUN_PORT=5002

# 运行app.py
CMD ["poetry", "run", "flask", "run"]