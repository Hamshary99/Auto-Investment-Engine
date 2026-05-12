FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY services/auth-service ./services/auth-service
COPY tsconfig.base.json ./tsconfig.base.json
RUN cd shared && npm install && npm run build
RUN cd services/auth-service && npm install && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/shared ./shared
COPY --from=build /app/services/auth-service/dist ./dist
COPY --from=build /app/services/auth-service/package.json ./package.json
COPY --from=build /app/services/auth-service/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
