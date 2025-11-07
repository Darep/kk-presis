# kk-presis

Small demo of a blue-green with UpCloud Load Balancer.

Presented at Koodiklinikka Tampere meetup 11.11.2025

## Infra

- 2+ servers with Docker and Docker Compose
- UpCloud Load Balancer

## Setup

- Servers are running "blue" and "green" containers on ports 3001 and 3002 respectively
  - see docker-compose.yml
- UpCloud Load Balancer setup:
  - two backends "blue" and "green"
    - "blue" backend points to port :3001 on the attached nodes
    - "green" backend points to port :3002 on the attached nodes
  - frontend rule routes traffic according to hostname
    - "live.ajk.fi" points to the backend which is set as the current live color e.g. "blue"
    - "stage.ajk.fi" points to the backend which is set as the staging color e.g. "green"
- "deploy.sh" script to deploy new blue or green containers to the production
- "lb.js" script to switch colors
