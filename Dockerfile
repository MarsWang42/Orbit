FROM oven/bun:latest

# System deps: git, gh CLI (needed by Claude Code for PR operations)
RUN apt-get update && apt-get install -y git curl && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | tee /etc/apt/sources.list.d/github-cli.list > /dev/null && \
    apt-get update && apt-get install -y gh && \
    rm -rf /var/lib/apt/lists/*

# Claude Code CLI (official installer)
RUN curl -fsSL https://claude.ai/install.sh | bash

# Git identity for auto-commits
RUN git config --global user.name "Orbit" && \
    git config --global user.email "orbit@bot"

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD bun -e "try{await fetch('https://api.telegram.org/bot'+process.env.BOT_TOKEN+'/getMe');process.exit(0)}catch{process.exit(1)}"

CMD ["bun", "run", "src/index.ts"]
