FROM node:20-alpine

# Install build tools for native modules like bcrypt
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

USER appuser

CMD ["npm", "start"]
