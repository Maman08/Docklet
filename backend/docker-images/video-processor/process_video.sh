#!/bin/bash

INPUT_FILE=${INPUT_FILE}
OUTPUT_FILE=${OUTPUT_FILE}
START_TIME=${START_TIME:-"00:00:00"}
DURATION=${DURATION}
END_TIME=${END_TIME}

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
    echo "Error: INPUT_FILE and OUTPUT_FILE must be specified"
    exit 1
fi

FFMPEG_CMD="ffmpeg -i $INPUT_FILE"

if [ "$START_TIME" != "00:00:00" ]; then
    FFMPEG_CMD="$FFMPEG_CMD -ss $START_TIME"
fi

if [ -n "$DURATION" ]; then
    FFMPEG_CMD="$FFMPEG_CMD -t $DURATION"
elif [ -n "$END_TIME" ]; then
    FFMPEG_CMD="$FFMPEG_CMD -to $END_TIME"
fi

FFMPEG_CMD="$FFMPEG_CMD -c copy $OUTPUT_FILE -y"

echo "Executing: $FFMPEG_CMD"
eval $FFMPEG_CMD

if [ $? -eq 0 ]; then
    echo "Video trimming completed: $OUTPUT_FILE"
else
    echo "Error: Video processing failed"
    exit 1
fi