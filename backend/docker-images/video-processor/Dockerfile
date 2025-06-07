FROM jrottenberg/ffmpeg:4.4-alpine

RUN apk add --no-cache bash

WORKDIR /app

COPY process_video.sh .
RUN chmod +x process_video.sh

CMD ["./process_video.sh"]