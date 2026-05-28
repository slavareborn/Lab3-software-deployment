FROM node:18-alpine
WORKDIR /usr/src/app

COPY app/ ./

RUN rm -rf node_modules package-lock.json && npm install express@4.18.2 minimist@1.2.8 mariadb@2.5.5

EXPOSE 8080