# Future Self voice API — production image for Railway / Fly / Render
FROM node:22-bookworm-slim

WORKDIR /app

# ffmpeg-static ships its own binary; ca-certs for HTTPS to ElevenLabs / OpenAI
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY index.js ./
COPY lib ./lib
COPY assets ./assets
COPY public ./public

ENV NODE_ENV=production
# Railway / Fly inject PORT
ENV PORT=8787

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "index.js"]
