FROM jrottenberg/ffmpeg:4.4-alpine

# Install bash for script execution
RUN apk add --no-cache bash

WORKDIR /app

COPY process_video.sh .
RUN chmod +x process_video.sh

ENTRYPOINT ["bash"]
CMD ["/app/process_video.sh"]