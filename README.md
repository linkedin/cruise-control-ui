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

Documenation
=============

Documentation has been moved to the [wiki](https://github.com/linkedin/cruise-control-ui/wiki).


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
