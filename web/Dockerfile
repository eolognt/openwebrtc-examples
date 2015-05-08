FROM ubuntu:14.04

RUN apt-get -y install git

RUN git clone https://github.com/eolognt/openwebrtc-examples.git webrtc
WORKDIR webrtc/web/

RUN apt-get -y update
RUN apt-get -y install nodejs
RUN ln -s /usr/bin/nodejs /usr/bin/node

ENTRYPOINT ["./boot.sh"]
