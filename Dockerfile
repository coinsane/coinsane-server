FROM node:alpine

ENV APP_DIR /app

RUN mkdir -p $APP_DIR
WORKDIR $APP_DIR
ADD . $APP_DIR/

RUN yarn install

EXPOSE 80

CMD ["yarn", "start"]
