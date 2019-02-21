<p align="center">
  <img alt="Cruise Control Frontend" src="images/cc-logo.png">
</p>

Introduction
============

Frontend for Kafka Cruise Control. Provides a central dashboard to manage all Kafka deployments in an organization.

These are some of the features of the application:

1. Kafka Cluster Status
2. Kafka Cluster Load
3. Kafka Partition Load
4. Cruise Control State
5. Cruise Control Tasks
6. Kafka Cluster Administration
7. Cruise Control Proposals
8. Cruise Control Tasks
9. Preferences

In addition to these there is support for these common features

1. Running actions in Dry Run (Safe Mode) by default.
2. All Cruise Control REST API parameters are exposed as Input controls.
3. Safe Default values are provided to execute the actions as fast as possible.
4. Understand the Async Response from Cruise Control and render the progress.
5. Display URLs of the End points for every action.
6. Display Full Stack Trace responses from Cruise Control instead of shorter ones.
7. Customizable Look & Feel via theming


Requirements
============

You'll need latest & greatest version of [node.js](https://nodejs.org/en/) to build the software.

Libraries Used
==============

This project uses the following external [libraries](LIBRARIES.md).


Configuration File
==================

In order to successfully use this application you should have at-least one Cruise Control deployed in your environment and the details are added to `static/config.csv` file. For large installations, you can add all the end point details in this configuration file.

## Format of config.csv

`config.csv` is a CSV file with three columns separated by commas

  - First column: `Logical Group Name` (Examples: `dev`, `staging`, `production`, `us-east-1b`)
  - Second column: `Cruise control Instance Name` (Examples: `finance`, `logging`, `billing`)
  - Third column: URL (Both relative & absolute) path to the cruise control instances (Examples: `/kafkacruisecontrol/`, `http://protected.example.com:9000/kafkacruisecontrol`)

Download
========

You can download the software using the following steps.

```
git clone https://github.com/linkedin/cruise-control-ui
```

Build
=====

Assuming you already have `node` & `npm` installed. Running these commands will build the CCFE from git repository and places the artifacts in the `dist/` directory. You can place the artifacts in any standalone webserver like Apache, nginx or Cruise Control server.

```
 git clone https://github.com/linkedin/cruise-control-ui
 cd cruise-control-ui
 npm install
 npm build
```

Running App Locally (Standalone Mode)
====================================

This mode is helpful when we want to try out the frontend on our local laptop/desktop. In order to connect to an actual Cruise Control instance, please add necessary details to `static/config.csv` file.

Running these commands will start a webserver on port 8090.

```
  npm install
  npm run dev
```

Running Application Within Cruise Control (Embedded Mode)
=========================================================

This mode is helpful when we want to make the frontend as an admin interface to a running cruise control instance.


1. Download the cruise-control software

```
  git clone https://github.com/linkedin/cruise-control cruise-control.git
```

2. Checkout the cruise-control-ui software

```
  cd cruise-control.git
  git clone https://github.com/linkedin/cruise-control-ui
```

3. Build the cruise-control as you normally do

As defined in https://github.com/linkedin/cruise-control

4. Build the cruise-control-ui for production

```
  cd cruise-control-ui
  npm install
  npm run build
```

NOTE: As part of build process `static/config.csv` is copied to `dist/static/config.csv`. 

5. Make config changes to `config.csv` so that the UI will start talking to local cruise-control first

Add this line to `dist/static/config.csv` (post build) and `static/config.csv` (pre build)

```
local,localhost,/kafkacruisecontrol
```

6. Start the cruise-control

After the build is successful, running this command starts the cruise control on selected port#.

```
cd cruise-control && ./kafka-cruise-control-start.sh ./config/server.properties [port#]
```

Hitting http://$host:$port/ will show the cruise control frontend interface.

Application Screens
===================

Following are the screenshots for the application when started for the first time with a kafka cluster running 3 brokers on a single server.

- [Kafka Cluster Status](images/01-kafka-cluster-status.png)
- [Kafka Cluster Load](images/02-kafka-cluster-load.png)
- [Kafka Administration](images/03-admin.png)
- [Kafka Cluster Rebalance - Advanced](images/03-admin-1.png)
- [UI Preferences](images/04-preferences.png)
- [Cruise Control Tasks](images/05-tasks.png)
- [Cruise Control State](images/06-cc-state.png)

License
=======

Released under [BSD 2-CLAUSE LICENSE](LICENSE.md) File.

Contributions
=============

Contributions are welcome as per [this document](CONTRIBUTING.md).
