FROM node:18-alpine
WORKDIR /usr/src/app

COPY app/ ./

RUN rm -rf node_modules package-lock.json && npm install express minimist mariadb@2.5.5

EXPOSE 8080