FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY services/scheduler-service ./services/scheduler-service
COPY tsconfig.base.json ./tsconfig.base.json
RUN cd shared && npm install && npm run build
RUN cd services/scheduler-service && npm install && npm run build

FROM node:20-alpine
WORKDIR /app/services/scheduler-service
ENV NODE_ENV=production
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/scheduler-service/dist ./dist
COPY --from=build /app/services/scheduler-service/package.json ./package.json
COPY --from=build /app/services/scheduler-service/node_modules ./node_modules
CMD ["node", "dist/index.js"]
