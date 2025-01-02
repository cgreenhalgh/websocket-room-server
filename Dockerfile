FROM node:alpine
# currently node 23.5.0, npm 10.9.2
RUN mkdir /app
WORKDIR /app
CMD "/bin/sh"