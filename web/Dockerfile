FROM node:22-alpine
WORKDIR /app
COPY --chown=root:root package.json server.mjs ./
COPY --chown=root:root lib ./lib
COPY --chown=root:root public ./public
# code is read-only to the app user; only /data is writable
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8080 DATA_DIR=/data
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--max-old-space-size=512", "server.mjs"]
