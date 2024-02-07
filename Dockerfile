FROM docker.io/node:20.11.0-slim

WORKDIR /app
COPY ./app ./
COPY package.json ./
RUN ls -al
RUN ls / -al


RUN npm install

ENV PORT=5050

ENTRYPOINT node app.js