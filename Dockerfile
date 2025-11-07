FROM oven/bun:1-slim
WORKDIR /app
ARG VERSION

COPY package.json .
COPY bun.lock .
RUN bun install --frozen-lockfile --production

COPY src/ ./src/

ENV VERSION=${VERSION}
EXPOSE 8080
CMD ["bun", "run", "src/app.ts"]
