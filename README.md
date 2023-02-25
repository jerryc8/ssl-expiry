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
Creating network "eco-interview_testenv" with the default driver
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
Removing network eco-interview_testenv
```

### Things to test
One way to test is to use curl to access SSL/TLS on a different container within the `testenv` network:
```
$ docker exec -it europa-10.10.6.60 /bin/bash
root@296c75372f7d:/# curl -k https://callisto-10.10.8.164 -vI --stderr - | grep "date"
*  start date: Feb 25 09:10:15 2023 GMT
*  expire date: Mar 26 09:10:15 2023 GMT
```

## Missing work
- to provide more instructions about how to use the `node` container (inside `testenv` network) to run the script
- not sure how to create self signed certificates that has a start date or end date in the past?
