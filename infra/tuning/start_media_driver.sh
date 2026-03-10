#!/bin/bash
# Start Aeron Media Driver with production settings for low-latency trading.
# Requires: Java 11+, aeron-all.jar in the same directory or AERON_JAR env var.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AERON_JAR="${AERON_JAR:-${SCRIPT_DIR}/aeron-all.jar}"
AERON_DIR="${AERON_DIR:-/dev/shm/aeron-mach-zero}"
CONFIG="${SCRIPT_DIR}/aeron_config.properties"

# CPU core for the media driver (adjust for your topology)
DRIVER_CPU="${DRIVER_CPU:-0}"

if [ ! -f "$AERON_JAR" ]; then
    echo "ERROR: aeron-all.jar not found at $AERON_JAR"
    echo "Download from: https://repo1.maven.org/maven2/io/aeron/aeron-all/"
    exit 1
fi

# Clean up previous shared memory
rm -rf "$AERON_DIR" 2>/dev/null || true

echo "Starting Aeron Media Driver..."
echo "  Config: $CONFIG"
echo "  Aeron dir: $AERON_DIR"
echo "  CPU core: $DRIVER_CPU"

# Set JVM options for low latency
JAVA_OPTS=(
    -server
    -XX:+UseG1GC
    -XX:MaxGCPauseMillis=1
    -XX:+UnlockExperimentalVMOptions
    -XX:+UseTransparentHugePages
    -XX:+AlwaysPreTouch
    -Xms256m
    -Xmx256m
    -Daeron.dir="$AERON_DIR"
    -Daeron.threading.mode=DEDICATED
    -Daeron.conductor.idle.strategy=org.agrona.concurrent.BusySpin
    -Daeron.sender.idle.strategy=org.agrona.concurrent.BusySpin
    -Daeron.receiver.idle.strategy=org.agrona.concurrent.BusySpin
    -Daeron.pre.touch.mapped.memory=true
    -Daeron.ipc.term.buffer.length=67108864
)

# Pin to CPU core if taskset is available
if command -v taskset &> /dev/null; then
    exec taskset -c "$DRIVER_CPU" java "${JAVA_OPTS[@]}" \
        -cp "$AERON_JAR" io.aeron.driver.MediaDriver
else
    exec java "${JAVA_OPTS[@]}" \
        -cp "$AERON_JAR" io.aeron.driver.MediaDriver
fi
