<!-- Copyright 2017-2019 LinkedIn Corp. Licensed under the BSD 2-Clause License (the "License"). See License in the project root for license information. -->
<template>
  <div id="app">
    <app-nav></app-nav>
    <div class="container-fluid" id="page">
      <transition mode="out-in">
        <router-view></router-view>
      </transition>
    </div>
    <hr>
    <p class="text-center">&copy; 2017-2019 <a href="https://linkedin.com">LinkedIn</a>.</p>
  </div>
</template>

<script>
import AppNav from '@/components/AppNav'
export default {
  name: 'app',
  components: {
    AppNav
  }
}
</script>

<style>
#page { margin-top: 90px; }
</style>
