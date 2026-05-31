FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY services/admin-service ./services/admin-service
COPY tsconfig.base.json ./tsconfig.base.json
RUN cd shared && npm install && npm run build
RUN cd services/admin-service && npm install && npm run build

FROM node:20-alpine
WORKDIR /app/services/admin-service
ENV NODE_ENV=production
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/admin-service/dist ./dist
COPY --from=build /app/services/admin-service/package.json ./package.json
COPY --from=build /app/services/admin-service/node_modules ./node_modules
EXPOSE 3004
CMD ["node", "dist/index.js"]
