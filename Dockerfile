FROM node:23.10-alpine3.21

WORKDIR /app

COPY migrations/ migrations/
COPY src/ src/
COPY package*.json ./
COPY .env ./

RUN apk add --no-cache python3 py3-pip make g++
RUN npm ci --omit=dev

CMD ["node", "src/main.js"]

