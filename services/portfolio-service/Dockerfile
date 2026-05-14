FROM node:20-alpine AS build
WORKDIR /app
COPY shared ./shared
COPY services/portfolio-service ./services/portfolio-service
COPY tsconfig.base.json ./tsconfig.base.json
RUN cd shared && npm install && npm run build
RUN cd services/portfolio-service && npm install && npm run build

FROM node:20-alpine
WORKDIR /app/services/portfolio-service
ENV NODE_ENV=production
COPY --from=build /app/shared /app/shared
COPY --from=build /app/services/portfolio-service/dist ./dist
COPY --from=build /app/services/portfolio-service/package.json ./package.json
COPY --from=build /app/services/portfolio-service/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/index.js"]
