FROM node:20-alpine
WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/
RUN npm install && npm install --prefix server

COPY . .

ENV NODE_ENV=production
CMD ["npm", "start"]
