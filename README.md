# ssl-expiry

## Overview
Given a list of servers ip addresses , the nodejs script at `src/app.js` checks the start and end dates of the SSL/TLS certificates for those servers.  Anomalies are reported to:
- statsd as a guage
- slack channel via webhook

## How to Run (without slack)
The `SLACK_WEBHOOK_URL` in this source tree is likely incorrect, hence to run without slack:
1. make sure the machine where script runs is the jumphost, and `ip_addresses.txt` file contains the correct IP addresses
2. `npm install`
3. `DISABLE_SLACK=true npm start`
(OR `DISABLE_SLACK=true node src/app.js`)

## How to Run (with slack)
1. make sure the machine where script runs is the jumphost, and `ip_addresses.txt` file contains the correct IP addresses
2. `npm install`
3. make sure the `SLACK_WEBHOOK_URL` value is correct in the file `src/app.js`
4. `npm start`
(OR `node src/app.js`)

## Test Environment
- The `docker-compose.yml` can be used to create a test environment with nginx servers that will handshake with self signed certificates for testing
- Use `scripts/create-selfsigned-certs.sh` to generate more self-signed certificates and private keys
- Use `scripts/create-compose-fragment.sh` to generate more containers to put into `docker-compose.yml`

### Using docker-compose
To start the Test Environment on a machine with docker and docker-compose installed:
```
$ docker-compose up -d
Creating network "ssl-expiry_testenv" with the default driver
Creating callisto-10.10.8.164 ... done
Creating europa-10.10.6.60    ... done
Creating statsd               ... done
Creating europa-10.10.6.64    ... done
Creating ssl-expiry           ... done
```

And to shutdown:
```
$ docker-compose down
Stopping callisto-10.10.8.164 ... done
Stopping europa-10.10.6.60    ... done
Stopping statsd               ... done
Stopping europa-10.10.6.64    ... done
Removing callisto-10.10.8.164 ... done
Removing europa-10.10.6.60    ... done
Removing statsd               ... done
Removing ssl-expiry           ... done
Removing europa-10.10.6.64    ... done
Removing network ssl-expiry_testenv
```

### Things to test
One way to test is to use curl to access SSL/TLS on a different container within the `testenv` network:
```
$ docker exec -it europa-10.10.6.60 /bin/bash
root@296c75372f7d:/# curl -k https://callisto-10.10.8.164 -vI --stderr - | grep "date"
*  start date: Feb 25 09:10:15 2023 GMT
*  expire date: Mar 26 09:10:15 2023 GMT
```

## Missing work / Possible future work
- to provide more instructions about how to use the `node` container (inside `testenv` network) to run the script
- not sure how to create self signed certificates that has a start date or end date in the past? (a hacky way would be to change the system date then run `openssl`, but that would be difficult to automate)
- use a logger such as ​`Morgan` or Winston​, so it can be integrated more easily with external tools such as datadog
- performance: batch the server checks into batches of size N, and test N servers in parallel at a time (current script performs the server checks serially, one check at a time)

## Questions and answers
### How would you ensure the script itself is running correctly?
answer: there are two possibilities:
add a statsd metric with the time the script was last run.  Then another script can be used to check that the timestamp is kept up-to-date.  This script should NOT run on the jumphost though
if the jumphost runs 24/7, this nodejs can be made into an express app exposing a simple HTTP health check, and a monitoring software such as Datadog or Kubernetes health check can periodically do an HTTP GET on this endpoint

### How would you configure this script to run every `x` days assuming it was being executed on the jumphost?
answer: assuming jumphost execution and assuming that the jumphost runs 24/7, I would set up this script as a cronjob and update the crontab​ file so it will run at scheduled time
Alternatively, the app can be turned into a "web server" or daemon with a health check endpoint.  If that is done, then there would be an infinite loop inside the code that schedules the check to run periodically
If we don't run it on a jumphost, we can also use a container orchestrator to run it as a cron job.  For example, Kubernetes supports the notion of a cronjob that can be set up using kubectl​ command

# Notes about language choice
Language choice: Chose NodeJS but my second choice would have been a simple shell script (`/bin/sh` or /bin/bash​)

## Pros and Cons of Choosing NodeJS
- pro: if the company is using NodeJS elsewhere, also, NodeJS has a well supported eco system so it's easy to find libraries such as ones for aws and other items
- pro: it happens that the original Etsy implementation of statsd was also using nodejs anyway
- con: need to install node and js packages into the jumphost

## Pros and Cons of Choosing Bash
- pro: no need to install node on the jumphost
- con: harder to switch to a parallel model if we want to speed up script performance for large number of servers
- con: StatsD client implementation probably will be done using just nc​ commands
- con: code for getting certificate info will be done using just openssl​ and grep​ commands
- con: no type safety (use of Typescript in nodejs will provide type safety)

### Other possibilites
- it is also possible to use Python to write this script: it has good statsd client, good date handling and many libraries
