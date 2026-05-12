FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY services/app-service ./services/app-service
COPY tsconfig.base.json ./tsconfig.base.json
RUN cd shared && npm install && npm run build
RUN cd services/app-service && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/shared ./shared
COPY --from=build /app/services/app-service/dist ./dist
COPY --from=build /app/services/app-service/package.json ./package.json
COPY --from=build /app/services/app-service/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/index.js"]
