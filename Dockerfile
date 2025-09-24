# --- 阶段 1: 使用官方 Node.js 镜像作为基础 ---
# node:18-alpine 是一个轻量、安全的基础镜像
FROM node:18-alpine

# --- 阶段 2: 在集装箱内部创建工作目录 ---
# 之后的所有操作都会在这个 /app 目录里进行
WORKDIR /app

# --- 阶段 3: 复制依赖清单并安装依赖 ---
# 仅复制 package.json 和 package-lock.json。
# 这样做可以利用 Docker 的缓存机制，如果这两个文件没变，就不需要重新安装依赖，构建速度会快很多。
COPY package*.json ./
RUN npm install

# --- 阶段 4: 复制所有源代码 ---
# 将项目中的所有其他文件复制到集装箱的 /app 目录
COPY . .

# --- 阶段 5: 声明端口 ---
# 告诉 Docker，我们的应用在集装箱内部会使用 3001 端口
EXPOSE 3001

# --- 阶段 6: 定义启动命令 ---
# 当集装箱启动时，自动执行 "node server.js"
CMD ["node", "server.js"]