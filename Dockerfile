FROM docker.io/node:21-slim

WORKDIR /app
COPY ./app ./
COPY package.json ./

#From https://stackoverflow.com/questions/70900008/selenium-py-process-unexpectedly-closed-with-status-255
    RUN apt-get update -y \
    && apt-get install --no-install-recommends --no-install-suggests -y tzdata ca-certificates bzip2 curl wget libc-dev libxt6 \
    && apt-get install --no-install-recommends --no-install-suggests -y `apt-cache depends firefox-esr | awk '/Depends:/{print$2}'` \
    && update-ca-certificates \
# Cleanup unnecessary stuff
    && apt-get purge -y --auto-remove \
                  -o APT::AutoRemove::RecommendsImportant=false \
    && rm -rf /var/lib/apt/lists/* /tmp/*

# install geckodriver

    RUN wget https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz && \
        tar -zxf geckodriver-v0.34.0-linux64.tar.gz -C /usr/local/bin && \
        chmod +x /usr/local/bin/geckodriver && \
        rm geckodriver-v0.34.0-linux64.tar.gz

# install firefox

    RUN FIREFOX_SETUP=firefox-setup.tar.bz2 && \
        wget -O $FIREFOX_SETUP "https://download.mozilla.org/?product=firefox-122.0.1&os=linux64" && \
        tar xjf $FIREFOX_SETUP -C /opt/ && \
        ln -s /opt/firefox/firefox /usr/bin/firefox && \
        rm $FIREFOX_SETUP

RUN npm install

ENV PORT=5050

ENTRYPOINT node app.js