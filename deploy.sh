#!/bin/bash
#
# Build & deploy new containers to the nodes.
# (in real world, this would be done via CI/CD pipeline, this is just a demo)
#

set -euo pipefail

if [ -z "$1" ]; then
    echo "Usage: $0 <blue|green>"
    exit 1
fi

color=$1

# Check if the color is valid
if [ "$color" != "blue" ] && [ "$color" != "green" ]; then
    echo "Invalid color: $color"
    echo "Usage: $0 <blue|green>"
    exit 1
fi

# Make sure we aren't deploying to the live color
live_color=$(node lb.js get-color live)
if [ "$live_color" == "$color" ]; then
    echo "Cannot deploy to live color: $live_color"
    exit 1
fi

# Make sure colors aren't the same (sanity-check)
staging_color=$(node lb.js get-color stage)
if [ "$staging_color" == "$live_color" ]; then
    echo "Staging color is the same as live color: $staging_color"
    echo "Please switch the staging color to a different color manually"
    exit 1
fi

# Build the new containers
sha=$(git rev-parse --short=8 HEAD)
image=kk-presis:$sha
docker build --platform linux/amd64 --build-arg VERSION=$sha -t kk-presis:latest -t $image .

node1=app@81.27.99.65
node2=app@81.27.98.202

# Copy docker images like a savage
# echo "Saving docker image..."
docker save kk-presis:latest $image --platform linux/amd64 | gzip > $sha.tar.gz

deploy_node() {
    local node=$1
    scp $sha.tar.gz $node:$sha.tar.gz
    ssh $node "docker load < $sha.tar.gz"
    ssh $node "rm $sha.tar.gz"
    scp docker-compose.prod.yml $node:docker-compose.yml
}

pids=""
for node in $node1 $node2; do
    echo "Deploying to $node..."
    deploy_node $node &
    pids="$pids $!"
done
for pid in $pids; do
    wait $pid || exit 1
done

# Deploy the new containers to the nodes
ssh $node1 "IMAGE=$image docker compose up -d $color"
ssh $node2 "IMAGE=$image docker compose up -d $color"

echo "DONE! Now switch the colors with: ./lb.js switch live stage"
