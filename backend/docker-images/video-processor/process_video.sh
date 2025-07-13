#!/bin/bash
# process_video.sh
set -e # Exit on any error

echo "=== Video Processing Script Started ==="
echo "Script location: $(pwd)"
echo "Script being run by: $0"
echo "All arguments: $@"

# Check if required environment variables are set
echo "=== Environment Variables ==="
echo "INPUT_FILE: ${INPUT_FILE:-NOT_SET}"
echo "OUTPUT_FILE: ${OUTPUT_FILE:-NOT_SET}"
echo "START_TIME: ${START_TIME:-NOT_SET}"
echo "DURATION: ${DURATION:-NOT_SET}"
echo "END_TIME: ${END_TIME:-NOT_SET}"

if [ -z "$INPUT_FILE" ] || [ -z "$OUTPUT_FILE" ]; then
  echo "Error: INPUT_FILE and OUTPUT_FILE environment variables must be set"
  exit 1
fi

# Check directory contents
echo "=== Directory Contents ==="
echo "Current directory: $(pwd)"
echo "Input directory (/input):"
ls -la /input/ || echo "Cannot list /input directory"
echo "Output directory (/output):"
ls -la /output/ || echo "Cannot list /output directory"

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
  echo "Error: Input file $INPUT_FILE does not exist"
  echo "Available files in input directory:"
  ls -la /input/
  exit 1
fi

echo "=== File Information ==="
echo "Input file exists: $INPUT_FILE"
echo "Input file size: $(stat -c%s "$INPUT_FILE" 2>/dev/null || echo "unknown")"
echo "Output directory writable: $(test -w /output && echo "yes" || echo "no")"

# Verify FFmpeg is available
echo "=== FFmpeg Check ==="
which ffmpeg || { echo "FFmpeg not found in PATH"; exit 1; }
ffmpeg -version | head -1

# Build FFmpeg command
FFMPEG_CMD=("ffmpeg" "-y" "-i" "$INPUT_FILE")

# Add start time if specified
if [ -n "$START_TIME" ] && [ "$START_TIME" != "NOT_SET" ] && [ "$START_TIME" != "" ]; then
  echo "Adding start time: $START_TIME"
  FFMPEG_CMD+=("-ss" "$START_TIME")
fi

# Add duration or end time
if [ -n "$DURATION" ] && [ "$DURATION" != "NOT_SET" ] && [ "$DURATION" != "" ]; then
  echo "Adding duration: $DURATION"
  FFMPEG_CMD+=("-t" "$DURATION")
elif [ -n "$END_TIME" ] && [ "$END_TIME" != "NOT_SET" ] && [ "$END_TIME" != "" ]; then
  echo "Adding end time: $END_TIME"
  FFMPEG_CMD+=("-to" "$END_TIME")
fi

# Add output options
FFMPEG_CMD+=("-c" "copy" "-avoid_negative_ts" "make_zero" "$OUTPUT_FILE")

echo "=== Executing FFmpeg Command ==="
echo "Command: ${FFMPEG_CMD[*]}"

# Execute the command
"${FFMPEG_CMD[@]}"
FFMPEG_EXIT_CODE=$?

echo "=== Command Results ==="
echo "FFmpeg exit code: $FFMPEG_EXIT_CODE"

if [ $FFMPEG_EXIT_CODE -eq 0 ]; then
  echo "Video processing completed successfully!"
  echo "Output file: $OUTPUT_FILE"
  if [ -f "$OUTPUT_FILE" ]; then
    echo "Output file size: $(stat -c%s "$OUTPUT_FILE" 2>/dev/null || echo "unknown")"
    ls -la "$OUTPUT_FILE"
  else
    echo "Warning: Output file was not created"
    exit 1
  fi
else
  echo "Video processing failed with exit code: $FFMPEG_EXIT_CODE"
  exit $FFMPEG_EXIT_CODE
fi

echo "=== Script Completed Successfully ==="