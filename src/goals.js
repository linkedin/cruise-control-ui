// Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information.
export default {
  goals: [
    {
      'goal': 'RackAwareGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'Ensures that all replicas of each partition are assigned in a rack aware manner -- i.e. no more than one replica of each partition resides in the same rack.'
    },
    {
      'goal': 'RackAwareDistributionGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'A relaxed version of RackAwareGoal to use in clusters with partitions whose replication factor > number of racks.'
    },
    {
      'goal': 'ReplicaCapacityGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'Ensures that the maximum number of replicas per broker is under the specified maximum limit.'
    },
    {
      'goal': 'CpuCapacityGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'Ensures that CPU utilization of each broker is below a given threshold.'
    },
    {
      'goal': 'DiskCapacityGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'Ensures that Disk space usage of each broker is below a given threshold.'
    },
    {
      'goal': 'NetworkInboundCapacityGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'Ensures that inbound network utilization of each broker is below a given threshold.'
    },
    {
      'goal': 'NetworkOutboundCapacityGoal',
      'hardGoal': true,
      'group': 1,
      'description': 'Ensures that outbound network utilization of each broker is below a given threshold.'
    },
    {
      'goal': 'PotentialNwOutGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Ensures that the potential network output (when all the replicas in the broker become leaders) on each of the broker do not exceed the broker\'s network outbound bandwidth capacity.'
    },
    {
      'goal': 'CpuUsageDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to keep the CPU usage variance among brokers within a certain range relative to the average CPU utilization.'
    },
    {
      'goal': 'DiskUsageDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to keep the Disk space usage variance among brokers within a certain range relative to the average Disk utilization.'
    },
    {
      'goal': 'NetworkInboundUsageDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to keep the inbound network utilization variance among brokers within a certain range relative to the average inbound network utilization.'
    },
    {
      'goal': 'NetworkOutboundUsageDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to keep the outbound network utilization variance among brokers within a certain range relative to the average outbound network utilization.'
    },
    {
      'goal': 'LeaderBytesInDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to equalize the leader bytes in rate on each host.'
    },
    {
      'goal': 'LeaderReplicaDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to maintain an even distribution of any topic\'s leader replicas across the entire cluster.'
    },
    {
      'goal': 'TopicReplicaDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to maintain an even distribution of any topic\'s replicas across the entire cluster.'
    },
    {
      'goal': 'ReplicaDistributionGoal',
      'hardGoal': false,
      'group': 1,
      'description': 'Attempts to make all the brokers in a cluster have a similar number of replicas.'
    },
    {
      'goal': 'PreferredLeaderElectionGoal',
      'hardGoal': false,
      'group': 1,
      'skip': true,
      'description': 'Simply move the leaders to the first replica of each partition.'
    },
    {
      'goal': 'KafkaAssignerDiskUsageDistributionGoal',
      'hardGoal': false,
      'group': 2,
      'description': '(Kafka-assigner mode) Attempts to distribute disk usage evenly among brokers based on swap.'
    },
    {
      'goal': 'KafkaAssignerEvenRackAwareGoal',
      'hardGoal': false,
      'group': 2,
      'description': '(Kafka-assigner mode) Attempts to achieve rack aware even replica distribution.'
    }
  ]
}
