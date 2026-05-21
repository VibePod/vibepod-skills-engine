FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && \
    npm prune --omit=dev

FROM node:20-bookworm-slim

ARG YQ_VERSION=v4.44.3

RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        jq \
        tar \
        unzip \
        ripgrep \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g pnpm@9 \
    && ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_${ARCH}" -o /usr/local/bin/yq \
    && chmod +x /usr/local/bin/yq \
    && mkdir -p /vibepod/local-skills /vibepod/user-skills /vibepod/cache

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

ENV VIBEPOD_LOCAL_SKILLS=/vibepod/local-skills \
    VIBEPOD_USER_SKILLS=/vibepod/user-skills \
    VIBEPOD_CACHE=/vibepod/cache

ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["--help"]
