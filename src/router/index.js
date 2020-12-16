// Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information.

import Vue from 'vue'
import Router from 'vue-router'
import Page from '@/components/Page'
import Load from '@/components/Load'
import ReplicaLoad from '@/components/ReplicaLoad'
import Proposals from '@/components/Proposals'
import State from '@/components/State'
import Monitor from '@/components/Monitor'
import Executor from '@/components/Executor'
import Analyzer from '@/components/Analyzer'
import AnomalyDetector from '@/components/AnomalyDetector'
import PartitionLoad from '@/components/PartitionLoad'
import KafkaClusterState from '@/components/KafkaClusterState'
import Preferences from '@/components/Preferences'
import AdminBroker from '@/components/AdminBroker'
import AdminSampling from '@/components/AdminSampling'
import UserTasks from '@/components/UserTasks'
import ConfigInsights from '@/components/ConfigInsights'
import ResourceDistribution from '@/components/ResourceDistribution'
import PeerReview from '@/components/PeerReview'
import store from '@/store'
import Summary from '@/components/Summary'

Vue.use(Router)

export default new Router({
  linkActiveClass: '',
  linkExactActiveClass: 'active',
  routes: [
    {
      name: 'main',
      path: '/',
      redirect: '/a/b'
    },
    {
      name: 'summary',
      path: '/summary',
      component: Summary
    },
    {
      name: 'preferences',
      path: '/preferences',
      component: Preferences
    },
    {
      name: 'configInsights',
      path: '/configInsights',
      component: ConfigInsights
    },
    {
      name: 'page',
      path: '/:group/:cluster',
      component: Page,
      children: [
        {
          name: 'page.state',
          path: 'state',
          component: State,
          redirect: {
            name: 'page.state.executor'
          },
          props: true,
          children: [
            {
              name: 'page.state.monitor',
              path: 'monitor',
              component: Monitor,
              props: true
            },
            {
              name: 'page.state.analyzer',
              path: 'analyzer',
              component: Analyzer,
              props: true
            },
            {
              name: 'page.state.executor',
              path: 'executor',
              component: Executor,
              props: true
            },
            {
              name: 'page.state.anomaly_detector',
              path: 'anomaly_detector',
              component: AnomalyDetector,
              props: true
            }
          ]
        },
        {
          name: 'page.kafkaclusterstate',
          path: 'kafka_cluster_state',
          component: KafkaClusterState,
          props: true
        },
        {
          name: 'page.load',
          path: 'load',
          component: Load,
          props: true
        },
        {
          name: 'page.replicaload',
          path: 'replicaload',
          component: ReplicaLoad,
          props: true
        },
        {
          name: 'page.proposals',
          path: 'proposals',
          component: Proposals,
          props: true
        },
        {
          name: 'page.partitionload',
          path: 'partitionload',
          component: PartitionLoad,
          props: true
        },
        {
          name: 'page.user_tasks',
          path: 'user_tasks',
          component: UserTasks,
          props: true
        },
        {
          name: 'page.admin_state',
          path: 'admin_state',
          component: AdminSampling,
          props: true
        },
        {
          name: 'page.resource_distributions',
          path: 'resource_distributions',
          component: ResourceDistribution,
          props: true
        },
        {
          name: 'page.admin_broker',
          path: 'admin_broker',
          component: AdminBroker,
          props: true
        },
        {
          name: 'page.review',
          path: 'review',
          component: PeerReview,
          props: true
        }
      ],
      props: true
    }
  ],
  beforeEach: function (to, from, next) {
    console.log('called before each : %s -> %s', to, from)
    store.commit('seturl', to)
    next()
  }
})
