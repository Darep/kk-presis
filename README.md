# kk-presis

Small demo of a blue-green with UpCloud Load Balancer.

Presented at Koodiklinikka Tampere meetup 11.11.2025

## Infra

- 2+ servers with Docker and Docker Compose
- UpCloud Load Balancer

## Setup

1. Create 1-2 servers, install SSH keys, Docker & Docker Compose on them
   - Deploy "blue" and "green" containers on ports 3001 and 3002 on to the server(s)
2. Create an UpCloud Load Balancer via e.g. hub.upcloud.com
   - create two backends: blue and green
     - make "blue" backend point to port :3001 on the server(s) (= members)
     - make "green" backend point to port :3002 on the server(s) (= members)
   - create a frontend rule named e.g. "blue-green" or "frontend"
   - add frontend rules to the frontend:
     - match Host "live.ajk.fi" to use backend set as the current live color e.g. "blue"
     - match Host "stage.ajk.fi" to use backend set as the staging color e.g. "green"

Afterwards:

- use "deploy.sh" script to deploy new blue or green containers to the production
- use "lb.js" script to switch colors & to check the colors
- automate the deploy and "lb.js" using CI e.g. GitHub Actions or GitLab CI
